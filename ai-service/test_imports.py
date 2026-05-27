import fastapi
import uvicorn
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import motor
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

print("All imports successful!")

load_dotenv()
print(f"MONGO_URL: {os.getenv('MONGO_URL')}")
print(f"GROQ_API_KEY: {os.getenv('GROQ_API_KEY')}")

print("Attempting to load SentenceTransformer model...")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("Model loaded successfully!")
