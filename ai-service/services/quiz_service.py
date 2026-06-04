import json
import math
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import anyio

from core.groq import (
    GROQ_FAST_MODEL,
    call_groq_efficient,
    estimate_tokens,
    is_token_limit_error,
)
from services.rag_service import get_embed_model

MAX_CONTEXT_CHUNKS = int(os.getenv("QUIZ_MAX_CONTEXT_CHUNKS", "8"))
MAX_CONTEXT_CHARS = int(os.getenv("QUIZ_MAX_CONTEXT_CHARS", "12000"))
MAX_ESTIMATED_TOKENS = int(os.getenv("QUIZ_MAX_ESTIMATED_TOKENS", "4000"))
MAX_RETRIEVAL_CANDIDATES = int(os.getenv("QUIZ_MAX_RETRIEVAL_CANDIDATES", "500"))
RETRY_CONTEXT_REDUCTION_FACTOR = 0.5

async def extract_topics_from_chunks(chunks: List[str]) -> List[str]:
    combined_text = " ".join(chunks[:10])
    prompt = f"Extract 5-7 key topics from this text. Return as comma-separated list.\n\nTEXT:\n{combined_text}"
    
    result = await call_groq_efficient(
        messages=[
            {"role": "system", "content": "You are a topic extractor."},
            {"role": "user", "content": prompt}
        ],
        model=GROQ_FAST_MODEL
    )
    
    if not result["success"]:
        return []
    
    topics = [t.strip() for t in result["content"].split(",") if t.strip()]
    return topics[:8]


def extract_important_concepts(topic: Optional[str]) -> List[str]:
    if not topic:
        return []
    words = re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}", topic.lower())
    seen = set()
    concepts = []
    for word in words:
        if word not in seen:
            concepts.append(word)
            seen.add(word)
    return concepts[:8]


def build_quiz_query(req: Any) -> str:
    concepts = extract_important_concepts(req.topic)
    parts = []
    if req.topic:
        parts.append(f"Topic: {req.topic}")
    
    if concepts:
        parts.append(f"Key concepts: {' '.join(concepts)}")
    
    parts.append(f"Context related to {req.difficulty} level questions about {', '.join(req.types)}")
    
    return " ".join(parts) if parts else "core document content and facts"


def generate_quiz_prompt(chunks: List[str], req: Any) -> str:
    context = "\n\n---\n\n".join(chunks)
    types_str = ", ".join(req.types)
    topic_line = f"\nTopic focus: {req.topic}" if req.topic else ""
    return (
        f"Create {req.count} {req.difficulty} questions from context.{topic_line}\n"
        f"Types: {types_str}.\n"
        "Return JSON: {\"quizTitle\":\"\",\"questions\":[{\"id\":\"q1\",\"type\":\"mcq|true_false|fill_blank\",\"question\":\"\",\"options\":[],\"correctAnswer\":\"\",\"explanation\":\"\",\"sourceReference\":\"\"}]}\n"
        "Rules: true_false options=['True','False']; fill_blank options=[]; JSON only.\n\n"
        f"CONTEXT:\n{context}"
    )


def is_structured_error(payload: Any) -> bool:
    return isinstance(payload, dict) and payload.get("success") is False


def is_token_limit_error(details: Optional[str], status_code: int = 200) -> bool:
    if status_code == 413:
        return True
    if not details:
        return False
    normalized = details.lower()
    return (
        "request too large" in normalized
        or "context length" in normalized
        or "token" in normalized and "limit" in normalized
        or "requested" in normalized and "limit" in normalized
        or "rate limit" in normalized # Sometimes rate limits look like token limits
    )


def build_allowed_indices(data: Dict[str, Any], pdf_names: Optional[List[str]]) -> List[int]:
    documents = data.get("documents", [])
    if not pdf_names:
        return list(range(len(documents)))

    allowed = []
    for meta in data.get("pdfMeta", []):
        if meta.get("name") in pdf_names:
            start = meta.get("chunkStart", 0)
            count = meta.get("chunkCount", 0)
            allowed.extend(range(start, min(start + count, len(documents))))
    return sorted(set(allowed))


async def retrieve_relevant_chunks(
    app_state,
    chat_id: str,
    req: Any,
    allowed_indices: List[int],
) -> Tuple[List[str], List[int]]:
    data = app_state.chat_data.get(chat_id)
    if not data or data.get("index") is None or not data.get("documents"):
        return [], []

    query_text = build_quiz_query(req)
    import numpy as np
    query = await anyio.to_thread.run_sync(
        lambda: np.array(get_embed_model().encode([query_text])).astype("float32")
    )

    search_k = min(
        data["index"].ntotal,
        max(MAX_CONTEXT_CHUNKS * 10, min(len(allowed_indices), MAX_RETRIEVAL_CANDIDATES)),
    )
    distances, indices = data["index"].search(query, search_k)
    allowed_set = set(allowed_indices)

    ranked_indices = []
    seen = set()
    for idx in indices[0]:
        if idx == -1 or idx in seen:
            continue
        if idx in allowed_set:
            ranked_indices.append(int(idx))
            seen.add(int(idx))
        if len(ranked_indices) >= MAX_CONTEXT_CHUNKS * 2:
            break

    if not ranked_indices:
        ranked_indices = allowed_indices[: MAX_CONTEXT_CHUNKS * 2]

    ranked_chunks = [data["documents"][idx] for idx in ranked_indices]
    print(
        f"[QUIZ] Retrieval query='{query_text}' | requested_k={search_k} | "
        f"ranked_indices={ranked_indices[:MAX_CONTEXT_CHUNKS]}"
    )
    print(
        f"[QUIZ] Retrieval distances="
        f"{[round(float(d), 2) for d in distances[0][: min(len(ranked_indices), 8)]]}"
    )
    return ranked_chunks, ranked_indices


def fit_chunks_to_context_limits(chunks: List[str], chunk_limit: int, char_limit: int) -> List[str]:
    selected = []
    total_chars = 0
    for chunk in chunks[:chunk_limit]:
        chunk_text = chunk.strip()
        if not chunk_text:
            continue
        projected = total_chars + len(chunk_text)
        if selected and projected > char_limit:
            break
        if projected > char_limit:
            remaining = max(0, char_limit - total_chars)
            if remaining > 400:
                selected.append(chunk_text[:remaining])
            break
        selected.append(chunk_text)
        total_chars = projected

    if not selected and chunks:
        selected = [chunks[0][:char_limit]]
    return selected


def prepare_prompt_with_limits(
    ranked_chunks: List[str],
    req: Any,
    reduction_factor: float = 1.0,
) -> Tuple[str, List[str], int, int]:
    chunk_limit = max(1, math.ceil(MAX_CONTEXT_CHUNKS * reduction_factor))
    char_limit = max(1200, math.ceil(MAX_CONTEXT_CHARS * reduction_factor))
    selected_chunks = fit_chunks_to_context_limits(ranked_chunks, chunk_limit, char_limit)
    prompt = generate_quiz_prompt(selected_chunks, req)
    prompt_chars = len(prompt)
    estimated_tokens = estimate_tokens(prompt)

    while len(selected_chunks) > 1 and estimated_tokens > MAX_ESTIMATED_TOKENS:
        selected_chunks = selected_chunks[: max(1, len(selected_chunks) // 2)]
        selected_chunks = fit_chunks_to_context_limits(selected_chunks, len(selected_chunks), max(1200, char_limit // 2))
        prompt = generate_quiz_prompt(selected_chunks, req)
        prompt_chars = len(prompt)
        estimated_tokens = estimate_tokens(prompt)

    if estimated_tokens > MAX_ESTIMATED_TOKENS and selected_chunks:
        overflow_ratio = MAX_ESTIMATED_TOKENS / max(estimated_tokens, 1)
        safe_context_chars = max(800, int(len(selected_chunks[0]) * overflow_ratio * 0.9))
        selected_chunks = [selected_chunks[0][:safe_context_chars]]
        prompt = generate_quiz_prompt(selected_chunks, req)
        prompt_chars = len(prompt)
        estimated_tokens = estimate_tokens(prompt)

    return prompt, selected_chunks, prompt_chars, estimated_tokens


async def call_groq_quiz(prompt: str, model: str = GROQ_FAST_MODEL) -> Dict[str, Any]:
    messages = [
        {"role": "system", "content": "You are a professional quiz generator. Return ONLY JSON."},
        {"role": "user", "content": prompt},
    ]
    
    return await call_groq_efficient(
        messages=messages,
        model=model,
        temperature=0.2,
        max_tokens=1024,
        response_format={"type": "json_object"}
    )

def parse_quiz_response(raw_resp: str) -> Dict[str, Any]:
    if not raw_resp or not isinstance(raw_resp, str):
        return {
            "success": False,
            "error": "Invalid Response",
            "details": "AI returned an empty or non-string response."
        }
    
    try:
        # Clean up possible markdown code blocks
        text = raw_resp.strip()
        
        # Look for the first '{' and last '}' to extract the JSON object
        match = re.search(r"(\{[\s\S]*\})", text)
        if match:
            text = match.group(1)
        
        # Basic cleanup of common JSON-breaking characters
        text = text.replace("```json", "").replace("```", "").strip()
        
        data = json.loads(text)
        if "questions" not in data:
            raise ValueError("JSON parsed but 'questions' field missing")
        return data
        
    except Exception as e:
        print(f"[QUIZ] Parsing error: {e}\nRaw: {raw_resp[:200]}...")
        # Try one more time with a very aggressive cleanup
        try:
            cleaned = re.sub(r",\s*([\]\}])", r"\1", text)
            data = json.loads(cleaned)
            if "questions" in data:
                return data
        except:
            pass
            
        return {
            "success": False,
            "error": "JSON Parse Error",
            "details": f"Failed to parse quiz JSON: {str(e)}",
            "raw": raw_resp[:500]
        }

        
async def generate_quiz_from_docs(app_state, req: Any):
    chat_id = req.chatId

    # ✅ Always use return value, don't rely on app_state.chat_data.get()
    from services.rag_service import get_or_create_chat_data
    data = await get_or_create_chat_data(app_state, chat_id)

    # ✅ Better error messages for debugging
    if not data:
        print(f"[QUIZ] chat_id={chat_id} not found in MongoDB")
        return {"error": "Chat not found. Please refresh and try again."}

    if not data.get("documents"):
        print(f"[QUIZ] chat_id={chat_id} found but has no documents. pdfs={data.get('pdfs', [])}")
        return {"error": "No documents found in this chat. Please upload files first."}

    all_chunks = data.get("documents", [])
    pdf_selected_count = len(req.pdfNames) if req.pdfNames else len(data.get("pdfMeta", []))

    allowed_indices = build_allowed_indices(data, req.pdfNames)
    if not allowed_indices:
        print(f"[QUIZ] allowed_indices is empty. pdfNames={req.pdfNames}, pdfMeta={data.get('pdfMeta', [])}")
        return {"error": "No documents found in this chat."}

    ranked_chunks, ranked_indices = await retrieve_relevant_chunks(app_state, chat_id, req, allowed_indices)
    if not ranked_chunks:
        return {
            "success": False,
            "error": "No document context available for quiz generation.",
        }

    print(
        f"[QUIZ] PDFs selected={pdf_selected_count} | total document chunks={len(all_chunks)} | "
        f"candidate chunks={len(allowed_indices)} | selected chunk candidates={len(ranked_chunks)} | model={GROQ_FAST_MODEL}"
    )

    prompt, selected_chunks, prompt_chars, estimated_tokens = prepare_prompt_with_limits(ranked_chunks, req)
    print(
        f"[QUIZ] prompt_chars={prompt_chars} | estimated_tokens={estimated_tokens} | "
        f"chunk_count={len(selected_chunks)} | selected_indices={ranked_indices[:len(selected_chunks)]}"
    )

    groq_result = await call_groq_quiz(prompt, model=GROQ_FAST_MODEL)
    if not groq_result["success"] and groq_result.get("error") == "TokenLimitError":
        print("[QUIZ] Token limit hit. Retrying with 50% less context.")
        retry_prompt, retry_chunks, retry_chars, retry_tokens = prepare_prompt_with_limits(
            ranked_chunks,
            req,
            reduction_factor=RETRY_CONTEXT_REDUCTION_FACTOR,
        )
        groq_result = await call_groq_quiz(retry_prompt, model=GROQ_FAST_MODEL)
        if not groq_result["success"]:
            groq_result["userMessage"] = (
                "Quiz generation exceeded the model context window even after reducing document context. "
                "Try selecting fewer PDFs or narrowing the topic."
            )

    if not groq_result["success"]:
        return groq_result

    quiz_data = parse_quiz_response(groq_result["content"])
    if is_structured_error(quiz_data):
        return quiz_data
    return quiz_data