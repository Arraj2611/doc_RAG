from langchain_community.chat_models import ChatOllama
from langchain_community.document_compressors.flashrank_rerank import FlashrankRerank
from langchain_community.embeddings import OllamaEmbeddings
from langchain_core.embeddings import Embeddings
from langchain_core.language_models import BaseLanguageModel
from langchain_groq import ChatGroq
import os
from ragbase.config import Config
# from sentence_transformers import SentenceTransformer
# from typing import List
# from PIL import Image

# Remove or comment out the SentenceTransformerEmbeddings class
# class SentenceTransformerEmbeddings(Embeddings):
#     def __init__(self, model_name: str):
#         self.model = SentenceTransformer(model_name)
# 
#     def embed_documents(self, texts: List[str]) -> List[List[float]]:
#         return self.model.encode(texts).tolist()
# 
#     def embed_query(self, text: str) -> List[float]:
#         return self.model.encode(text).tolist()
# 
#     def embed_images(self, images: List[Image.Image]) -> List[List[float]]:
#         # Note: OllamaEmbeddings typically doesn't handle images directly.
#         # If image embedding is critical, a different multi-modal model setup is needed.
#         # For now, this method would be unused with OllamaEmbeddings.
#         # raise NotImplementedError("OllamaEmbeddings does not support embed_images")
#         pass 

# Add back create_embeddings function
def create_embeddings() -> Embeddings:
    print(f"Creating OllamaEmbeddings with model '{Config.Model.OLLAMA_EMBEDDING_MODEL}'")
    try:
        embeddings = OllamaEmbeddings(
            model=Config.Model.OLLAMA_EMBEDDING_MODEL,
            base_url=Config.Model.OLLAMA_BASE_URL
        )
        # Optional: Test connection?
        # embeddings.embed_query("test") 
        print("OllamaEmbeddings created successfully.")
        return embeddings
    except Exception as e:
        print(f"ERROR: Failed to create OllamaEmbeddings. Ensure Ollama is running at {Config.Model.OLLAMA_BASE_URL} and the model '{Config.Model.OLLAMA_EMBEDDING_MODEL}' is pulled. Error: {e}")
        raise

def create_llm() -> BaseLanguageModel:
    # Always use Groq
    print("Creating Groq LLM...")
    try:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable not set")
            
        llm = ChatGroq(
            api_key=api_key,
            temperature=Config.Model.TEMPERATURE,
            model_name="llama3-8b-8192",  # Hardcoded to a reliable model
            max_tokens=Config.Model.MAX_TOKENS,
            streaming=True
        )
        print(f"Groq LLM created successfully (Model: llama3-8b-8192)")
        return llm
    except Exception as e:
        print(f"ERROR: Failed to create Groq LLM: {e}")
        raise

