import os
import logging
from typing import List, Dict, Optional, Any
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection
from pymongo.errors import ConnectionFailure, OperationFailure
from dotenv import load_dotenv
from datetime import datetime
from bson import ObjectId

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
MONGO_CONNECTION_STRING = os.getenv("MONGO_CONNECTION_STRING")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "doc_rag_db") # Default DB name if not set

# Collection Names
DOCUMENTS_COLLECTION = "documents"
HISTORY_COLLECTION = "chat_history"
INSIGHTS_COLLECTION = "insights"
USERS_COLLECTION = "users"

# Logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Global client and db instances (initialized by connect_to_mongo) ---
_client: Optional[MongoClient] = None
_db: Optional[Database] = None

def connect_to_mongo() -> Optional[Database]:
    """Establishes a connection to MongoDB using credentials from environment variables."""
    global _client, _db
    if _db:
        # logger.info("MongoDB connection already established.")
        return _db

    if not MONGO_CONNECTION_STRING:
        logger.error("MONGO_CONNECTION_STRING environment variable not set.")
        return None

    try:
        logger.info(f"Attempting to connect to MongoDB (DB: {MONGO_DB_NAME})...")
        _client = MongoClient(MONGO_CONNECTION_STRING)
        # The ismaster command is cheap and does not require auth.
        _client.admin.command('ismaster')
        _db = _client[MONGO_DB_NAME]
        logger.info("MongoDB connection successful.")
        return _db
    except ConnectionFailure as e:
        logger.error(f"MongoDB connection failed: {e}")
        _client = None
        _db = None
        return None
    except Exception as e:
        logger.error(f"An unexpected error occurred during MongoDB connection: {e}")
        _client = None
        _db = None
        return None

def get_db() -> Optional[Database]:
    """Returns the database instance, attempting to connect if not already connected."""
    # Check explicitly for None instead of using truthiness
    return _db if _db is not None else connect_to_mongo()

def close_mongo_connection():
    """Closes the MongoDB connection if it's open."""
    global _client, _db
    if _client:
        logger.info("Closing MongoDB connection.")
        _client.close()
        _client = None
        _db = None

# --- CRUD Operations ---

def save_document_metadata(session_id: str, filename: str, user_id: Optional[str] = None, **kwargs) -> bool:
    """Saves document metadata to the database."""
    db = get_db()
    if db is None:
        return False
    try:
        documents_collection: Collection = db[DOCUMENTS_COLLECTION]
        result = documents_collection.update_one(
            {"session_id": session_id},
            {"$set": {"session_id": session_id, "filename": filename, "user_id": user_id, **kwargs}},
            upsert=True
        )
        logger.info(f"Document metadata saved/updated for session_id: {session_id}. Matched: {result.matched_count}, Modified: {result.modified_count}, UpsertedId: {result.upserted_id}")
        return True
    except OperationFailure as e:
        logger.error(f"Error saving document metadata for session {session_id}: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error saving document metadata: {e}")
        return False


def get_user_documents(user_id: str) -> List[Dict[str, Any]]:
    """Retrieves all document metadata associated with a user_id."""
    db = get_db()
    if db is None:
        return []
    try:
        documents_collection: Collection = db[DOCUMENTS_COLLECTION]
        user_docs = list(documents_collection.find({"user_id": user_id}, {"_id": 0})) # Exclude MongoDB default _id
        logger.info(f"Retrieved {len(user_docs)} documents for user_id: {user_id}")
        return user_docs
    except Exception as e:
        logger.error(f"Error retrieving documents for user {user_id}: {e}")
        return []


def add_chat_message(session_id: str, role: str, content: str) -> bool:
    """Adds a chat message (user or assistant) to the history for a specific session."""
    db = get_db()
    if db is None:
        return False
    try:
        history_collection: Collection = db[HISTORY_COLLECTION]
        message_doc = {
            "session_id": session_id,
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow() # Store timestamp
        }
        result = history_collection.insert_one(message_doc)
        logger.info(f"Chat message added for session {session_id}, role {role}. InsertedId: {result.inserted_id}")
        return True
    except Exception as e:
        logger.error(f"Error adding chat message for session {session_id}: {e}")
        return False


def  get_chat_history(session_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves the chat history for a specific session, ordered by timestamp."""
    db = get_db()
    if db is None:
        return []
    try:
        history_collection: Collection = db[HISTORY_COLLECTION]
        history = list(history_collection.find(
                {"session_id": session_id},
                {"_id": 0, "session_id": 0} # Exclude _id and session_id from results
            ).sort("timestamp", 1).limit(limit) # Sort ascending (oldest first)
        )
        logger.info(f"Retrieved {len(history)} chat messages for session_id: {session_id}")
        return history
    except Exception as e:
        logger.error(f"Error retrieving chat history for session {session_id}: {e}")
        return []


def save_insight(session_id: str, insight: str) -> bool:
    """Saves a user-generated insight linked to a session."""
    db = get_db()
    if db is None:
        return False
    try:
        insights_collection: Collection = db[INSIGHTS_COLLECTION]
        insight_doc = {
            "session_id": session_id,
            "insight": insight,
            "timestamp": datetime.utcnow()
        }
        result = insights_collection.insert_one(insight_doc)
        logger.info(f"Insight saved for session {session_id}. InsertedId: {result.inserted_id}")
        return True
    except Exception as e:
        logger.error(f"Error saving insight for session {session_id}: {e}")
        return False


def get_insights(session_id: str) -> List[Dict[str, Any]]:
    """Retrieves all saved insights for a specific session."""
    db = get_db()
    if db is None:
        return []
    try:
        insights_collection: Collection = db[INSIGHTS_COLLECTION]
        # Find insights, remove session_id projection, keep _id for now
        insights_cursor = insights_collection.find(
            {"session_id": session_id},
            {"session_id": 0} # Only exclude session_id, keep _id
        ).sort("timestamp", 1)
        
        insights = []
        for doc in insights_cursor:
            # Convert ObjectId to string and assign to 'id' key
            doc['id'] = str(doc['_id'])
            # Remove the original ObjectId key
            del doc['_id']
            insights.append(doc)
            
        logger.info(f"Retrieved {len(insights)} insights for session_id: {session_id}")
        return insights
    except Exception as e:
        logger.error(f"Error retrieving insights for session {session_id}: {e}")
        return []

def delete_insight_by_id(insight_id: str) -> bool:
    """Deletes a specific insight document by its MongoDB _id."""
    db = get_db()
    if db is None:
        return False
    try:
        insights_collection: Collection = db[INSIGHTS_COLLECTION]
        # Convert the string ID back to ObjectId for querying
        try:
            object_id_to_delete = ObjectId(insight_id)
        except Exception as e:
            logger.error(f"Invalid insight_id format for deletion: {insight_id} - {e}")
            return False # Invalid ID format

        result = insights_collection.delete_one({"_id": object_id_to_delete})
        
        if result.deleted_count == 1:
            logger.info(f"Successfully deleted insight with id: {insight_id}")
            return True
        else:
            logger.warning(f"Insight with id {insight_id} not found for deletion.")
            return False # Return False if not found, or handle as needed

    except Exception as e:
        logger.error(f"Error deleting insight with id {insight_id}: {e}")
        return False

# --- NEW: User Authentication Functions --- 

def create_user(username: str, email: str, hashed_password: str) -> Optional[Dict[str, Any]]:
    """Creates a new user in the database after checking for existing username/email."""
    db = get_db()
    if db is None:
        return None
    try:
        users_collection: Collection = db[USERS_COLLECTION]
        
        # Check if username or email already exists
        existing_user = users_collection.find_one({"$or": [{'username': username}, {'email': email}]})
        if existing_user:
            if existing_user['username'] == username:
                logger.warning(f"Attempt to create user with existing username: {username}")
                return {"error": "Username already exists"}
            else:
                logger.warning(f"Attempt to create user with existing email: {email}")
                return {"error": "Email already registered"}

        user_doc = {
            "username": username,
            "email": email,
            "hashed_password": hashed_password,
            "created_at": datetime.utcnow()
        }
        result = users_collection.insert_one(user_doc)
        logger.info(f"New user created with ID: {result.inserted_id}")
        
        # Return the created user data (excluding password) for confirmation
        created_user = users_collection.find_one(
            {"_id": result.inserted_id}, 
            {'hashed_password': 0} # Exclude password hash from response
        )
        if created_user and '_id' in created_user: # Convert ObjectId for JSON serialization
             created_user['id'] = str(created_user.pop('_id'))
        return created_user
        
    except OperationFailure as e:
        logger.error(f"MongoDB operation failed during user creation for {username}: {e}")
        return {"error": f"Database error during registration: {e.details}"}
    except Exception as e:
        logger.error(f"Unexpected error creating user {username}: {e}")
        return {"error": "An unexpected error occurred during registration."}

def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Retrieves a user document by their username."""
    db = get_db()
    if db is None:
        return None
    try:
        users_collection: Collection = db[USERS_COLLECTION]
        user_doc = users_collection.find_one({"username": username})
        if user_doc and '_id' in user_doc:
            user_doc['id'] = str(user_doc.pop('_id'))
            logger.info(f"Found user by username: {username}")
            return user_doc # Return the full document including hashed password for login check
        else:
            logger.info(f"User not found by username: {username}")
            return None
    except Exception as e:
        logger.error(f"Error retrieving user by username {username}: {e}")
        return None

# --- END NEW: User Authentication Functions --- 

# --- NEW: Function to delete all data for a session ---
async def delete_all_session_data(session_id: str) -> Dict[str, int]:
    """Deletes document metadata, chat history, and insights associated with a session_id."""
    db = get_db()
    if db is None:
        return { "documents_deleted": 0, "history_deleted": 0, "insights_deleted": 0 }
    
    deleted_counts = { "documents_deleted": 0, "history_deleted": 0, "insights_deleted": 0 }
    
    try:
        # Delete document metadata
        doc_collection: Collection = db[DOCUMENTS_COLLECTION]
        doc_result = doc_collection.delete_many({"session_id": session_id})
        deleted_counts["documents_deleted"] = doc_result.deleted_count
        logger.info(f"Deleted {doc_result.deleted_count} document metadata entries for session {session_id}.")
        
        # Delete chat history
        hist_collection: Collection = db[HISTORY_COLLECTION]
        hist_result = hist_collection.delete_many({"session_id": session_id})
        deleted_counts["history_deleted"] = hist_result.deleted_count
        logger.info(f"Deleted {hist_result.deleted_count} chat history messages for session {session_id}.")
        
        # Delete insights
        insight_collection: Collection = db[INSIGHTS_COLLECTION]
        insight_result = insight_collection.delete_many({"session_id": session_id})
        deleted_counts["insights_deleted"] = insight_result.deleted_count
        logger.info(f"Deleted {insight_result.deleted_count} insights for session {session_id}.")
        
    except Exception as e:
        logger.error(f"Error during bulk deletion for session {session_id}: {e}")
        # Return current counts, indicating potentially partial deletion
        
    return deleted_counts

# Example Usage (for testing)
if __name__ == '__main__':
    from datetime import datetime # Import for example

    print("Running MongoDB Handler Example...")
    # Connect
    if not connect_to_mongo():
        print("Exiting due to connection failure.")
        exit()

    # Example Operations
    test_session_id = "mongo_test_session_123"
    test_user_id = "user_abc"
    test_filename = "test_doc.pdf"

    print(f"\n--- Saving Document Metadata (Session: {test_session_id}) ---")
    save_document_metadata(test_session_id, test_filename, test_user_id, processed_at=datetime.utcnow())

    print(f"\n--- Getting Documents for User: {test_user_id} ---")
    docs = get_user_documents(test_user_id)
    print(f"Found docs: {docs}")

    print(f"\n--- Adding Chat Messages (Session: {test_session_id}) ---")
    add_chat_message(test_session_id, "user", "Hello, how does this work?")
    add_chat_message(test_session_id, "assistant", "It uses MongoDB to store history!")

    print(f"\n--- Getting Chat History (Session: {test_session_id}) ---")
    history = get_chat_history(test_session_id)
    print(f"History: {history}")

    print(f"\n--- Saving Insight (Session: {test_session_id}) ---")
    save_insight(test_session_id, "MongoDB integration seems feasible.")

    print(f"\n--- Getting Insights (Session: {test_session_id}) ---")
    insights = get_insights(test_session_id)
    print(f"Insights: {insights}")

    # Clean up
    print("\n--- Cleaning up test data ---")
    db = get_db()
    if db:
        db[DOCUMENTS_COLLECTION].delete_many({"session_id": test_session_id})
        db[HISTORY_COLLECTION].delete_many({"session_id": test_session_id})
        db[INSIGHTS_COLLECTION].delete_many({"session_id": test_session_id})
        print("Test data deleted.")

    close_mongo_connection()
    print("\nExample finished.") 