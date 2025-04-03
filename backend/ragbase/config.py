import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class Config:
    # --- Control Flags ---
    USE_LOCAL_VECTOR_STORE = False # Set to False for Weaviate
    DEBUG = False
    CONVERSATION_MESSAGE_LIMIT = 6

    class Path:
        APP_HOME = Path(os.getenv("APP_HOME", Path(__file__).parent.parent))
        DOCUMENTS_DIR = APP_HOME / "tmp"
        IMAGES_DIR = APP_HOME / "images"
        # Add path for local FAISS index
        FAISS_INDEX_DIR = APP_HOME / "faiss-index" 
        # Add path for hash tracking file
        PROCESSED_HASHES_FILE = APP_HOME / "processed_hashes.json"
    
    class Database:
        # These are now only used if USE_LOCAL_VECTOR_STORE is False
        WEAVIATE_URL = os.getenv("WEAVIATE_URL")
        WEAVIATE_API_KEY = os.getenv("WEAVIATE_API_KEY")
        WEAVIATE_INDEX_NAME = "DocRagIndex"
        WEAVIATE_TEXT_KEY = "text"

    class Model:
        # Add back Ollama embedding model setting
        OLLAMA_EMBEDDING_MODEL = "nomic-embed-text"
        OLLAMA_BASE_URL = "http://localhost:11434"
        # Weaviate embedding model only used if USE_LOCAL_VECTOR_STORE is False
        WEAVIATE_EMBEDDING_MODEL = "Snowflake/snowflake-arctic-embed-l-v2.0"
        LOCAL_LLM = "gemma2:9b"
        REMOTE_LLM = "llama-3.3-70b-versatile"
        TEMPERATURE = 0.4
        MAX_TOKENS = 8000
        USE_LOCAL = False
    
    class Retriever:
        # These are used for both FAISS and Weaviate retrievers
        USE_CHAIN_FILTER = False
        SEARCH_TYPE = "similarity"
        SEARCH_K = 5

