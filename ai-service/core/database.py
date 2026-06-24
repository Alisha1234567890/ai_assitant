import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
# Optimized MongoDB client for performance
# - minPoolSize: ensures connections are ready to go
# - maxPoolSize: prevents resource exhaustion while allowing concurrency
# - waitQueueTimeoutMS: prevents requests from hanging forever
client = AsyncIOMotorClient(
    MONGO_URL, 
    serverSelectionTimeoutMS=5000,
    minPoolSize=5,
    maxPoolSize=50,
    waitQueueTimeoutMS=2500
)
db = client["ai_doc_db"]

chat_collection = db["chats"]
users_collection = db["users"]

JWT_SECRET = os.getenv("JWT_SECRET", "docchat-dev-secret-change-in-production")
JWT_ALGO = "HS256"
JWT_EXPIRE_DAYS = 7

async def init_db():
    try:
        # Masked MONGO_URL for logging
        masked_url = MONGO_URL
        if MONGO_URL and "@" in MONGO_URL:
            parts = MONGO_URL.split("@")
            masked_url = f"{parts[0].split(':')[0]}:***@{parts[1]}"
        print(f"[DB] Initializing connection to: {masked_url}")
        
        # Check connection with a quick ping
        await client.admin.command('ping')
        
        # Create indexes on startup
        await users_collection.create_index("email", unique=True)
        print("[DB] MongoDB connected and indexes verified")
    except Exception as e:
        print(f"[DB] MongoDB connection error: {e}")
