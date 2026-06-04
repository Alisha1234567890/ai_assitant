import os
import json
import math
import httpx
import anyio
from typing import Any, List, Optional, Dict, Union

# Groq Config
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
# Using a slightly faster model for better performance if possible
# llama-3.3-70b-versatile is good but large. llama-3.1-8b-instant is much faster.
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_FAST_MODEL = os.getenv("GROQ_FAST_MODEL", "llama-3.1-8b-instant")

_http_client = None

def get_http_client():
    global _http_client
    if _http_client is None:
        # Increased timeout for complex reasoning tasks
        _http_client = httpx.AsyncClient(timeout=90.0)
    return _http_client

async def close_http_client():
    global _http_client
    if _http_client:
        await _http_client.aclose()
        _http_client = None

def estimate_tokens(text: str) -> int:
    """Simple heuristic for token budgeting: ~4 chars per token."""
    if not text:
        return 0
    return max(1, math.ceil(len(text) / 4))

def is_token_limit_error(error_msg: str, status_code: int) -> bool:
    """Checks if the error is related to token/context limits."""
    if status_code == 413:
        return True
    if not error_msg:
        return False
    msg = error_msg.lower()
    return any(term in msg for term in ["request too large", "context length", "token limit", "rate limit"])

async def call_groq_efficient(
    messages: List[Dict[str, str]],
    model: str = None,
    temperature: float = 0.2,
    max_tokens: int = 1024,
    response_format: Optional[Dict[str, str]] = None,
    retries: int = 1
) -> Dict[str, Any]:
    """
    Centralized efficient Groq caller with token management and retry logic.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {"success": False, "error": "Configuration Error", "details": "GROQ_API_KEY not set"}

    selected_model = model or GROQ_FAST_MODEL
    
    # Estimate total tokens in prompt
    total_prompt_text = "".join([m.get("content", "") for m in messages])
    estimated_tokens = estimate_tokens(total_prompt_text)
    
    # Heuristic: if prompt is very large, consider using a model with larger context if needed, 
    # but here we focus on efficiency so we just warn or handle 413 later.
    
    payload = {
        "model": selected_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "top_p": 0.9,
    }
    
    if response_format:
        payload["response_format"] = response_format

    client = get_http_client()
    
    for attempt in range(retries + 1):
        try:
            print(f"[GROQ] Calling {selected_model} (Attempt {attempt+1}, Est. Tokens: {estimated_tokens})...")
            resp = await client.post(
                GROQ_API_URL,
                json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
            data = resp.json()

            if resp.status_code == 200:
                content = data["choices"][0]["message"]["content"]
                return {
                    "success": True, 
                    "content": content, 
                    "model": selected_model,
                    "usage": data.get("usage", {})
                }
            
            error_info = data.get("error", {})
            error_msg = error_info.get("message", "Unknown error")
            status_code = resp.status_code
            
            print(f"[GROQ] Error {status_code}: {error_msg}")
            
            # If token limit hit and we have retries left, we return the error so the caller can reduce context
            if is_token_limit_error(error_msg, status_code) and attempt < retries:
                print(f"[GROQ] Token limit hit on {selected_model}. Signaling retry...")
                return {"success": False, "error": "TokenLimitError", "details": error_msg, "status_code": status_code}
            
            return {"success": False, "error": "Groq API Error", "details": error_msg, "status_code": status_code}

        except Exception as e:
            print(f"[GROQ] Exception: {str(e)}")
            if attempt < retries:
                await anyio.sleep(1) # Small backoff
                continue
            return {"success": False, "error": "Connection Error", "details": str(e)}

    return {"success": False, "error": "Max retries exceeded", "details": "Failed after multiple attempts"}
