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
import json
import re
from dotenv import load_dotenv
from pypdf import PdfReader
import faiss
import numpy as np

from embeddings import encode_texts, encode_query, backend as embed_backend

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
app.state.chat_data = {}

# ---------- GROQ CONFIG ----------
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.3-70b-versatile"

# Free tier: 12k TPM — keep each request well under that
RETRIEVE_K = 3
MAX_CHUNK_CHARS = 450
MAX_CONTEXT_CHARS = 4500
MAX_HISTORY_TURNS = 2
MAX_HISTORY_CHARS = 400
GROQ_MAX_OUTPUT_TOKENS = 512


def _clip(text: str, limit: int) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + "…"


def _trim_history(history: list) -> list:
    recent = history[-MAX_HISTORY_TURNS:] if len(history) > MAX_HISTORY_TURNS else history
    return [
        {"role": m["role"], "content": _clip(m["content"], MAX_HISTORY_CHARS)}
        for m in recent
    ]


def _format_groq_error(err: str, status: int) -> str:
    low = err.lower()
    if status == 413 or "too large" in low or "tpm" in low:
        return (
            "⚠️ Groq free tier limit: request used too many tokens. "
            "Try again with a shorter question, or click Clear Messages and ask again."
        )
    if "rate" in low or "limit" in low:
        return "⚠️ Groq free limit reached. Wait about 60 seconds, then try again."
    return f"⚠️ Groq error: {err}"

# ---------- REQUEST MODEL ----------
class AskRequest(BaseModel):
    question: str
    userId: str
    chatId: str | None = None
    systemPrompt: str | None = None   # custom system prompt from frontend
    mode: str = "rag"                 # "rag" = PDF context required, "chat" = free chat


class KnowledgeMapRequest(BaseModel):
    question: str
    answer: str
    chatId: str | None = None
    mode: str = "rag"


# ---------- HEALTH ----------
@app.get("/")
def home():
    return {
        "status":       "running",
        "groq_key_set": bool(os.getenv("GROQ_API_KEY")),
        "mongo_set":    bool(os.getenv("MONGO_URL")),
        "model":        GROQ_MODEL,
        "chats_in_mem": len(app.state.chat_data),
        "embed_backend": embed_backend(),
    }


# ---------- CHUNKING ----------
def chunk_text(text: str, chunk_size: int = 150, overlap: int = 30) -> list:
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
        app.state.chat_data[chatId] = {
            "documents": [], "index": None, "pdfs": pdfs, "vectorizer": None,
        }
        return app.state.chat_data[chatId]

    emb, vec = encode_texts(documents)
    index = faiss.IndexFlatL2(emb.shape[1])
    index.add(emb)
    app.state.chat_data[chatId] = {
        "documents": documents, "index": index, "pdfs": pdfs, "vectorizer": vec,
    }
    print(f"[MEM] FAISS rebuilt: {index.ntotal} vectors")
    return app.state.chat_data[chatId]


def retrieve_context(question: str, chatId: str, k: int = RETRIEVE_K) -> str:
    if chatId not in app.state.chat_data:
        return ""
    data = app.state.chat_data[chatId]
    if data["index"] is None or not data["documents"]:
        return ""

    query = encode_query(question, data.get("vectorizer"))
    distances, indices = data["index"].search(query, k)
    print(f"[RETRIEVE] distances={[round(float(d),2) for d in distances[0]]}")

    results = [
        _clip(data["documents"][idx], MAX_CHUNK_CHARS)
        for idx in indices[0]
        if idx != -1 and idx < len(data["documents"])
    ]
    context = _clip("\n\n---\n\n".join(results), MAX_CONTEXT_CHARS)
    print(f"[RETRIEVE] {len(results)} chunks, {len(context)} chars sent to Groq")
    return context


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

    history_msgs = _trim_history(history)
    user_content = _clip(
        f"CONTEXT:\n{context}\n\nQUESTION:\n{question}",
        MAX_CONTEXT_CHARS + 200,
    )

    messages = (
        [{"role": "system", "content": _clip(system_prompt, 800)}]
        + history_msgs
        + [{"role": "user", "content": user_content}]
    )

    payload = {
        "model":       GROQ_MODEL,
        "messages":    messages,
        "max_tokens":  GROQ_MAX_OUTPUT_TOKENS,
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
        return _format_groq_error(err, resp.status_code)

    return "⚠️ Unexpected response from Groq"


def _parse_graph_json(raw: str) -> dict | None:
    if not raw:
        return None
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return None
        try:
            data = json.loads(match.group())
        except json.JSONDecodeError:
            return None
    if not isinstance(data, dict):
        return None
    nodes = data.get("nodes") or []
    edges = data.get("edges") or []
    if not isinstance(nodes, list) or not isinstance(edges, list) or not nodes:
        return None
    clean_nodes, ids = [], set()
    for i, n in enumerate(nodes[:12]):
        if not isinstance(n, dict):
            continue
        nid = str(n.get("id") or f"n{i}")
        label = str(n.get("label") or nid).strip()[:48]
        if not label:
            continue
        group = n.get("group") if n.get("group") in ("core", "related", "context") else "related"
        clean_nodes.append({"id": nid, "label": label, "group": group})
        ids.add(nid)
    if len(clean_nodes) < 2:
        return None
    clean_edges = []
    for e in edges[:18]:
        if not isinstance(e, dict):
            continue
        src, tgt = str(e.get("source", "")), str(e.get("target", ""))
        if src in ids and tgt in ids and src != tgt:
            clean_edges.append({
                "source": src,
                "target": tgt,
                "label": str(e.get("label") or "relates to")[:32],
            })
    if not clean_edges and len(clean_nodes) >= 2:
        hub = clean_nodes[0]["id"]
        for n in clean_nodes[1:]:
            clean_edges.append({"source": hub, "target": n["id"], "label": "relates to"})
    return {"nodes": clean_nodes, "edges": clean_edges}


def _fallback_knowledge_graph(question: str, answer: str) -> dict:
    q_words = [w for w in re.findall(r"[A-Za-z]{3,}", question) if w.lower() not in ("the", "and", "for", "what", "how", "why")]
    topic = " ".join(q_words[:3]).title() or "Topic"
    snippets = re.split(r"[.!?\n]+", answer)
    labels = [topic]
    for s in snippets:
        s = s.strip()
        if 8 < len(s) < 60:
            labels.append(s[:40])
        if len(labels) >= 7:
            break
    while len(labels) < 4:
        labels.append(f"Concept {len(labels)}")
    nodes = [{"id": f"n{i}", "label": lb, "group": "core" if i == 0 else "related"} for i, lb in enumerate(labels[:7])]
    edges = [{"source": nodes[0]["id"], "target": n["id"], "label": "relates to"} for n in nodes[1:]]
    return {"nodes": nodes, "edges": edges}


def call_groq_knowledge_map(question: str, answer: str) -> dict:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return _fallback_knowledge_graph(question, answer)

    prompt = (
        "Extract a semantic knowledge graph from the Q&A below.\n"
        "Return ONLY valid JSON (no markdown):\n"
        '{"nodes":[{"id":"n1","label":"short concept","group":"core|related|context"}],'
        '"edges":[{"source":"n1","target":"n2","label":"verb phrase"}]}\n'
        "Rules: 5-9 nodes, 5-12 edges, 1-2 nodes with group core (main topic), "
        "short labels (2-4 words), meaningful edge labels.\n\n"
        f"QUESTION:\n{question[:300]}\n\nANSWER:\n{answer[:900]}"
    )
    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": "You output only valid JSON knowledge graphs."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 384,
        "temperature": 0.15,
    }
    try:
        resp = requests.post(
            GROQ_API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            timeout=25,
        )
        data = resp.json()
        if "choices" in data:
            parsed = _parse_graph_json(data["choices"][0]["message"]["content"])
            if parsed:
                return parsed
    except Exception:
        pass
    return _fallback_knowledge_graph(question, answer)


# ---------- GROQ FREE CHAT (no RAG context) ----------
def call_groq_chat(question: str, history: list, custom_system: str = None) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return "❌ GROQ_API_KEY not set in .env"

    default_system = "You are a helpful, friendly AI assistant. Answer clearly and concisely."
    system_prompt  = custom_system.strip() if custom_system and custom_system.strip() else default_system

    history_msgs = _trim_history(history)

    messages = (
        [{"role": "system", "content": _clip(system_prompt, 800)}]
        + history_msgs
        + [{"role": "user", "content": _clip(question, 1200)}]
    )

    payload = {
        "model":       GROQ_MODEL,
        "messages":    messages,
        "max_tokens":  GROQ_MAX_OUTPUT_TOKENS,
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
        return _format_groq_error(err, resp.status_code)

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
    if embed_backend() == "tfidf" and chat_data.get("documents"):
        all_docs = chat_data["documents"] + chunks
        new_emb, vec = encode_texts(all_docs)
        chat_data["vectorizer"] = vec
        chat_data["index"] = faiss.IndexFlatL2(new_emb.shape[1])
        chat_data["index"].add(new_emb)
        chat_data["documents"] = all_docs
    else:
        new_emb, vec = encode_texts(chunks, chat_data.get("vectorizer"))
        if vec is not None:
            chat_data["vectorizer"] = vec
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


# ---------- KNOWLEDGE MAP ----------
@app.post("/knowledge-map")
async def knowledge_map(req: KnowledgeMapRequest):
    try:
        print(f"\n[GRAPH] '{req.question[:50]}' | mode={req.mode}")
        if not req.question.strip() or not req.answer.strip():
            return {"graph": {"nodes": [], "edges": []}}
        skip = req.answer.strip().startswith(("❌", "⚠️"))
        if skip:
            return {"graph": {"nodes": [], "edges": []}}
        graph = call_groq_knowledge_map(req.question, req.answer)
        print(f"[GRAPH] {len(graph['nodes'])} nodes, {len(graph['edges'])} edges")
        return {"graph": graph}
    except Exception as e:
        traceback.print_exc()
        return {"graph": _fallback_knowledge_graph(req.question, req.answer), "warning": str(e)}


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
