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
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
    CONVERSATION_MESSAGE_LIMIT = int(os.getenv('CONVERSATION_MESSAGE_LIMIT', '6'))

    class Path:
        APP_HOME = Path(os.getenv("APP_HOME", Path(__file__).resolve().parent.parent))
        # Local data paths removed as S3 is used for documents and potentially other artifacts.
    
    class Database:
        WEAVIATE_URL = os.getenv("WEAVIATE_URL")
        WEAVIATE_API_KEY = os.getenv("WEAVIATE_API_KEY")
        WEAVIATE_INDEX_NAME = os.getenv("WEAVIATE_INDEX_NAME", "RaggerIndex")
        WEAVIATE_TEXT_KEY = "text"
        # WEAVIATE_EMBEDDING_MODEL = os.getenv("WEAVIATE_EMBEDDING_MODEL", "Snowflake/snowflake-arctic-embed-l-v2.0") # This might be set by Langchain/Groq integration

        # --- MongoDB Configuration --- 
        MONGO_CONNECTION_STRING = os.getenv("MONGO_CONNECTION_STRING")
        MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "doc_rag_db")

    # class OCI: # OCI Config commented out previously, keeping it that way.
    #     OBJECT_STORAGE_NAMESPACE = os.getenv("OCI_OBJECT_STORAGE_NAMESPACE")
    #     OBJECT_STORAGE_BUCKET_NAME = os.getenv("OCI_OBJECT_STORAGE_BUCKET_NAME")
    #     OBJECT_STORAGE_REGION = os.getenv("OCI_OBJECT_STORAGE_REGION")
    #     OCI_CONFIG_FILE_PATH = os.getenv("OCI_CONFIG_FILE_PATH", "~/.oci/config") 
    #     OCI_CONFIG_PROFILE = os.getenv("OCI_CONFIG_PROFILE", "DEFAULT")

    class AWS:
        S3_BUCKET_NAME = os.getenv("AWS_S3_BUCKET_NAME")
        S3_REGION = os.getenv("AWS_S3_REGION")
        # AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
        # AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

    class Auth:
        GROQ_API_KEY = os.getenv("GROQ_API_KEY")

    class Embedding:
        PROVIDER = os.getenv("EMBEDDING_PROVIDER", "groq").lower() # e.g., groq, openai, azure_openai, huggingface_local, huggingface_inference
        MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "text-embedding-ada-002") # Ensure this is a valid Groq or other configured provider's model
        # OLLAMA_BASE_URL removed
        # DEVICE removed
        
    class LLM:
        PROVIDER = os.getenv("LLM_PROVIDER", "groq").lower() # e.g., groq, openai, azure_openai
        MODEL_NAME = os.getenv("LLM_MODEL_NAME", "llama3-8b-8192") # Ensure this is a valid Groq model
        TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.4"))
        MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "8000"))
        # OLLAMA_BASE_URL removed
    
    class Retriever:
        USE_CHAIN_FILTER = os.getenv('USE_CHAIN_FILTER', 'False').lower() == 'true'
        SEARCH_TYPE = os.getenv("RETRIEVER_SEARCH_TYPE", "similarity") # e.g., similarity, mmr
        SEARCH_K = int(os.getenv("RETRIEVER_SEARCH_K", "5")) # Number of docs to retrieve

