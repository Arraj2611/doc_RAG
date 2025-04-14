import os
from pathlib import Path
from dotenv import load_dotenv

# Determine the project root directory (assuming this file is in backend/ragbase)
PROJECT_ROOT = Path(__file__).parent.parent.parent

# Load environment variables from .env file located at the project root
env_path = PROJECT_ROOT / '.env'
load_dotenv(dotenv_path=env_path)

# # DEBUG: Check if env variables are loaded
# print(f"DEBUG config.py: WEAVIATE_INDEX_NAME from env = {os.getenv('WEAVIATE_INDEX_NAME')}")

class Config:
    """Main configuration class loading from environment variables."""

    # General Settings
    APP_MODE = os.getenv("APP_MODE", "development") # e.g., development, production

    # Vector Store Mode
    # Default to Weaviate (remote) unless explicitly set to local
    USE_LOCAL_VECTOR_STORE = os.getenv("USE_LOCAL_VECTOR_STORE", "false").lower() == "true"

    # LLM Configuration (using environment variables)
    MODEL_PROVIDER = os.getenv("MODEL_PROVIDER", "groq") # Options: "openai", "ollama", "groq"
    
    class Model:
        """LLM and Embedding Model specific configurations."""
        TEMPERATURE = float(os.getenv("MODEL_TEMPERATURE", 0.1))
        MAX_TOKENS = int(os.getenv("MODEL_MAX_TOKENS", 1024)) # Note: May not apply to all models
        # Specific model names are read directly in the main Config class
        # Embedding model names are also read directly below

    # --- OpenAI Specific ---
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL_NAME = os.getenv("OPENAI_MODEL_NAME", "gpt-4o-mini") # Updated default LLM
    OPENAI_EMBEDDING_MODEL_NAME = os.getenv("OPENAI_EMBEDDING_MODEL_NAME", "text-embedding-3-small")

    # --- Ollama Specific ---
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL_NAME = os.getenv("OLLAMA_MODEL_NAME", "llama3")
    OLLAMA_EMBEDDING_MODEL_NAME = os.getenv("OLLAMA_EMBEDDING_MODEL_NAME", "nomic-embed-text")

    # --- Groq Specific ---
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    GROQ_MODEL_NAME = os.getenv("GROQ_MODEL_NAME", "llama3-8b-8192") # Default Groq model

    class Database:
        """Vector Database specific configurations."""
        # --- Weaviate Specific (Only relevant if USE_LOCAL_VECTOR_STORE is False) ---
        WEAVIATE_URL = os.getenv("WEAVIATE_URL")
        WEAVIATE_API_KEY = os.getenv("WEAVIATE_API_KEY")
        WEAVIATE_INDEX_NAME = os.getenv("WEAVIATE_INDEX_NAME", "DocRagIndexV4") # Updated default name
        WEAVIATE_TEXT_KEY = os.getenv("WEAVIATE_TEXT_KEY", "text_content") # Changed default key name

        # --- Local FAISS Specific (Only relevant if USE_LOCAL_VECTOR_STORE is True) ---
        # Renamed and updated path for clarity
        FAISS_INDEX_DIR = PROJECT_ROOT / "backend" / "vector_store" / "faiss_index"

    class Processing:
        """Document processing configurations."""
        CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 1000))
        CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 150))

    class Retriever:
        """Retriever configurations."""
        SEARCH_TYPE = os.getenv("RETRIEVER_SEARCH_TYPE", "similarity") # Options: "similarity", "mmr"
        # Number of documents to retrieve initially
        SEARCH_K = int(os.getenv("RETRIEVER_SEARCH_K", 4))
        # For MMR: Diversity factor (0=max diversity, 1=max similarity)
        SEARCH_MMR_DIVERSITY_FACTOR = float(os.getenv("RETRIEVER_MMR_LAMBDA_MULT", 0.5)) 
        # For MMR: Number of documents to fetch before diversification
        SEARCH_MMR_FETCH_K = int(os.getenv("RETRIEVER_MMR_FETCH_K", 20))

    class Path:
        """Path configurations relative to the project root."""
        # Permanent storage for processed documents (used for retrieval by filename)
        DOCUMENTS_DIR = PROJECT_ROOT / "backend" / "documents"
        # Temporary storage for uploaded files before processing
        TEMP_DIR = PROJECT_ROOT / "backend" / "tmp"
        # Stores hashes of processed files (for local FAISS mode)
        PROCESSED_HASHES_FILE = PROJECT_ROOT / "backend" / "vector_store" / "processed_hashes.json"

    # Ensure directories exist
    @staticmethod
    def initialize_directories():
        """Creates necessary directories on startup."""
        if Config.USE_LOCAL_VECTOR_STORE:
            Config.Database.FAISS_INDEX_DIR.mkdir(parents=True, exist_ok=True)
            # Ensure parent dir for hash file exists
            Config.Path.PROCESSED_HASHES_FILE.parent.mkdir(parents=True, exist_ok=True)
            
        Config.Path.DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
        Config.Path.TEMP_DIR.mkdir(parents=True, exist_ok=True)

# Initialize directories when the config module is loaded
Config.initialize_directories()

