from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class AskRequest(BaseModel):
    question: str
    userId: str
    chatId: Optional[str] = None
    systemPrompt: Optional[str] = None
    mode: str = "rag"

class KnowledgeMapRequest(BaseModel):
    question: str
    answer: Optional[str] = None
    userId: Optional[str] = None
    chatId: Optional[str] = None
    mode: str = "rag"
    regenerate: bool = False

class SignupRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)
    name: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class GraphPositionsRequest(BaseModel):
    positions: Dict[str, Any]
    viewport: Optional[Dict[str, Any]] = None
    layoutComputed: bool = True

class GraphBuildRequest(BaseModel):
    chatId: str
    pdfName: Optional[str] = None
    force: bool = False

class SummaryRequest(BaseModel):
    chatId: str
    userId: str

class QuizRequest(BaseModel):
    chatId: str
    userId: str
    difficulty: str = "medium" # easy, medium, hard
    topic: Optional[str] = None
    pdfNames: Optional[List[str]] = None # New: Filter by specific files
    count: int = 5
    types: List[str] = ["mcq", "true_false", "fill_blank"]

class QuizScoreSaveRequest(BaseModel):
    quizId: str
    chatId: str
    userId: str
    quizTitle: str # New
    difficulty: str # New
    score: int
    total: int
    answers: List[Dict[str, Any]]
