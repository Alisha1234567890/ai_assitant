import os
import json
import random
import re
from typing import List, Dict, Any
from services.rag_service import call_groq_chat, GROQ_MODEL, GROQ_FAST_MODEL, GROQ_API_URL

async def extract_topics_from_chunks(chunks: List[str]) -> List[str]:
    """Simple topic extraction by looking for common nouns/entities in chunks."""
    # This is a placeholder for more complex topic extraction
    # For now, we'll just return a few generic topics or use LLM to extract
    combined_text = " ".join(chunks[:10])
    prompt = (
        "Extract 5-7 key topics or themes from the following text. "
        "Return them as a simple comma-separated list of short titles.\n\n"
        f"TEXT:\n{combined_text}"
    )
    # Use the fast model for topic extraction
    resp = await call_groq_chat(prompt, [], "You are a topic extractor.", model=GROQ_FAST_MODEL)
    topics = [t.strip() for t in resp.split(",") if t.strip()]
    return topics[:8]

def generate_quiz_prompt(chunks: List[str], req: Any) -> str:
    context = "\n\n---\n\n".join(chunks)
    types_str = ", ".join(req.types)
    
    prompt = (
        f"Generate a {req.difficulty} difficulty quiz with {req.count} questions based strictly on the provided context. "
        f"Include these question types: {types_str}. "
        "IMPORTANT: Your response must be ONLY a valid JSON object. Do not include any introductory or concluding text. "
        "The JSON MUST be parseable by json.loads() in Python.\n\n"
        "JSON STRUCTURE:\n"
        "{\n"
        "  \"quizTitle\": \"A descriptive title for the quiz\",\n"
        "  \"questions\": [\n"
        "    {\n"
        "      \"id\": \"q1\",\n"
        "      \"type\": \"mcq|true_false|fill_blank\",\n"
        "      \"question\": \"The question text\",\n"
        "      \"options\": [\"Option A\", \"Option B\", \"Option C\", \"Option D\"], // Use this ONLY for mcq and true_false types\n"
        "      \"correctAnswer\": \"The exact correct answer\",\n"
        "      \"explanation\": \"A brief explanation of why this is correct\",\n"
        "      \"sourceReference\": \"A short snippet from the text as reference\"\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        f"CONTEXT:\n{context}\n\n"
        "STRICT RULES:\n"
        "1. For true_false, options must be ['True', 'False'].\n"
        "2. For fill_blank, do not provide options. The correctAnswer should be the word/phrase to fill.\n"
        "3. Ensure the difficulty level matches the request.\n"
        "4. DO NOT include any text other than the JSON object itself. No markdown formatting like ```json ... ```.\n"
        "5. Ensure all quotes inside strings are properly escaped with backslashes.\n"
        "6. Return ONLY the JSON object."
    )
    return prompt

def parse_quiz_response(raw_resp: str) -> Dict[str, Any]:
    """Safely extract and parse JSON from the LLM response."""
    text = raw_resp.strip()
    
    # 1. Try to find JSON block using regex if LLM included conversational text or markdown
    json_match = re.search(r"(\{[\s\S]*\})", text)
    if json_match:
        text = json_match.group(1)
    
    # 2. Basic cleanup
    text = text.replace("```json", "").replace("```", "").strip()
    
    try:
        # 3. Standard parse
        data = json.loads(text)
        print(f"[QUIZ] Successfully parsed quiz with {len(data.get('questions', []))} questions")
        return data
    except json.JSONDecodeError as e:
        print(f"[QUIZ] JSON Parse Error (Initial): {e}\nOffset: {e.pos}, Line: {e.lineno}, Col: {e.colno}")
        
        # 4. Attempt aggressive cleanup for common LLM errors (trailing commas, unescaped quotes)
        try:
            # Remove trailing commas before closing braces/brackets
            cleaned = re.sub(r",\s*([\]\}])", r"\1", text)
            # Try to fix some common escaping issues if possible (risky)
            # cleaned = cleaned.replace('\\"', '"').replace('"', '\\"') # This might be too aggressive
            
            data = json.loads(cleaned)
            print("[QUIZ] Successfully parsed quiz after aggressive cleanup")
            return data
        except Exception as e2:
            print(f"[QUIZ] Aggressive Parsing Failed: {e2}")
            return {
                "error": "Failed to parse quiz JSON. The AI response was not in a valid format.",
                "details": str(e),
                "raw": raw_resp
            }
    except Exception as e:
        print(f"[QUIZ] Unexpected Parsing Error: {e}")
        return {"error": f"Unexpected error during quiz parsing: {str(e)}", "raw": raw_resp}

async def generate_quiz_from_docs(app_state, req: Any):
    chat_id = req.chatId
    
    # Ensure chat data is in memory
    if chat_id not in app_state.chat_data:
        from services.rag_service import get_or_create_chat_data
        await get_or_create_chat_data(app_state, chat_id)
    
    data = app_state.chat_data.get(chat_id)
    if not data or not data.get("documents"):
        return {"error": "No documents found in this chat. Please upload files first."}
    
    all_chunks = data.get("documents", [])
    
    # Filter by specific files if provided
    target_chunks = all_chunks
    if req.pdfNames and len(req.pdfNames) > 0:
        target_chunks = []
        pdf_meta_list = data.get("pdfMeta", [])
        for meta in pdf_meta_list:
            if meta.get("name") in req.pdfNames:
                start = meta.get("chunkStart", 0)
                count = meta.get("chunkCount", 0)
                target_chunks.extend(all_chunks[start : start + count])
        
        if not target_chunks:
            # Fallback if names didn't match or meta was missing
            target_chunks = all_chunks

    if not target_chunks:
        return {"error": "No documents found in this chat."}

    # Select chunks: if topic is provided, filter or search. 
    # For now, we'll take a random sample to cover the document broadly.
    # Reducing sample size slightly to speed up processing
    sample_size = min(len(target_chunks), 12)
    selected_chunks = random.sample(target_chunks, sample_size)
    
    prompt = generate_quiz_prompt(selected_chunks, req)
    # Using a faster model for quiz generation to improve speed
    raw_resp = await call_groq_chat(prompt, [], "You are a professional quiz generator.", model=GROQ_FAST_MODEL)
    
    quiz_data = parse_quiz_response(raw_resp)
    return quiz_data
