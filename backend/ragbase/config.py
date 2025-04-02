import os
from pathlib import Path

class Config:
    class Path:
        APP_HOME = Path(os.getenv("APP_HOME", Path(__file__).parent.parent))
        DOCUMENTS_DIR = APP_HOME / "tmp"
        IMAGES_DIR = APP_HOME / "images"
        FAISS_INDEX_PATH = APP_HOME / "faiss-index"
    
    class Database:
        pass
    
    class Model:
        EMBEDDINGS = "multi-qa-mpnet-base-dot-v1"
        RERANKER = "ms-marco-MiniLM-L-6-v2"
        LOCAL_LLM = "gemma2:9b"
        REMOTE_LLM = "llama-3.3-70b-versatile"
        TEMPERATURE = 0.4
        MAX_TOKENS = 8000
        USE_LOCAL = False
    
    class Retriever:
        USE_RERANKER = False
        USE_CHAIN_FILTER = False
    
    DEBUG = False
    CONVERSATION_MESSAGE_LIMIT = 6

