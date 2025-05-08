from langchain_core.language_models import BaseLanguageModel
import weaviate
from .config import Config
from dotenv import load_dotenv
from langchain_core.retrievers import BaseRetriever
# FAISS/Local imports
from langchain_community.vectorstores import FAISS
import os
# Use relative import for model
from .model import create_embeddings

load_dotenv()

# --- Updated create_retriever function (FAISS ONLY) --- 
def create_retriever(
        llm: BaseLanguageModel, 
        client: weaviate.Client | None = None # Keep for signature consistency
) -> BaseRetriever | None: # Return None if not local
    """Creates a retriever ONLY for the local FAISS setup."""
    
    if Config.USE_LOCAL_VECTOR_STORE:
        # --- FAISS Retriever --- 
        print("Retriever: Creating FAISS retriever...")
        faiss_index_path = str(Config.Path.FAISS_INDEX_DIR / "docs_index")
        if not os.path.exists(faiss_index_path):
            print(f"ERROR: FAISS index not found at {faiss_index_path}. Please run ingestion first.")
            return None 
        try:
            embeddings = create_embeddings()
            vector_store = FAISS.load_local(
                faiss_index_path, 
                embeddings, 
                allow_dangerous_deserialization=True
            )
            retriever = vector_store.as_retriever(
                search_type=Config.Retriever.SEARCH_TYPE, 
                search_kwargs={'k': Config.Retriever.SEARCH_K}
            )
            print(f"Retriever: Loaded FAISS index and created retriever with k={Config.Retriever.SEARCH_K}.")
            return retriever
        except Exception as e:
            print(f"ERROR loading FAISS index or creating retriever: {e}")
            return None
    else:
        print("Retriever: Running in Weaviate mode. Retrieval handled directly in chain.")
        return None