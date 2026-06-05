import os
import httpx
from typing import Any, List, Optional, Dict
from bson import ObjectId
from core.database import chat_collection
from core.groq import (
    get_http_client, close_http_client, 
    GROQ_MODEL, GROQ_FAST_MODEL, 
    call_groq_efficient
)

# Global model cache
_model_cache = {}

def get_embed_model():
    if "embed" not in _model_cache:
        # Optimization: Avoid checking HF Hub on every load by setting local_files_only if possible
        # and explicitly setting device to CPU to avoid torch-cuda overhead during init
        print("[MODEL] Initializing SentenceTransformer (all-MiniLM-L6-v2)...")
        from sentence_transformers import SentenceTransformer
        try:
            # Try loading with local_files_only=True first for speed
            _model_cache["embed"] = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
        except Exception:
            # Fallback to normal loading if not found locally
            _model_cache["embed"] = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
            
        print("[MODEL] Model loaded successfully.")
    return _model_cache["embed"]


def chunk_text(text: str, chunk_size: int = 180, overlap: int = 25) -> list:
    words = text.split()
    print(f"[CHUNK] {len(words)} words total")
    chunks, i = [], 0
    while i < len(words):
        chunks.append(" ".join(words[i: i + chunk_size]))
        i += chunk_size - overlap
    print(f"[CHUNK] {len(chunks)} chunks created")
    return chunks

async def get_or_create_chat_data(app_state, chatId: str):
    import numpy as np
    import faiss

    # ✅ Return from memory if already loaded
    if chatId in app_state.chat_data:
        e = app_state.chat_data[chatId]
        print(f"[MEM] {chatId} -> {len(e['documents'])} docs in memory (cache hit)")
        return e

    chat = await chat_collection.find_one({"_id": ObjectId(chatId)})
    if not chat:
        print(f"[MEM] {chatId} not found in MongoDB")
        return None

    documents = chat.get("documents", [])
    pdfs = chat.get("pdfs", [])
    pdfMeta = chat.get("pdfMeta", [])
    embeddings = chat.get("embeddings", [])  # ✅ load saved embeddings
    print(f"[MEM] Loaded from DB: {len(documents)} chunks, {len(pdfs)} PDFs, {len(embeddings)} embeddings")

    if not documents:
        app_state.chat_data[chatId] = {
            "documents": [], 
            "index": None, 
            "pdfs": pdfs, 
            "pdfMeta": pdfMeta
        }
        return app_state.chat_data[chatId]

    if embeddings and len(embeddings) == len(documents):
        # ✅ FAST PATH — embeddings already saved, no re-encoding needed
        print(f"[MEM] Fast path: loading {len(embeddings)} embeddings from MongoDB (no re-encoding)")
        emb = np.array(embeddings).astype("float32")
    else:
        # ⚠️ SLOW FALLBACK — only runs for old data that has no saved embeddings
        print(f"[MEM] Slow path: re-encoding {len(documents)} chunks (one time only, embeddings will be saved on next upload)")
        import anyio
        emb = await anyio.to_thread.run_sync(
            lambda: np.array(get_embed_model().encode(documents)).astype("float32")
        )

    index = faiss.IndexFlatL2(emb.shape[1])
    index.add(emb)

    app_state.chat_data[chatId] = {
        "documents": documents, 
        "index": index, 
        "pdfs": pdfs, 
        "pdfMeta": pdfMeta
    }
    print(f"[MEM] FAISS ready: {index.ntotal} vectors")
    return app_state.chat_data[chatId]

async def retrieve_context_async(app_state, question: str, chatId: str, k: int = 2) -> str:
    if chatId not in app_state.chat_data:
        return ""
    data = app_state.chat_data[chatId]
    if data["index"] is None or not data["documents"]:
        return ""

    import anyio
    import numpy as np
    query = await anyio.to_thread.run_sync(lambda: np.array(get_embed_model().encode([question])).astype("float32"))
    distances, indices = data["index"].search(query, k)
    print(f"[RETRIEVE] distances={[round(float(d),2) for d in distances[0]]}")

    results = [
        data["documents"][idx][:220]
        for idx in indices[0]
        if idx != -1 and idx < len(data["documents"])
    ]
    print(f"[RETRIEVE] {len(results)} chunks returned")
    return "\n---\n".join(results)

# For backward compatibility
def retrieve_context(app_state, question: str, chatId: str, k: int = 2) -> str:
    import asyncio
    import numpy as np
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
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
    results = [data["documents"][idx][:220] for idx in indices[0] if idx != -1 and idx < len(data["documents"])]
    return "\n---\n".join(results)

async def call_groq(context: str, question: str, history: list, custom_system: str = None, model: str = GROQ_MODEL) -> str:
    system_prompt = "Answer from document. If not found, say so. Be brief."

    recent = history[-2:] if len(history) > 2 else history
    history_msgs = [{"role": m["role"], "content": m["content"][:400]} for m in recent]

    messages = (
        [{"role": "system", "content": system_prompt}]
        + history_msgs
        + [{"role": "user", "content": f"DOC:\n{context}\n\nQ:\n{question}"}]
    )

    result = await call_groq_efficient(
        messages=messages,
        model=model,
        temperature=0.1,
        max_tokens=512
    )
    
    if result["success"]:
        return result["content"]
    return result

async def call_groq_chat(question: str, history: list, custom_system: str = None, model: str = GROQ_MODEL) -> Any:
    default_system = "You are a helpful, friendly AI assistant. Answer clearly and concisely."
    system_prompt = custom_system.strip() if custom_system and custom_system.strip() else default_system

    recent = history[-6:] if len(history) > 6 else history
    history_msgs = [{"role": m["role"], "content": m["content"]} for m in recent]

    messages = (
        [{"role": "system", "content": system_prompt}]
        + history_msgs
        + [{"role": "user", "content": question}]
    )

    result = await call_groq_efficient(
        messages=messages,
        model=model,
        temperature=0.7,
        max_tokens=1024
    )
    
    if result["success"]:
        return result["content"]
    return result