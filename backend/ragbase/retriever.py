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
from .model import create_embeddings, create_embedding_model
# Remove Weaviate-specific LC imports and custom class
from weaviate.classes.query import MetadataQuery, Filter
import logging

# Initialize logger - Get logger by name, config happens in api.py
logger = logging.getLogger(__name__)

load_dotenv()

def create_retriever(embeddings: Optional[Embeddings] = None) -> Optional[VectorStoreRetriever]:
    """
    Creates a FAISS vector store retriever loaded from the configured local directory.
    Intended only for use when Config.USE_LOCAL_VECTOR_STORE is True.

    Args:
        embeddings: Optional pre-initialized embedding model. If None, creates one.

    Returns:
        A configured VectorStoreRetriever instance or None if loading fails or 
        if not configured for local storage.
    """
    if not Config.USE_LOCAL_VECTOR_STORE:
        logger.error("Attempted to create FAISS retriever, but USE_LOCAL_VECTOR_STORE is False.")
        return None

    if embeddings is None:
        logger.info("No embeddings provided, creating default embedding model for FAISS.")
        try:
            embeddings = create_embeddings()
        except Exception as e:
            logger.error(f"Failed to create default embeddings for FAISS retriever: {e}")
            return None
        
    vector_store_path = str(Config.Database.FAISS_INDEX_DIR)
    logger.info(f"Attempting to load FAISS vector store from: {vector_store_path}")
    
    if not os.path.exists(vector_store_path) or not os.path.isdir(vector_store_path):
        logger.error(f"FAISS index directory not found or is not a directory: {vector_store_path}")
        logger.error("Please ensure documents have been processed using the Ingestor in local mode first.")
        return None
        
    try:
        # FAISS requires allow_dangerous_deserialization=True for loading pickle files
        vectorstore = FAISS.load_local(
            vector_store_path, 
            embeddings,
            allow_dangerous_deserialization=True 
        )
        logger.info("FAISS vector store loaded successfully.")
    except FileNotFoundError:
        logger.error(f"FAISS index files (e.g., index.faiss, index.pkl) not found in {vector_store_path}.")
        return None
    except Exception as e:
        logger.error(f"Failed to load FAISS vector store from {vector_store_path}: {e}", exc_info=True)
        return None
        
    # Configure retriever based on settings in Config.Retriever
    search_type = Config.Retriever.SEARCH_TYPE.lower()
    search_kwargs = {'k': Config.Retriever.SEARCH_K}
    
    if search_type == "mmr":
        search_kwargs['fetch_k'] = Config.Retriever.SEARCH_MMR_FETCH_K
        search_kwargs['lambda_mult'] = Config.Retriever.SEARCH_MMR_DIVERSITY_FACTOR
        logger.info(f"Configuring FAISS retriever for MMR search (k={search_kwargs['k']}, fetch_k={search_kwargs['fetch_k']}, lambda={search_kwargs['lambda_mult']}).")
    elif search_type == "similarity":
        logger.info(f"Configuring FAISS retriever for similarity search (k={search_kwargs['k']}).")
    else:
        logger.warning(f"Unsupported RETRIEVER_SEARCH_TYPE '{search_type}'. Defaulting to similarity search.")
        search_type = "similarity"
        
    try:
        retriever = vectorstore.as_retriever(
            search_type=search_type, 
            search_kwargs=search_kwargs
        )
        logger.info(f"FAISS retriever created successfully.")
        return retriever
    except Exception as e:
        logger.error(f"Failed to create retriever from FAISS vector store: {e}", exc_info=True)
        return None

# Placeholder for direct Weaviate query logic if needed outside chain.py
# async def query_weaviate_directly(client: weaviate.Client, tenant_id: str, query: str, k: int):
#     collection = client.collections.get(Config.Database.WEAVIATE_INDEX_NAME).with_tenant(tenant_id)
#     response = await collection.query.near_text_async(...) # Use async version if in async context
#     return response 