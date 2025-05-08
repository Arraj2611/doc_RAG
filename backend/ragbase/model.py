from langchain_community.chat_models import ChatOllama
from langchain_community.document_compressors.flashrank_rerank import FlashrankRerank
from langchain_community.embeddings import OllamaEmbeddings
from langchain_core.embeddings import Embeddings
from langchain_core.language_models import BaseLanguageModel
from langchain_groq import ChatGroq
import os
from .config import Config

# Add back create_embeddings function
def create_embeddings() -> Embeddings:
    """Creates the embedding model instance based on configuration."""
    provider = Config.Embedding.PROVIDER.lower()
    model_name = Config.Embedding.MODEL_NAME
    print(f"Creating embeddings: Provider='{provider}', Model='{model_name}'")

    if provider == "ollama":
        return OllamaEmbeddings(model=model_name)
    else:
        raise ValueError(f"Unsupported embedding provider: {provider}")

def create_llm() -> BaseLanguageModel:
    """Creates the LLM instance based on configuration."""
    provider = Config.LLM.PROVIDER.lower()
    model_name = Config.LLM.MODEL_NAME
    temperature = Config.LLM.TEMPERATURE
    print(f"Creating LLM: Provider='{provider}', Model='{model_name}', Temp={temperature}")

    if provider == "groq":
        groq_api_key = Config.Auth.GROQ_API_KEY
        if not groq_api_key:
            raise ValueError("Groq provider requires GROQ_API_KEY in environment variables (.env)")
        try:
            llm = ChatGroq(
                api_key=groq_api_key,
                temperature=temperature,
                model_name=model_name,  
                # max_tokens=Config.LLM.MAX_TOKENS, # Usually handled by model defaults or prompt
                streaming=True
            )
            print(f"Groq LLM created successfully (Model: {model_name})")
            return llm
        except Exception as e:
            print(f"ERROR: Failed to create Groq LLM: {e}")
            raise # Re-raise the exception
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")

