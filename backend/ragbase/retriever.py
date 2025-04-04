from typing import Optional, List, Dict, Any

from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors.chain_filter import LLMChainFilter
from langchain_core.language_models import BaseLanguageModel
from langchain_core.vectorstores import VectorStore, VectorStoreRetriever
from langchain_weaviate.vectorstores import WeaviateVectorStore
import weaviate
from weaviate.classes.init import Auth
from .config import Config
from dotenv import load_dotenv
from fastapi import HTTPException
from langchain_core.retrievers import BaseRetriever
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.documents import Document
# FAISS/Local imports
from langchain_community.vectorstores import FAISS 
from langchain_core.embeddings import Embeddings
import os
# Use relative import for model
from .model import create_embeddings 
# Remove Weaviate-specific LC imports and custom class
from weaviate.classes.query import MetadataQuery, Filter

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
            # Raise or return None - let caller handle
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
            # Raise or return None
            return None
    else:
        # --- Weaviate Mode: No Retriever Object Needed Here --- 
        print("Retriever: Running in Weaviate mode. Retrieval handled directly in chain.")
        return None # Signal that retrieval is handled elsewhere

# Placeholder for direct Weaviate query logic if needed outside chain.py
# async def query_weaviate_directly(client: weaviate.Client, tenant_id: str, query: str, k: int):
#     collection = client.collections.get(Config.Database.WEAVIATE_INDEX_NAME).with_tenant(tenant_id)
#     response = await collection.query.near_text_async(...) # Use async version if in async context
#     return response 