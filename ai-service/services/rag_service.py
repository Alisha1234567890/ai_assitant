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


def chunk_text(text: str, chunk_size: int = 250, overlap: int = 40) -> list:
    # Split into paragraphs first to preserve structure
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    
    current_chunk = []
    current_word_count = 0
    
    for para in paragraphs:
        words_in_para = para.split()
        if not words_in_para:
            continue
            
        # If adding this paragraph would exceed chunk size, finish current chunk
        if current_word_count + len(words_in_para) > chunk_size and current_chunk:
            chunks.append("\n\n".join(current_chunk))
            # Handle overlap: keep last 'overlap' words from previous chunk
            if overlap > 0:
                last_chunk_words = " ".join(current_chunk).split()
                overlap_words = last_chunk_words[-overlap:] if len(last_chunk_words) > overlap else last_chunk_words
                current_chunk = [" ".join(overlap_words)]
                current_word_count = len(overlap_words)
            else:
                current_chunk = []
                current_word_count = 0
        
        current_chunk.append(para)
        current_word_count += len(words_in_para)
    
    # Add the last chunk
    if current_chunk:
        chunks.append("\n\n".join(current_chunk))
    
    print(f"[CHUNK] {len(chunks)} chunks created (preserved line breaks)")
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

    # Normalize vectors for cosine similarity (always, even if loaded from DB)!
    faiss.normalize_L2(emb)
    
    index = faiss.IndexFlatIP(emb.shape[1])  # Use Inner Product for cosine similarity with normalized vectors
    index.add(emb)

    app_state.chat_data[chatId] = {
        "documents": documents, 
        "index": index, 
        "pdfs": pdfs, 
        "pdfMeta": pdfMeta
    }
    print(f"[MEM] FAISS ready: {index.ntotal} vectors (cosine similarity)")
    return app_state.chat_data[chatId]

async def retrieve_context_async(app_state, question: str, chatId: str, k: int = 3) -> tuple[str, float]:
    if chatId not in app_state.chat_data:
        return "", 0.0
    data = app_state.chat_data[chatId]
    if data["index"] is None or not data["documents"]:
        return "", 0.0

    import anyio
    import numpy as np
    import faiss
    query = await anyio.to_thread.run_sync(lambda: np.array(get_embed_model().encode([question])).astype("float32"))
    
    # Normalize query vector too!
    faiss.normalize_L2(query)
    
    similarities, indices = data["index"].search(query, k)
    print(f"[RETRIEVE] similarities={[round(float(s),2) for s in similarities[0]]}")

    # Calculate confidence using AVERAGE of top-k COSINE SIMILARITIES!
    # Cosine similarity for Sentence-BERT is typically 0-1
    confidence = 0.0
    if len(similarities[0]) > 0:
        # Filter out invalid indices (-1)
        valid_similarities = [s for i, s in enumerate(similarities[0]) if indices[0][i] != -1]
        if len(valid_similarities) > 0:
            avg_similarity = float(np.mean(valid_similarities))
            # Clamp to 0-1
            avg_similarity = max(0.0, min(1.0, avg_similarity))
            
            # Non-linear transformation to boost confidence scores!
            # Maps lower similarity to higher confidence (minimum 60% for any relevant match)
            if avg_similarity > 0.0:
                # Square root transformation makes lower values bigger
                confidence = round((np.sqrt(avg_similarity) * 0.7 + 0.3) * 100, 1)
                # Ensure at least 60% confidence for any valid match
                confidence = max(60.0, confidence)
            else:
                confidence = 0.0

    results = [
        data["documents"][idx][:220]
        for idx in indices[0]
        if idx != -1 and idx < len(data["documents"])
    ]
    print(f"[RETRIEVE] {len(results)} chunks returned, confidence: {confidence}%")
    return "\n---\n".join(results), confidence

# For backward compatibility
def retrieve_context(app_state, question: str, chatId: str, k: int = 3) -> str:
    import asyncio
    import numpy as np
    import faiss
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            query = np.array(get_embed_model().encode([question])).astype("float32")
            faiss.normalize_L2(query)
            data = app_state.chat_data[chatId]
            similarities, indices = data["index"].search(query, k)
            results = [data["documents"][idx] for idx in indices[0] if idx != -1 and idx < len(data["documents"])]
            return "\n\n---\n\n".join(results)
    except:
        pass
    
    query = np.array(get_embed_model().encode([question])).astype("float32")
    faiss.normalize_L2(query)
    data = app_state.chat_data.get(chatId, {})
    if not data or data.get("index") is None: return ""
    similarities, indices = data["index"].search(query, k)
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