import os
from pathlib import Path
from dotenv import load_dotenv

dotenv_path = Path(__file__).resolve().parent.parent / ".env"
print(f"Config: Attempting to load .env from: {dotenv_path}")
if dotenv_path.is_file():
    load_dotenv(dotenv_path=dotenv_path, override=True)
    print(f"Config: Successfully loaded .env from {dotenv_path}")
else:
    print(f"Config: WARNING - .env file not found at {dotenv_path}")

class Config:
    USE_LOCAL_VECTOR_STORE = os.getenv('USE_LOCAL_VECTOR_STORE', 'False').lower() == 'true' 
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
    CONVERSATION_MESSAGE_LIMIT = int(os.getenv('CONVERSATION_MESSAGE_LIMIT', '6'))

    class Path:
        APP_HOME = Path(os.getenv("APP_HOME", Path(__file__).resolve().parent.parent))
        DOCUMENTS_DIR = APP_HOME / "database/documents"
        IMAGES_DIR = APP_HOME / "images"
        FAISS_INDEX_DIR = APP_HOME / "faiss-index" 
        PROCESSED_HASHES_FILE = APP_HOME / "processed_hashes.json"
    
    class Database:
        WEAVIATE_URL = os.getenv("WEAVIATE_URL")
        WEAVIATE_API_KEY = os.getenv("WEAVIATE_API_KEY")
        WEAVIATE_INDEX_NAME = os.getenv("WEAVIATE_INDEX_NAME", "RaggerIndex")
        WEAVIATE_TEXT_KEY = "text"
        WEAVIATE_EMBEDDING_MODEL = os.getenv("WEAVIATE_EMBEDDING_MODEL", "Snowflake/snowflake-arctic-embed-l-v2.0") 

        # --- MongoDB Configuration --- 
        MONGO_CONNECTION_STRING = os.getenv("MONGO_CONNECTION_STRING")
        MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "doc_rag_db")

    class Auth:
        GROQ_API_KEY = os.getenv("GROQ_API_KEY")

    class Embedding:
        PROVIDER = os.getenv("EMBEDDING_PROVIDER", "huggingface_local").lower() # e.g., openai, azure_openai, huggingface_local, huggingface_inference, ollama
        MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-small-en-v1.5") # Model varies by provider
        DEVICE = os.getenv("EMBEDDING_DEVICE", "cpu") # e.g., cpu, cuda, mps
        OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") 
        
    class LLM:
        PROVIDER = os.getenv("LLM_PROVIDER", "groq").lower() # e.g., openai, azure_openai, groq, ollama
        MODEL_NAME = os.getenv("LLM_MODEL_NAME", "llama3-8b-8192") # Model varies by provider
        TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.4"))
        MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "8000"))
        OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") 
    
    class Retriever:
        USE_CHAIN_FILTER = os.getenv('USE_CHAIN_FILTER', 'False').lower() == 'true'
        SEARCH_TYPE = os.getenv("RETRIEVER_SEARCH_TYPE", "similarity") # e.g., similarity, mmr
        SEARCH_K = int(os.getenv("RETRIEVER_SEARCH_K", "5")) # Number of docs to retrieve

