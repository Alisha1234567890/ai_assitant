import os
import httpx
import numpy as np
import faiss
from bson import ObjectId
from core.database import chat_collection

# Global model cache and HTTP client
_model_cache = {}
_http_client = None

def get_http_client():
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=60.0)
    return _http_client

async def close_http_client():
    global _http_client
    if _http_client:
        await _http_client.aclose()
        _http_client = None

def get_embed_model():
    if "embed" not in _model_cache:
        print("[MODEL] Loading SentenceTransformer weights (all-MiniLM-L6-v2) for the first time...")
        from sentence_transformers import SentenceTransformer
        _model_cache["embed"] = SentenceTransformer("all-MiniLM-L6-v2")
    else:
        # Avoid excessive logging, but helpful for debugging global load verification
        # print("[MODEL] Using cached SentenceTransformer model")
        pass
    return _model_cache["embed"]

# Groq Config
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
# Using a slightly faster model for better performance if possible
# llama-3.3-70b-versatile is good but large. llama-3.1-8b-instant is much faster.
GROQ_MODEL = "llama-3.3-70b-versatile" 
GROQ_FAST_MODEL = "llama-3.1-8b-instant"

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
    pdfMeta = chat.get("pdfMeta", [])
    print(f"[MEM] Loaded from DB: {len(documents)} chunks, {len(pdfs)} PDFs")

    if not documents:
        app_state.chat_data[chatId] = {"documents": [], "index": None, "pdfs": pdfs, "pdfMeta": pdfMeta}
        return app_state.chat_data[chatId]

    # Generate embeddings asynchronously in a thread to not block event loop
    import anyio
    emb = await anyio.to_thread.run_sync(lambda: np.array(get_embed_model().encode(documents)).astype("float32"))
    
    index = faiss.IndexFlatL2(emb.shape[1])
    index.add(emb)
    app_state.chat_data[chatId] = {"documents": documents, "index": index, "pdfs": pdfs, "pdfMeta": pdfMeta}
    print(f"[MEM] FAISS rebuilt: {index.ntotal} vectors")
    return app_state.chat_data[chatId]

async def retrieve_context_async(app_state, question: str, chatId: str, k: int = 6) -> str:
    if chatId not in app_state.chat_data:
        return ""
    data = app_state.chat_data[chatId]
    if data["index"] is None or not data["documents"]:
        return ""

    import anyio
    query = await anyio.to_thread.run_sync(lambda: np.array(get_embed_model().encode([question])).astype("float32"))
    distances, indices = data["index"].search(query, k)
    print(f"[RETRIEVE] distances={[round(float(d),2) for d in distances[0]]}")

    results = [
        data["documents"][idx]
        for idx in indices[0]
        if idx != -1 and idx < len(data["documents"])
    ]
    print(f"[RETRIEVE] {len(results)} chunks returned")
    return "\n\n---\n\n".join(results)

# For backward compatibility
def retrieve_context(app_state, question: str, chatId: str, k: int = 6) -> str:
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # This is a hack, but retrieve_context is used synchronously in some places
            # Better to update those places to use retrieve_context_async
            query = np.array(get_embed_model().encode([question])).astype("float32")
            data = app_state.chat_data[chatId]
            distances, indices = data["index"].search(query, k)
            results = [data["documents"][idx] for idx in indices[0] if idx != -1 and idx < len(data["documents"])]
            return "\n\n---\n\n".join(results)
    except:
        pass
    
    query = np.array(get_embed_model().encode([question])).astype("float32")
    data = app_state.chat_data.get(chatId, {})
    if not data or data.get("index") is None: return ""
    distances, indices = data["index"].search(query, k)
    results = [data["documents"][idx] for idx in indices[0] if idx != -1 and idx < len(data["documents"])]
    return "\n\n---\n\n".join(results)

async def call_groq(context: str, question: str, history: list, custom_system: str = None, model: str = GROQ_MODEL) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("[GROQ] Error: GROQ_API_KEY not set")
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
        "model": model,
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.2,
        "top_p": 0.9,
    }

    client = get_http_client()
    print(f"[GROQ] Calling {model}...")
    try:
        resp = await client.post(
            GROQ_API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )
        data = resp.json()
        
        if resp.status_code != 200:
            error_msg = data.get("error", {}).get("message", "Unknown Groq error")
            print(f"[GROQ] API Error ({resp.status_code}): {error_msg}")
            return f"⚠️ Groq API Error: {error_msg}"
            
    except Exception as e:
        print(f"[GROQ] Request Exception: {str(e)}")
        return f"⚠️ Connection error: {str(e)}"

    if "choices" in data and len(data["choices"]) > 0:
        content = data["choices"][0]["message"]["content"]
        print(f"[GROQ] Success: Received {len(content)} characters")
        return content
    
    print(f"[GROQ] Unexpected response structure: {data}")
    return "⚠️ Unexpected response from Groq"

async def call_groq_chat(question: str, history: list, custom_system: str = None, model: str = GROQ_MODEL) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("[GROQ CHAT] Error: GROQ_API_KEY not set")
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
        "model": model,
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.7,
        "top_p": 0.9,
    }

    client = get_http_client()
    print(f"[GROQ CHAT] Calling {model}...")
    try:
        resp = await client.post(
            GROQ_API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )
        data = resp.json()
        
        if resp.status_code != 200:
            error_msg = data.get("error", {}).get("message", "Unknown Groq error")
            print(f"[GROQ CHAT] API Error ({resp.status_code}): {error_msg}")
            return f"⚠️ Groq API Error: {error_msg}"

    except Exception as e:
        print(f"[GROQ CHAT] Request Exception: {str(e)}")
        return f"⚠️ Connection error: {str(e)}"

    if "choices" in data and len(data["choices"]) > 0:
        content = data["choices"][0]["message"]["content"]
        print(f"[GROQ CHAT] Success: Received {len(content)} characters")
        return content
    
    print(f"[GROQ CHAT] Unexpected response structure: {data}")
    return "⚠️ Unexpected response from Groq"
