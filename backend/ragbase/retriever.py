from typing import Optional

from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors.chain_filter import LLMChainFilter
from langchain_core.language_models import BaseLanguageModel
from langchain_core.vectorstores import VectorStore, VectorStoreRetriever
from langchain_community.vectorstores import FAISS
import os
from ragbase.config import Config
from ragbase.model import create_embeddings, create_reranker
from dotenv import load_dotenv
load_dotenv()

def create_retriever(
        llm: BaseLanguageModel
) -> VectorStoreRetriever:
    print("Loading FAISS index...")
    index_path = Config.Path.FAISS_INDEX_PATH
    if not index_path.exists() or not (index_path / "index.faiss").exists():
        print(f"ERROR: FAISS index not found at {index_path}")
        raise ValueError(f"FAISS index not found at {index_path}. Please process documents first.")
    
    try:
        # Load FAISS index from local path
        embeddings = create_embeddings()
        # Allow dangerous deserialization for FAISS loading with custom embeddings
        vector_store = FAISS.load_local(
            folder_path=str(index_path), 
            embeddings=embeddings, 
            allow_dangerous_deserialization=True
        )
        print(f"Retriever: Successfully loaded FAISS index from {index_path}")
    except Exception as e:
        print(f"Retriever: Error loading FAISS index from {index_path}: {e}") 
        raise ValueError(f"Retriever: Failed to load FAISS index. Error: {e}") from e
    
    # Create retriever from the loaded vector store
    retriever = vector_store.as_retriever(
        search_type="similarity", 
        search_kwargs={"k": 10}
    )

    if Config.Retriever.USE_RERANKER:
        print("Applying Reranker...")
        retriever = ContextualCompressionRetriever(
            base_compressor=create_reranker(), base_retriever=retriever
        )
    
    if Config.Retriever.USE_CHAIN_FILTER:
        print("Applying Chain Filter...")
        retriever = ContextualCompressionRetriever(
            base_compressor=LLMChainFilter.from_llm(llm), base_retriever=retriever
        )
    
    print("Retriever creation complete.")
    return retriever