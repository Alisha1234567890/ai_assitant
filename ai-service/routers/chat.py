import os
import shutil
import uuid
import traceback
import requests
from typing import List
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from datetime import datetime
from bson import ObjectId
from pypdf import PdfReader
from docx import Document
import pandas as pd
import io
from core.database import chat_collection, db
from models.schemas import AskRequest, SummaryRequest
from services.rag_service import (
    get_or_create_chat_data, retrieve_context, call_groq, 
    call_groq_chat, chunk_text, get_embed_model
)
import graph_engine as ge

router = APIRouter(tags=["chat"])

UPLOAD_DIR = "uploads"

async def process_single_file(file: UploadFile, current_chat_id: str, chat_data: dict) -> dict:
    safe_name = file.filename.replace(" ", "_")
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    ext = os.path.splitext(safe_name)[1].lower()

    # Save to disk
    with open(file_path, "wb") as buf:
        shutil.copyfileobj(file.file, buf)

    text = ""
    page_count = 1

    try:
        if ext == ".pdf":
            reader = PdfReader(file_path)
            page_count = len(reader.pages)
            for i, page in enumerate(reader.pages):
                text += (page.extract_text() or "") + " "
        elif ext == ".docx":
            doc = Document(file_path)
            text = "\n".join([para.text for para in doc.paragraphs])
        elif ext == ".csv":
            df = pd.read_csv(file_path)
            text = df.to_string()
        elif ext in [".xlsx", ".xls"]:
            df = pd.read_excel(file_path)
            text = df.to_string()
        elif ext == ".txt":
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        else:
            return {"name": safe_name, "error": f"Unsupported file type: {ext}"}
    except Exception as e:
        print(f"[UPLOAD] Error processing {safe_name}: {e}")
        return {"name": safe_name, "error": f"Failed to process file: {str(e)}"}

    if not text.strip():
        return {"name": safe_name, "error": "No readable text found in file"}

    chunks = chunk_text(text)
    if not chunks:
        return {"name": safe_name, "error": "Chunking produced no results"}

    import numpy as np
    import faiss
    import anyio
    new_emb = await anyio.to_thread.run_sync(lambda: np.array(get_embed_model().encode(chunks)).astype("float32"))

    if chat_data["index"] is None:
        chat_data["index"] = faiss.IndexFlatL2(new_emb.shape[1])

    chat_data["index"].add(new_emb)
    start_idx = len(chat_data["documents"])
    chat_data["documents"].extend(chunks)
    chat_data["pdfs"].append(safe_name)

    uploaded_at = datetime.utcnow()
    await chat_collection.update_one(
        {"_id": ObjectId(current_chat_id)},
        {
            "$push": {
                "documents": {"$each": chunks},
                "pdfs": safe_name,
                "pdfMeta": {
                    "name": safe_name,
                    "chunkStart": start_idx,
                    "chunkCount": len(chunks),
                    "pages": page_count,
                    "type": ext.strip("."),
                    "uploadedAt": uploaded_at
                },
            }
        },
    )

    return {
        "name": safe_name,
        "pages": page_count,
        "chunks": len(chunks),
        "type": ext.strip("."),
        "uploadedAt": uploaded_at.isoformat(),
        "_chunkTexts": chunks,
    }

@router.post("/upload")
async def upload_files(
    request: Request,
    files: List[UploadFile] = File(...),
    chatId: str = Form(None),
    userId: str = Form("user123"),
):
    try:
        allowed_exts = {".pdf", ".docx", ".csv", ".xlsx", ".xls", ".txt"}
        for f in files:
            ext = os.path.splitext(f.filename)[1].lower()
            if ext not in allowed_exts:
                return {"error": f"'{f.filename}' is not a supported file type. Allowed: {', '.join(allowed_exts)}"}

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
                "knowledgeMaps": [],
                "pdfGraphs": [],
                "pdfMeta": [],
                "graphPositions": {},
                "graphViewport": {"zoom": 1, "pan": {"x": 0, "y": 0}},
                "createdAt": datetime.utcnow(),
            })
            current_chat_id = str(result.inserted_id)

        chat_data = await get_or_create_chat_data(request.app.state, current_chat_id)
        
        succeeded = []
        failed = []
        for file in files:
            res = await process_single_file(file, current_chat_id, chat_data)
            if "error" in res:
                failed.append({k: v for k, v in res.items() if not k.startswith("_")})
            else:
                chunk_texts = res.pop("_chunkTexts", [])
                # build graph cluster for the new file
                from routers.graph import _build_pdf_graph_for_chat
                await _build_pdf_graph_for_chat(current_chat_id, res["name"], chunk_texts)
                succeeded.append(res)

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
                "createdAt": datetime.utcnow(),
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
