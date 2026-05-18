from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from bson import ObjectId
from typing import List

import requests
import os
import shutil
import traceback
from dotenv import load_dotenv
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

load_dotenv()

app = FastAPI()

# ---------- STATIC FILES ----------
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/view-pdf", StaticFiles(directory=UPLOAD_DIR), name="static_pdfs")

# ---------- CORS ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- MONGODB ----------
MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client["ai_doc_db"]
chat_collection = db["chats"]

# ---------- GLOBAL STATE ----------
embed_model = SentenceTransformer("all-MiniLM-L6-v2")
app.state.chat_data = {}

# ---------- GROQ CONFIG ----------
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.3-70b-versatile"

# ---------- REQUEST MODEL ----------
class AskRequest(BaseModel):
    question: str
    userId: str
    chatId: str | None = None
    systemPrompt: str | None = None   # custom system prompt from frontend
    mode: str = "rag"                 # "rag" = PDF context required, "chat" = free chat


# ---------- HEALTH ----------
@app.get("/")
def home():
    return {
        "status":       "running",
        "groq_key_set": bool(os.getenv("GROQ_API_KEY")),
        "mongo_set":    bool(os.getenv("MONGO_URL")),
        "model":        GROQ_MODEL,
        "chats_in_mem": len(app.state.chat_data),
    }


# ---------- CHUNKING ----------
def chunk_text(text: str, chunk_size: int = 300, overlap: int = 50) -> list:
    words = text.split()
    print(f"[CHUNK] {len(words)} words total")
    chunks, i = [], 0
    while i < len(words):
        chunks.append(" ".join(words[i: i + chunk_size]))
        i += chunk_size - overlap
    print(f"[CHUNK] {len(chunks)} chunks created")
    return chunks


# ---------- MEMORY HELPERS ----------
async def get_or_create_chat_data(chatId: str):
    if chatId in app.state.chat_data:
        e = app.state.chat_data[chatId]
        print(f"[MEM] {chatId} -> {len(e['documents'])} docs in memory")
        return e

    chat = await chat_collection.find_one({"_id": ObjectId(chatId)})
    if not chat:
        print(f"[MEM] {chatId} not found in MongoDB")
        return None

    documents = chat.get("documents", [])
    pdfs      = chat.get("pdfs", [])
    print(f"[MEM] Loaded from DB: {len(documents)} chunks, {len(pdfs)} PDFs")

    if not documents:
        app.state.chat_data[chatId] = {"documents": [], "index": None, "pdfs": pdfs}
        return app.state.chat_data[chatId]

    emb = np.array(embed_model.encode(documents)).astype("float32")
    index = faiss.IndexFlatL2(emb.shape[1])
    index.add(emb)
    app.state.chat_data[chatId] = {"documents": documents, "index": index, "pdfs": pdfs}
    print(f"[MEM] FAISS rebuilt: {index.ntotal} vectors")
    return app.state.chat_data[chatId]


def retrieve_context(question: str, chatId: str, k: int = 6) -> str:
    if chatId not in app.state.chat_data:
        return ""
    data = app.state.chat_data[chatId]
    if data["index"] is None or not data["documents"]:
        return ""

    query = np.array(embed_model.encode([question])).astype("float32")
    distances, indices = data["index"].search(query, k)
    print(f"[RETRIEVE] distances={[round(float(d),2) for d in distances[0]]}")

    results = [
        data["documents"][idx]
        for idx in indices[0]
        if idx != -1 and idx < len(data["documents"])
    ]
    print(f"[RETRIEVE] {len(results)} chunks returned")
    return "\n\n---\n\n".join(results)


# ---------- GROQ LLM ----------
def call_groq(context: str, question: str, history: list, custom_system: str = None) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return "❌ GROQ_API_KEY not set in .env"

    default_system = (
        "You are a helpful AI assistant that answers questions strictly based on document context.\n"
        "Rules:\n"
        "1. Only use information from the CONTEXT block.\n"
        "2. If the answer is not in the context, say 'Not found in the document'.\n"
        "3. Be concise. Use bullet points when listing multiple items.\n"
        "4. Never make up information.\n"
        "5. If multiple documents are provided, synthesize information across all of them."
    )
    # Use custom system prompt from frontend if provided
    system_prompt = custom_system.strip() if custom_system and custom_system.strip() else default_system

    recent = history[-6:] if len(history) > 6 else history
    history_msgs = [{"role": m["role"], "content": m["content"]} for m in recent]

    messages = (
        [{"role": "system", "content": system_prompt}]
        + history_msgs
        + [{"role": "user", "content": f"CONTEXT:\n{context}\n\nQUESTION:\n{question}"}]
    )

    payload = {
        "model":       GROQ_MODEL,
        "messages":    messages,
        "max_tokens":  1024,
        "temperature": 0.2,
        "top_p":       0.9,
    }

    print(f"[GROQ] Calling {GROQ_MODEL}...")
    resp = requests.post(
        GROQ_API_URL,
        json=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        timeout=30,
    )
    data = resp.json()
    print(f"[GROQ] status={resp.status_code}")

    if "choices" in data:
        answer = data["choices"][0]["message"]["content"]
        tokens = data.get("usage", {}).get("total_tokens", "?")
        print(f"[GROQ] ✅ {tokens} tokens | {answer[:80]}...")
        return answer

    if "error" in data:
        err = data["error"].get("message", "Unknown error")
        print(f"[GROQ] ❌ {err}")
        if "rate" in err.lower() or "limit" in err.lower():
            return "⚠️ Rate limit hit. Please wait a moment and try again."
        return f"⚠️ Groq error: {err}"

    return "⚠️ Unexpected response from Groq"


# ---------- GROQ FREE CHAT (no RAG context) ----------
def call_groq_chat(question: str, history: list, custom_system: str = None) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return "❌ GROQ_API_KEY not set in .env"

    default_system = "You are a helpful, friendly AI assistant. Answer clearly and concisely."
    system_prompt  = custom_system.strip() if custom_system and custom_system.strip() else default_system

    recent = history[-6:] if len(history) > 6 else history
    history_msgs = [{"role": m["role"], "content": m["content"]} for m in recent]

    messages = (
        [{"role": "system", "content": system_prompt}]
        + history_msgs
        + [{"role": "user", "content": question}]
    )

    payload = {
        "model":       GROQ_MODEL,
        "messages":    messages,
        "max_tokens":  1024,
        "temperature": 0.7,   # slightly more creative for free chat
        "top_p":       0.9,
    }

    print(f"[GROQ CHAT] Calling {GROQ_MODEL}...")
    resp = requests.post(
        GROQ_API_URL,
        json=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        timeout=30,
    )
    data = resp.json()

    if "choices" in data:
        answer = data["choices"][0]["message"]["content"]
        print(f"[GROQ CHAT] ✅ {answer[:80]}...")
        return answer

    if "error" in data:
        err = data["error"].get("message", "Unknown error")
        print(f"[GROQ CHAT] ❌ {err}")
        if "rate" in err.lower() or "limit" in err.lower():
            return "⚠️ Rate limit hit. Please wait a moment and try again."
        return f"⚠️ Groq error: {err}"

    return "⚠️ Unexpected response from Groq"
async def process_single_pdf(file: UploadFile, current_chat_id: str, chat_data: dict) -> dict:
    safe_name = file.filename.replace(" ", "_")
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    # Save to disk
    with open(file_path, "wb") as buf:
        shutil.copyfileobj(file.file, buf)

    # Extract text from disk
    reader = PdfReader(file_path)
    text   = ""
    for i, page in enumerate(reader.pages):
        extracted = page.extract_text() or ""
        print(f"[UPLOAD] {safe_name} page {i+1}: {len(extracted)} chars")
        text += extracted + " "

    print(f"[UPLOAD] {safe_name}: {len(text)} total chars, {len(reader.pages)} pages")

    if not text.strip():
        return {"name": safe_name, "error": "No readable text — may be a scanned/image PDF"}

    chunks = chunk_text(text)
    if not chunks:
        return {"name": safe_name, "error": "Chunking produced no results"}

    # Embed and index
    print(f"[UPLOAD] Encoding {len(chunks)} chunks for {safe_name}...")
    new_emb = np.array(embed_model.encode(chunks)).astype("float32")

    if chat_data["index"] is None:
        chat_data["index"] = faiss.IndexFlatL2(new_emb.shape[1])

    chat_data["index"].add(new_emb)
    chat_data["documents"].extend(chunks)
    chat_data["pdfs"].append(safe_name)

    # Persist to MongoDB immediately
    await chat_collection.update_one(
        {"_id": ObjectId(current_chat_id)},
        {"$push": {"documents": {"$each": chunks}, "pdfs": safe_name}},
    )

    print(f"[UPLOAD] ✅ {safe_name} done — {len(chunks)} chunks added")
    return {"name": safe_name, "pages": len(reader.pages), "chunks": len(chunks)}


# ---------- UPLOAD (accepts 1 or many PDFs) ----------
@app.post("/upload")
async def upload_pdfs(
    files:  List[UploadFile] = File(...),
    chatId: str              = Form(None),
    userId: str              = Form("user123"),
):
    try:
        print(f"\n[UPLOAD] {len(files)} file(s) | chatId={chatId} | userId={userId}")

        # Validate all files are PDFs
        for f in files:
            if not f.filename.lower().endswith(".pdf"):
                return {"error": f"'{f.filename}' is not a PDF. Only PDF files accepted."}

        # Auto-create chat if needed
        current_chat_id = chatId
        if not current_chat_id or current_chat_id == "null" or not ObjectId.is_valid(current_chat_id):
            first_name = files[0].filename.replace(" ", "_")[:30]
            title = first_name if len(files) == 1 else f"{first_name} +{len(files)-1} more"
            result = await chat_collection.insert_one({
                "userId":    userId,
                "title":     title,
                "messages":  [],
                "documents": [],
                "pdfs":      [],
                "createdAt": datetime.utcnow(),
            })
            current_chat_id = str(result.inserted_id)
            print(f"[UPLOAD] Auto-created chat: {current_chat_id}")

        chat_data = await get_or_create_chat_data(current_chat_id)
        if chat_data is None:
            return {"error": "Could not load or create chat"}

        # Process each PDF one by one
        succeeded = []
        failed    = []
        for file in files:
            res = await process_single_pdf(file, current_chat_id, chat_data)
            if "error" in res:
                failed.append(res)
                print(f"[UPLOAD] ⚠️ {res['name']}: {res['error']}")
            else:
                succeeded.append(res)

        total_vectors = chat_data["index"].ntotal if chat_data["index"] else 0
        print(f"[UPLOAD] Done. FAISS total: {total_vectors} vectors")

        return {
            "chatId":        current_chat_id,
            "uploaded":      succeeded,          # list of {name, pages, chunks}
            "failed":        failed,             # list of {name, error}
            "total_files":   len(files),
            "success_count": len(succeeded),
            "total_chunks":  len(chat_data["documents"]),
        }

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}


# ---------- ASK ----------
@app.post("/ask")
async def ask(req: AskRequest):
    try:
        print(f"\n[ASK] mode={req.mode} | '{req.question[:60]}' | chatId={req.chatId}")

        if not req.chatId or not ObjectId.is_valid(req.chatId):
            result = await chat_collection.insert_one({
                "userId":    req.userId,
                "title":     req.question[:40],
                "messages":  [],
                "documents": [],
                "pdfs":      [],
                "createdAt": datetime.utcnow(),
            })
            req.chatId = str(result.inserted_id)
            print(f"[ASK] Created chat: {req.chatId}")

        # Fetch conversation history for both modes
        chat_doc = await chat_collection.find_one({"_id": ObjectId(req.chatId)})
        raw_msgs = (chat_doc or {}).get("messages", [])
        history  = [
            {"role": "user" if m["role"] == "user" else "assistant", "content": m["text"]}
            for m in raw_msgs
        ]

        if req.mode == "chat":
            # ── FREE CHAT MODE: no PDF context needed ──
            print("[ASK] Free chat mode — skipping RAG")
            answer = call_groq_chat(req.question, history, custom_system=req.systemPrompt)

        else:
            # ── RAG MODE: requires uploaded PDF ──
            chat_data = await get_or_create_chat_data(req.chatId)
            if not chat_data or not chat_data["documents"]:
                answer = "⚠️ No document uploaded yet. Please upload a PDF first, or switch to Chat mode."
            else:
                context = retrieve_context(req.question, req.chatId)
                if not context:
                    answer = "⚠️ No relevant content found. Try rephrasing your question."
                else:
                    answer = call_groq(context, req.question, history, custom_system=req.systemPrompt)

        await chat_collection.update_one(
            {"_id": ObjectId(req.chatId)},
            {"$push": {"messages": {"$each": [
                {"role": "user", "text": req.question},
                {"role": "bot",  "text": answer},
            ]}}},
        )

        return {"answer": answer, "chatId": req.chatId}

    except requests.exceptions.Timeout:
        return {"answer": "❌ Request timed out. Please try again.", "chatId": req.chatId}
    except Exception as e:
        traceback.print_exc()
        return {"answer": f"❌ Backend error: {str(e)}", "chatId": req.chatId}


# ---------- NEW CHAT ----------
@app.post("/new-chat")
async def create_new_chat(userId: str = Form(...)):
    try:
        result = await chat_collection.insert_one({
            "userId": userId, "title": "New Chat",
            "messages": [], "documents": [], "pdfs": [],
            "createdAt": datetime.utcnow(),
        })
        return {"chatId": str(result.inserted_id)}
    except Exception as e:
        return {"error": str(e)}


# ---------- GET CHATS ----------
@app.get("/chats/{userId}")
async def get_chats(userId: str):
    chats = []
    async for c in chat_collection.find({"userId": userId}).sort("createdAt", -1):
        chats.append({
            "id":       str(c["_id"]),
            "title":    c.get("title", "Untitled"),
            "pdfCount": len(c.get("pdfs", [])),
        })
    return {"chats": chats}


# ---------- GET CHAT ----------
@app.get("/chat/{chatId}")
async def get_chat(chatId: str):
    try:
        if not ObjectId.is_valid(chatId):
            return {"error": "Invalid Chat ID"}
        chat = await chat_collection.find_one({"_id": ObjectId(chatId)})
        if not chat:
            return {"error": "Chat not found"}
        return {"messages": chat.get("messages", []), "pdfs": chat.get("pdfs", [])}
    except Exception as e:
        return {"error": str(e)}


# ---------- CLEAR MESSAGES ----------
@app.delete("/chat/{chatId}")
async def clear_chat(chatId: str):
    try:
        if not ObjectId.is_valid(chatId):
            return {"error": "Invalid Chat ID"}
        await chat_collection.update_one({"_id": ObjectId(chatId)}, {"$set": {"messages": []}})
        return {"message": "Messages cleared"}
    except Exception as e:
        return {"error": str(e)}


# ---------- DELETE CHAT ----------
@app.delete("/delete/{chatId}")
async def delete_chat(chatId: str):
    try:
        if not ObjectId.is_valid(chatId):
            return {"error": "Invalid Chat ID"}
        result = await chat_collection.delete_one({"_id": ObjectId(chatId)})
        if chatId in app.state.chat_data:
            del app.state.chat_data[chatId]
        if result.deleted_count == 0:
            return {"error": "Chat not found"}
        return {"message": "Chat deleted"}
    except Exception as e:
        return {"error": str(e)}
