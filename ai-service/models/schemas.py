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
