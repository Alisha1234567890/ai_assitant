import os
import shutil
import uuid
import traceback
import requests
import time
import hashlib
import asyncio
from typing import List, Dict, Any, Tuple
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request, BackgroundTasks
from datetime import datetime
from bson import ObjectId
from core.database import chat_collection, db
from models.schemas import AskRequest, SummaryRequest
from services.rag_service import (
    get_or_create_chat_data, retrieve_context, retrieve_context_async, call_groq, 
    call_groq_chat, chunk_text, get_embed_model
)
import graph_engine as ge

router = APIRouter(tags=["chat"])

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

def calculate_file_hash(file_content: bytes) -> str:
    return hashlib.sha256(file_content).hexdigest()

async def extract_text_from_file(file_content: bytes, filename: str, ext: str) -> Tuple[str, int, str]:
    """Extracts text and page count from file content."""
    from pypdf import PdfReader
    from docx import Document
    import pandas as pd
    import io

    text = ""
    page_count = 1
    
    if ext == ".pdf":
        try:
            reader = PdfReader(io.BytesIO(file_content))
            page_count = len(reader.pages)
            # Optimization: Join pages with space once at the end
            text_parts = []
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text_parts.append(extracted)
            text = " ".join(text_parts)
        except Exception as e:
            raise ValueError(f"PDF extraction failed: {str(e)}")
            
    elif ext == ".docx":
        try:
            doc = Document(io.BytesIO(file_content))
            text = "\n".join([para.text for para in doc.paragraphs])
        except Exception as e:
            raise ValueError(f"DOCX extraction failed: {str(e)}")
            
    elif ext == ".csv":
        try:
            df = pd.read_csv(io.BytesIO(file_content))
            text = df.to_string()
        except Exception as e:
            raise ValueError(f"CSV extraction failed: {str(e)}")
            
    elif ext in [".xlsx", ".xls"]:
        try:
            df = pd.read_excel(io.BytesIO(file_content))
            text = df.to_string()
        except Exception as e:
            raise ValueError(f"Excel extraction failed: {str(e)}")
            
    elif ext == ".txt":
        try:
            text = file_content.decode("utf-8", errors="ignore")
        except Exception as e:
            raise ValueError(f"Text file read failed: {str(e)}")
    
    return text, page_count, ext

@router.post("/upload")
async def upload_files(
    request: Request,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    chatId: str = Form(None),
    userId: str = Form("user123"),
):
    start_total = time.time()
    t_metrics = {}
    
    try:
        # 1. Validation and Chat Initialization
        allowed_exts = {".pdf", ".docx", ".csv", ".xlsx", ".xls", ".txt"}
        for f in files:
            ext = os.path.splitext(f.filename)[1].lower()
            if ext not in allowed_exts:
                return {"error": f"'{f.filename}' is not a supported file type."}

        current_chat_id = chatId
        if not current_chat_id or current_chat_id == "null" or not ObjectId.is_valid(current_chat_id):
            first_name = files[0].filename.replace(" ", "_")[:30]
            title = first_name if len(files) == 1 else f"{first_name} +{len(files)-1} more"
            result = await chat_collection.insert_one({
                "userId": userId,
                "title": title,
                "messages": [],
                "documents": [],
                "pdfs": [],
                "embeddings": [],
                "fileHashes": [], # Added for duplicate detection
                "pdfMeta": [],
                "graphPositions": {},
                "graphViewport": {"zoom": 1, "pan": {"x": 0, "y": 0}},
                "createdAt": datetime.now(),
            })
            current_chat_id = str(result.inserted_id)

        # 2. Load Chat Data (Optimized)
        t_load_start = time.time()
        chat_data = await get_or_create_chat_data(request.app.state, current_chat_id)
        t_metrics["load_chat_ms"] = int((time.time() - t_load_start) * 1000)

        # 3. Read and Hash Files in Parallel
        t_read_start = time.time()
        file_contents = await asyncio.gather(*[f.read() for f in files])
        file_hashes = [calculate_file_hash(content) for content in file_contents]
        t_metrics["read_hash_ms"] = int((time.time() - t_read_start) * 1000)

        existing_hashes = set(chat_data.get("fileHashes", []))
        succeeded = []
        failed = []
        
        # Track what needs processing
        to_process = [] # List of (content, filename, ext, hash)
        
        for i, file in enumerate(files):
            file_hash = file_hashes[i]
            safe_name = file.filename.replace(" ", "_")
            ext = os.path.splitext(safe_name)[1].lower()
            
            if file_hash in existing_hashes:
                # Duplicate detection - return cached info if available in pdfMeta
                meta = next((m for m in chat_data.get("pdfMeta", []) if m.get("hash") == file_hash), None)
                if meta:
                    succeeded.append({
                        "name": safe_name,
                        "pages": meta.get("pages"),
                        "chunks": meta.get("chunkCount"),
                        "type": meta.get("type"),
                        "uploadedAt": meta.get("uploadedAt"),
                        "status": "cached"
                    })
                    continue
            
            to_process.append((file_contents[i], safe_name, ext, file_hash))

        # 4. Text Extraction and Chunking (Parallelized)
        if to_process:
            t_extract_start = time.time()
            extraction_results = await asyncio.gather(*[
                extract_text_from_file(content, name, ext) for content, name, ext, h in to_process
            ], return_exceptions=True)
            t_metrics["extraction_ms"] = int((time.time() - t_extract_start) * 1000)

            all_new_chunks = []
            file_processing_info = [] # (name, pages, start_idx, count, type, hash)
            
            t_chunk_start = time.time()
            for i, (content, name, ext, f_hash) in enumerate(to_process):
                res = extraction_results[i]
                if isinstance(res, Exception):
                    failed.append({"name": name, "error": str(res)})
                    continue
                
                text, pages, final_ext = res
                if not text.strip():
                    failed.append({"name": name, "error": "No readable text found"})
                    continue
                
                chunks = chunk_text(text)
                if not chunks:
                    failed.append({"name": name, "error": "Chunking produced no results"})
                    continue
                
                start_idx = len(chat_data["documents"]) + len(all_new_chunks)
                file_processing_info.append({
                    "name": name,
                    "pages": pages,
                    "chunkStart": start_idx,
                    "chunkCount": len(chunks),
                    "type": final_ext.strip("."),
                    "hash": f_hash,
                    "chunks": chunks
                })
                all_new_chunks.extend(chunks)
            t_metrics["chunking_ms"] = int((time.time() - t_chunk_start) * 1000)

            # 5. Batch Embedding Generation (Single Call)
            if all_new_chunks:
                t_embed_start = time.time()
                import numpy as np
                import anyio
                import faiss
                
                # Use thread pool for CPU-bound embedding
                new_embs = await anyio.to_thread.run_sync(
                    lambda: np.array(get_embed_model().encode(all_new_chunks, show_progress_bar=False)).astype("float32")
                )
                
                if chat_data["index"] is None:
                    chat_data["index"] = faiss.IndexFlatL2(new_embs.shape[1])
                chat_data["index"].add(new_embs)
                
                chat_data["documents"].extend(all_new_chunks)
                t_metrics["embedding_ms"] = int((time.time() - t_embed_start) * 1000)

                # 6. Database Update (Single Bulk-ish Update)
                t_db_start = time.time()
                uploaded_at = datetime.now()
                
                embeddings_list = new_embs.tolist()
                
                # Prepare updates
                new_pdf_meta = []
                new_pdfs = []
                new_hashes = []
                
                for info in file_processing_info:
                    meta = {
                        "name": info["name"],
                        "chunkStart": info["chunkStart"],
                        "chunkCount": info["chunkCount"],
                        "pages": info["pages"],
                        "type": info["type"],
                        "hash": info["hash"],
                        "uploadedAt": uploaded_at
                    }
                    new_pdf_meta.append(meta)
                    new_pdfs.append(info["name"])
                    new_hashes.append(info["hash"])
                    
                    # Update local cache
                    if "pdfMeta" not in chat_data: chat_data["pdfMeta"] = []
                    chat_data["pdfMeta"].append(meta)
                    chat_data["pdfs"].append(info["name"])
                    if "fileHashes" not in chat_data: chat_data["fileHashes"] = []
                    chat_data["fileHashes"].append(info["hash"])
                    
                    succeeded.append({
                        "name": info["name"],
                        "pages": info["pages"],
                        "chunks": info["chunkCount"],
                        "type": info["type"],
                        "uploadedAt": uploaded_at.isoformat()
                    })

                await chat_collection.update_one(
                    {"_id": ObjectId(current_chat_id)},
                    {
                        "$push": {
                            "documents": {"$each": all_new_chunks},
                            "pdfs": {"$each": new_pdfs},
                            "embeddings": {"$each": embeddings_list},
                            "pdfMeta": {"$each": new_pdf_meta},
                            "fileHashes": {"$each": new_hashes}
                        }
                    }
                )
                
                # 7. Background Tasks (Graph Building)
                for info in file_processing_info:
                    from routers.graph import _build_pdf_graph_for_chat
                    background_tasks.add_task(_build_pdf_graph_for_chat, current_chat_id, info["name"], info["chunks"])
                
                t_metrics["db_update_ms"] = int((time.time() - t_db_start) * 1000)

        # 8. Final Response
        t_metrics["total_ms"] = int((time.time() - start_total) * 1000)
        print(f"[UPLOAD] Success: {len(succeeded)} files, Failed: {len(failed)} files. Metrics: {t_metrics}")

        # Return merged graph (from background or last state)
        from routers.graph import _get_merged_graph_payload
        merged = await _get_merged_graph_payload(current_chat_id)

        return {
            "chatId": current_chat_id,
            "uploaded": succeeded,
            "failed": failed,
            "total_files": len(files),
            "success_count": len(succeeded),
            "total_chunks": len(chat_data["documents"]),
            "graph": merged,
            "metrics": t_metrics
        }
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}


@router.post("/ask")
async def ask(request: Request, req: AskRequest):
    try:
        if not req.chatId or not ObjectId.is_valid(req.chatId):
            result = await chat_collection.insert_one({
                "userId": req.userId,
                "title": req.question[:40],
                "messages": [],
                "documents": [],
                "pdfs": [],
                "knowledgeMaps": [],
                "pdfGraphs": [],
                "pdfMeta": [],
                "graphPositions": {},
                "graphViewport": {"zoom": 1, "pan": {"x": 0, "y": 0}},
                "createdAt": datetime.now(),
            })
            req.chatId = str(result.inserted_id)

        chat_doc = await chat_collection.find_one({"_id": ObjectId(req.chatId)})
        raw_msgs = (chat_doc or {}).get("messages", [])
        history = [
            {"role": "user" if m["role"] == "user" else "assistant", "content": m["text"]}
            for m in raw_msgs
        ]

        if req.mode == "chat":
            answer = await call_groq_chat(req.question, history, custom_system=req.systemPrompt)
        else:
            chat_data = await get_or_create_chat_data(request.app.state, req.chatId)
            if not chat_data or not chat_data["documents"]:
                answer = "⚠️ No document uploaded yet. Please upload a PDF first, or switch to Chat mode."
            else:
                context = await retrieve_context_async(request.app.state, req.question, req.chatId)
                if not context:
                    answer = "⚠️ No relevant content found. Try rephrasing your question."
                else:
                    answer = await call_groq(context, req.question, history, custom_system=req.systemPrompt)

        await chat_collection.update_one(
            {"_id": ObjectId(req.chatId)},
            {"$push": {"messages": {"$each": [
                {"role": "user", "text": req.question},
                {"role": "bot", "text": answer},
            ]}}},
        )
        return {"answer": answer, "chatId": req.chatId}
    except Exception as e:
        traceback.print_exc()
        return {"answer": f"❌ Backend error: {str(e)}", "chatId": req.chatId}

@router.post("/chat/summary")
async def chat_summary(req: SummaryRequest):
    chat = await chat_collection.find_one({"_id": ObjectId(req.chatId)})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    messages = chat.get("messages", [])
    if not messages:
        return {"summary": "No messages to summarize."}
    
    history_text = "\n".join([f"{m['role'].upper()}: {m['text']}" for m in messages])
    
    prompt = (
        "Please provide a concise, professional summary of the following chat conversation. "
        "Highlight the main topics discussed, any decisions made, and key takeaways. "
        "Keep it under 300 words and use a professional report style.\n\n"
        f"CONVERSATION:\n{history_text}"
    )
    
    summary = await call_groq_chat(prompt, [], "You are a professional report generator.")
    return {"summary": summary}

@router.get("/chats/{userId}")
async def get_chats(userId: str):
    try:
        cursor = chat_collection.find({"userId": userId}).sort("createdAt", -1)
        chats = []
        async for doc in cursor:
            chats.append({
                "id": str(doc["_id"]),
                "title": doc.get("title", "Untitled Chat"),
                "pdfCount": len(doc.get("pdfs", [])),
                "createdAt": doc.get("createdAt").isoformat() if doc.get("createdAt") else None
            })
        return {"chats": chats}
    except Exception as e:
        print(f"[CHATS] Error: {e}")
        return {"chats": []}

@router.get("/chat/{id}")
async def get_chat(id: str):
    try:
        if not ObjectId.is_valid(id):
            raise HTTPException(status_code=400, detail="Invalid Chat ID")
        doc = await chat_collection.find_one({"_id": ObjectId(id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Format knowledge maps for frontend
        from routers.graph import _serialize_knowledge_maps
        kmaps = _serialize_knowledge_maps(doc.get("knowledgeMaps", []))

        # Format pdfMeta for frontend (handling datetime serialization)
        pdf_meta = []
        for m in doc.get("pdfMeta", []):
            entry = {
                "name": m.get("name"),
                "pages": m.get("pages"),
                "type": m.get("type"),
                "uploadedAt": m.get("uploadedAt").isoformat() if isinstance(m.get("uploadedAt"), datetime) else m.get("uploadedAt")
            }
            pdf_meta.append(entry)
        
        return {
            "id": str(doc["_id"]),
            "title": doc.get("title"),
            "messages": doc.get("messages", []),
            "pdfs": doc.get("pdfs", []), # Keep this for compatibility if needed, but we'll use meta
            "pdfMeta": pdf_meta,
            "knowledgeMaps": kmaps,
        }
    except Exception as e:
        print(f"[CHAT] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/chat/{id}")
async def clear_chat(id: str):
    try:
        if not ObjectId.is_valid(id):
            return {"error": "Invalid ID"}
        await chat_collection.update_one(
            {"_id": ObjectId(id)},
            {"$set": {"messages": [], "knowledgeMaps": [], "pdfGraphs": []}}
        )
        return {"status": "cleared"}
    except Exception as e:
        return {"error": str(e)}

@router.delete("/delete/{id}")
async def delete_chat(id: str):
    try:
        if not ObjectId.is_valid(id):
            return {"error": "Invalid ID"}
        await chat_collection.delete_one({"_id": ObjectId(id)})
        return {"status": "deleted"}
    except Exception as e:
        return {"error": str(e)}
