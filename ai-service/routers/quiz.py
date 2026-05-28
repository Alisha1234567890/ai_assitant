import uuid
import traceback
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime
from bson import ObjectId
from core.database import db, chat_collection
from models.schemas import QuizRequest, QuizScoreSaveRequest
from services.quiz_service import generate_quiz_from_docs, extract_topics_from_chunks

router = APIRouter(prefix="/quiz", tags=["quiz"])

# New collection for quiz history
quiz_history_collection = db["quiz_history"]

@router.post("/generate")
async def generate_quiz(request: Request, req: QuizRequest):
    try:
        print(f"[QUIZ] Generating quiz for chatId: {req.chatId}, difficulty: {req.difficulty}, count: {req.count}")
        quiz_data = await generate_quiz_from_docs(request.app.state, req)
        
        if "error" in quiz_data:
            print(f"[QUIZ] Generation failed for chatId {req.chatId}: {quiz_data['error']}")
            # Return structured error instead of just raising 400
            return {
                 "success": False,
                 "error": quiz_data["error"],
                 "details": quiz_data.get("details"),
                 "raw": quiz_data.get("raw") if getattr(request.app, "debug", False) else None
             }
        
        # Add a unique ID for this session
        quiz_data["quizId"] = str(uuid.uuid4())
        quiz_data["chatId"] = req.chatId
        quiz_data["difficulty"] = req.difficulty
        quiz_data["success"] = True
        
        print(f"[QUIZ] Successfully generated quiz '{quiz_data.get('quizTitle')}' for chatId: {req.chatId}")
        return quiz_data
    except HTTPException:
        # Re-raise HTTPExceptions so they aren't caught by the general Exception block
        raise
    except Exception as e:
        print(f"[QUIZ] Internal error during generation: {str(e)}")
        traceback.print_exc()
        return {
            "success": False,
            "error": "Internal Server Error during quiz generation",
            "details": str(e)
        }

@router.post("/save-score")
async def save_quiz_score(req: QuizScoreSaveRequest):
    try:
        doc = {
            "quizId": req.quizId,
            "chatId": req.chatId,
            "userId": req.userId,
            "quizTitle": req.quizTitle,
            "difficulty": req.difficulty,
            "score": req.score,
            "total": req.total,
            "answers": req.answers,
            "createdAt": datetime.utcnow()
        }
        await quiz_history_collection.insert_one(doc)
        return {"status": "saved", "id": str(doc.get("_id"))}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{chatId}")
async def get_quiz_history(chatId: str):
    try:
        cursor = quiz_history_collection.find({"chatId": chatId}).sort("createdAt", -1)
        history = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            history.append(doc)
        return {"history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/topics/{chatId}")
async def get_quiz_topics(request: Request, chatId: str):
    try:
        if chatId not in request.app.state.chat_data:
            # Try to load if not in memory
            from services.rag_service import get_or_create_chat_data
            await get_or_create_chat_data(request.app.state, chatId)
        
        data = request.app.state.chat_data.get(chatId)
        if not data or not data.get("documents"):
            return {"topics": []}
            
        topics = await extract_topics_from_chunks(data["documents"])
        return {"topics": topics}
    except Exception as e:
        traceback.print_exc()
        return {"topics": []}
