import traceback
from fastapi import APIRouter, HTTPException, Header
from datetime import datetime
from bson import ObjectId
from core.database import users_collection
from models.schemas import SignupRequest, LoginRequest
from utils.auth_utils import (
    normalize_email, hash_password, verify_password, 
    create_access_token, user_public, decode_bearer_token
)

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/signup")
async def auth_signup(req: SignupRequest):
    try:
        email = normalize_email(req.email)
        if "@" not in email or "." not in email.split("@")[-1]:
            raise HTTPException(status_code=400, detail="Enter a valid email address")

        try:
            existing = await users_collection.find_one({"email": email})
        except Exception as e:
            print(f"[AUTH] Database error during signup check: {e}")
            raise HTTPException(status_code=503, detail="Database connection error. Please try again later.")

        if existing:
            raise HTTPException(status_code=400, detail="An account with this email already exists")

        doc = {
            "email": email,
            "passwordHash": hash_password(req.password),
            "name": (req.name or "").strip() or email.split("@")[0],
            "createdAt": datetime.utcnow(),
        }
        
        try:
            result = await users_collection.insert_one(doc)
        except Exception as e:
            print(f"[AUTH] Database error during user creation: {e}")
            raise HTTPException(status_code=500, detail="Failed to create user account.")

        user_id = str(result.inserted_id)
        token = create_access_token(user_id, email)
        return {"token": token, "user": user_public({**doc, "_id": result.inserted_id})}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH] Unexpected signup error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")

@router.post("/login")
async def auth_login(req: LoginRequest):
    try:
        email = normalize_email(req.email)
        
        try:
            user = await users_collection.find_one({"email": email})
        except Exception as e:
            print(f"[AUTH] Database error during login: {e}")
            raise HTTPException(status_code=503, detail="Database connection error.")

        if not user or not verify_password(req.password, user["passwordHash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        user_id = str(user["_id"])
        token = create_access_token(user_id, email)
        return {"token": token, "user": user_public(user)}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH] Unexpected login error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Login failed due to an internal error.")

@router.get("/me")
async def auth_me(authorization: str | None = Header(None)):
    payload = decode_bearer_token(authorization)
    user = await users_collection.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"user": user_public(user)}
