import os
import requests
import numpy as np
import faiss
from bson import ObjectId
from sentence_transformers import SentenceTransformer
from core.database import chat_collection

# Global models
embed_model = SentenceTransformer("all-MiniLM-L6-v2")

# Groq Config
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

def chunk_text(text: str, chunk_size: int = 300, overlap: int = 50) -> list:
    words = text.split()
    print(f"[CHUNK] {len(words)} words total")
    chunks, i = [], 0
    while i < len(words):
        chunks.append(" ".join(words[i: i + chunk_size]))
        i += chunk_size - overlap
    print(f"[CHUNK] {len(chunks)} chunks created")
    return chunks

async def get_or_create_chat_data(app_state, chatId: str):
    if chatId in app_state.chat_data:
        e = app_state.chat_data[chatId]
        print(f"[MEM] {chatId} -> {len(e['documents'])} docs in memory")
        return e

    chat = await chat_collection.find_one({"_id": ObjectId(chatId)})
    if not chat:
        print(f"[MEM] {chatId} not found in MongoDB")
        return None

    documents = chat.get("documents", [])
    pdfs = chat.get("pdfs", [])
    print(f"[MEM] Loaded from DB: {len(documents)} chunks, {len(pdfs)} PDFs")

    if not documents:
        app_state.chat_data[chatId] = {"documents": [], "index": None, "pdfs": pdfs}
        return app_state.chat_data[chatId]

    emb = np.array(embed_model.encode(documents)).astype("float32")
    index = faiss.IndexFlatL2(emb.shape[1])
    index.add(emb)
    app_state.chat_data[chatId] = {"documents": documents, "index": index, "pdfs": pdfs}
    print(f"[MEM] FAISS rebuilt: {index.ntotal} vectors")
    return app_state.chat_data[chatId]

def retrieve_context(app_state, question: str, chatId: str, k: int = 6) -> str:
    if chatId not in app_state.chat_data:
        return ""
    data = app_state.chat_data[chatId]
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
    system_prompt = custom_system.strip() if custom_system and custom_system.strip() else default_system

    recent = history[-6:] if len(history) > 6 else history
    history_msgs = [{"role": m["role"], "content": m["content"]} for m in recent]

    messages = (
        [{"role": "system", "content": system_prompt}]
        + history_msgs
        + [{"role": "user", "content": f"CONTEXT:\n{context}\n\nQUESTION:\n{question}"}]
    )

    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.2,
        "top_p": 0.9,
    }

    print(f"[GROQ] Calling {GROQ_MODEL}...")
    resp = requests.post(
        GROQ_API_URL,
        json=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        timeout=30,
    )
    data = resp.json()

    if "choices" in data:
        return data["choices"][0]["message"]["content"]
    
    if "error" in data:
        err = data["error"].get("message", "Unknown error")
        if "rate" in err.lower() or "limit" in err.lower():
            return "⚠️ Rate limit hit. Please wait a moment and try again."
        return f"⚠️ Groq error: {err}"

    return "⚠️ Unexpected response from Groq"

def call_groq_chat(question: str, history: list, custom_system: str = None) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return "❌ GROQ_API_KEY not set in .env"

    default_system = "You are a helpful, friendly AI assistant. Answer clearly and concisely."
    system_prompt = custom_system.strip() if custom_system and custom_system.strip() else default_system

    recent = history[-6:] if len(history) > 6 else history
    history_msgs = [{"role": m["role"], "content": m["content"]} for m in recent]

    messages = (
        [{"role": "system", "content": system_prompt}]
        + history_msgs
        + [{"role": "user", "content": question}]
    )

    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.7,
        "top_p": 0.9,
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
        return data["choices"][0]["message"]["content"]
    
    if "error" in data:
        err = data["error"].get("message", "Unknown error")
        if "rate" in err.lower() or "limit" in err.lower():
            return "⚠️ Rate limit hit. Please wait a moment and try again."
        return f"⚠️ Groq error: {err}"

    return "⚠️ Unexpected response from Groq"
