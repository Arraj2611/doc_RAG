import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, Document as BeanieDocument
from typing import Optional, List, Dict, Any
from pydantic import Field
from datetime import datetime, timezone

# Configure logging
logger = logging.getLogger(__name__)

# MongoDB connection string from environment variable
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "docrag_db")

# MongoDB client instance
client: Optional[AsyncIOMotorClient] = None

# Models for MongoDB documents
class User(BeanieDocument):
    id: str = Field(default=None)
    username: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    hashed_password: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    preferences: Dict[str, Any] = Field(default_factory=dict)

    class Settings:
        name = "users"

class Document(BeanieDocument):
    id: str = Field(default=None)
    name: str
    user_id: str
    size: int
    type: str
    upload_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "uploaded"  # uploaded, processing, processed, error
    doc_type: str
    page_count: int = 0
    tenant_id: str
    processed: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Settings:
        name = "documents"

class ChatMessage(BeanieDocument):
    id: str = Field(default=None)
    session_id: str
    user_id: str
    sender: str  # "user" or "ai"
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    document_id: Optional[str] = None
    tenant_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Settings:
        name = "chat_messages"

class ChatSession(BeanieDocument):
    id: str = Field(default=None)
    user_id: str
    title: str
    document_id: Optional[str] = None
    document_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Settings:
        name = "chat_sessions"

# Initialize MongoDB connection
async def init_mongodb():
    global client
    try:
        logger.info(f"Connecting to MongoDB at {MONGODB_URI}")
        client = AsyncIOMotorClient(MONGODB_URI)

        # Initialize Beanie with the document models
        await init_beanie(
            database=client[MONGODB_DB_NAME],
            document_models=[
                User,
                Document,
                ChatMessage,
                ChatSession
            ]
        )

        logger.info("Connected to MongoDB successfully")
        return client
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise

# Close MongoDB connection
async def close_mongodb():
    global client
    if client:
        logger.info("Closing MongoDB connection")
        client.close()
        client = None

# Get MongoDB database
def get_database():
    global client
    if not client:
        raise RuntimeError("MongoDB client not initialized")
    return client[MONGODB_DB_NAME]

# User operations
async def create_user(user_data: dict) -> User:
    db = get_database()
    user_collection = db.users

    # Check if user already exists
    existing_user = await user_collection.find_one({"username": user_data["username"]})
    if existing_user:
        raise ValueError("Username already exists")

    # Create new user
    result = await user_collection.insert_one(user_data)
    user_data["id"] = str(result.inserted_id)

    return User(**user_data)

async def get_user_by_id(user_id: str) -> Optional[User]:
    db = get_database()
    user_collection = db.users

    user_data = await user_collection.find_one({"id": user_id})
    if user_data:
        return User(**user_data)
    return None

async def get_user_by_username(username: str) -> Optional[User]:
    db = get_database()
    user_collection = db.users

    user_data = await user_collection.find_one({"username": username})
    if user_data:
        return User(**user_data)
    return None

async def update_user_preferences(user_id: str, preferences: Dict[str, Any]) -> Optional[User]:
    """Update user preferences in the database."""
    db = get_database()
    user_collection = db.users

    # Merge new preferences with existing ones (ensure atomicity if needed)
    # For simple cases, $set might be sufficient
    update_doc = {
        "$set": {f"preferences.{key}": value for key, value in preferences.items()},
        "$currentDate": {"updated_at": True}
    }

    result = await user_collection.update_one(
        {"id": user_id},
        update_doc
    )

    if result.modified_count:
        # Return the updated user object
        return await get_user_by_id(user_id)
    elif result.matched_count: 
        # Matched but not modified (preferences were the same)
        return await get_user_by_id(user_id)
    else:
        # User not found
        logger.error(f"Attempted to update preferences for non-existent user ID: {user_id}")
        return None

# Document operations
async def create_document(document_data: dict) -> Document:
    db = get_database()
    document_collection = db.documents

    result = await document_collection.insert_one(document_data)
    document_data["id"] = str(result.inserted_id)

    return Document(**document_data)

async def get_documents_by_user_id(user_id: str) -> List[Document]:
    db = get_database()
    document_collection = db.documents

    cursor = document_collection.find({"user_id": user_id})
    documents = []
    async for doc in cursor:
        documents.append(Document(**doc))

    return documents

async def get_document_by_id(document_id: str) -> Optional[Document]:
    db = get_database()
    document_collection = db.documents

    document_data = await document_collection.find_one({"id": document_id})
    if document_data:
        return Document(**document_data)
    return None

async def update_document_status(document_id: str, status: str) -> Optional[Document]:
    db = get_database()
    document_collection = db.documents

    result = await document_collection.update_one(
        {"id": document_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}}
    )

    if result.modified_count:
        return await get_document_by_id(document_id)
    return None

# Chat operations
async def create_chat_session(session_data: dict) -> ChatSession:
    db = get_database()
    session_collection = db.chat_sessions

    result = await session_collection.insert_one(session_data)
    session_data["id"] = str(result.inserted_id)

    return ChatSession(**session_data)

async def get_chat_sessions_by_user_id(user_id: str) -> List[ChatSession]:
    db = get_database()
    session_collection = db.chat_sessions

    cursor = session_collection.find({"user_id": user_id}).sort("updated_at", -1)
    sessions = []
    async for session in cursor:
        sessions.append(ChatSession(**session))

    return sessions

async def get_chat_session_by_id(session_id: str) -> Optional[ChatSession]:
    db = get_database()
    session_collection = db.chat_sessions

    session_data = await session_collection.find_one({"id": session_id})
    if session_data:
        return ChatSession(**session_data)
    return None

async def add_chat_message(message_data: dict) -> ChatMessage:
    db = get_database()
    message_collection = db.chat_messages

    result = await message_collection.insert_one(message_data)
    message_data["id"] = str(result.inserted_id)

    # Update the session's updated_at timestamp
    session_collection = db.chat_sessions
    await session_collection.update_one(
        {"id": message_data["session_id"]},
        {"$set": {"updated_at": datetime.now(timezone.utc)}}
    )

    return ChatMessage(**message_data)

async def get_chat_messages_by_session_id(session_id: str) -> List[ChatMessage]:
    db = get_database()
    message_collection = db.chat_messages

    cursor = message_collection.find({"session_id": session_id}).sort("timestamp", 1)
    messages = []
    async for message in cursor:
        messages.append(ChatMessage(**message))

    return messages
