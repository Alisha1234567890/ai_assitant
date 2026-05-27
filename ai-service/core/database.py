import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
db = client["ai_doc_db"]

chat_collection = db["chats"]
users_collection = db["users"]

JWT_SECRET = os.getenv("JWT_SECRET", "docchat-dev-secret-change-in-production")
JWT_ALGO = "HS256"
JWT_EXPIRE_DAYS = 7

async def init_db():
    try:
        # Create indexes on startup
        await users_collection.create_index("email", unique=True)
        print("[DB] MongoDB connected and indexes verified")
    except Exception as e:
        print(f"[DB] MongoDB connection error: {e}")
