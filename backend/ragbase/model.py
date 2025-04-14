"""
Factory functions for creating Language Models (LLMs) and Embedding Models 
based on the application configuration.
"""
import logging
import os

# Import base classes
from langchain_core.embeddings import Embeddings
from langchain_core.language_models import BaseLanguageModel

# Import specific implementations
from langchain_community.chat_models import ChatOllama # For older Ollama integration
from langchain_community.llms import Ollama # Newer interface for direct LLM
from langchain_community.embeddings import OllamaEmbeddings
from langchain_groq import ChatGroq

from .config import Config

# Configure logger
logger = logging.getLogger(__name__)

def create_llm() -> BaseLanguageModel:
    """Creates the appropriate LLM instance based on Config.MODEL_PROVIDER."""
    provider = Config.MODEL_PROVIDER.lower()
    logger.info(f"Creating LLM for provider: {provider}")

    if provider == "ollama":
        # Using the newer direct Ollama LLM interface
        llm = Ollama(
            base_url=Config.OLLAMA_BASE_URL,
            model=Config.OLLAMA_MODEL_NAME,
            temperature=Config.Model.TEMPERATURE,
            # num_ctx=Config.Model.MAX_TOKENS # Adjust if needed, Ollama manages context differently
        )
        # Note: Streaming with direct Ollama might require different handling in the chain/API
        logger.info(f"Using Ollama model: {Config.OLLAMA_MODEL_NAME} from {Config.OLLAMA_BASE_URL}")

    elif provider == "groq":
        if not Config.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY must be set in environment for Groq provider.")
        llm = ChatGroq(
            api_key=Config.GROQ_API_KEY,
            model_name=Config.GROQ_MODEL_NAME,
            temperature=Config.Model.TEMPERATURE,
            # max_tokens doesn't directly apply to ChatGroq, managed by model limits
            streaming=True
        )
        logger.info(f"Using Groq model: {Config.GROQ_MODEL_NAME}")
        
    else:
        raise ValueError(f"Unsupported LLM provider configured: {provider}")
    
    return llm

def create_embeddings() -> Embeddings:
    """
    Creates the appropriate Embeddings instance based on Config settings.
    Prioritizes provider specified in Config.MODEL_PROVIDER, with fallbacks.
    """
    provider = Config.MODEL_PROVIDER.lower()
    logger.info(f"Attempting to create embedding model for primary provider: {provider}")

    if provider == "ollama" or provider == "groq": # Groq uses Ollama/OpenAI for embeddings
        # Try Ollama if it's the primary provider or if falling back from OpenAI/Groq
        logger.info(f"Attempting to use Ollama embeddings: {Config.OLLAMA_EMBEDDING_MODEL_NAME}")
        try:
            embeddings = OllamaEmbeddings(
                base_url=Config.OLLAMA_BASE_URL,
                model=Config.OLLAMA_EMBEDDING_MODEL_NAME
            )
            # Perform a quick test embed to check connection and model availability
            embeddings.embed_query("test") 
            logger.info(f"Using Ollama embeddings: {Config.OLLAMA_EMBEDDING_MODEL_NAME} from {Config.OLLAMA_BASE_URL}")
            return embeddings
        except Exception as e:
            logger.warning(f"Failed to create/connect Ollama embeddings ({Config.OLLAMA_BASE_URL} model: {Config.OLLAMA_EMBEDDING_MODEL_NAME}): {e}")
            if provider == "ollama": # If Ollama was the primary choice, raise error
                raise ValueError("Ollama specified as provider, but failed to initialize embeddings.") from e
            # Otherwise (Groq or failed OpenAI), fall through to try OpenAI as last resort

    # Last resort: Try OpenAI embeddings if keys are set (could happen if Groq is provider)
    
    raise ValueError("Could not create embedding model. Check provider configuration and API keys/connections.")

def create_embedding_model():
    """Creates the appropriate embedding model based on configuration."""
    provider = Config.MODEL_PROVIDER.lower()
    logger.info(f"Creating embedding model for provider: {provider}")

    if provider == "ollama":
        embeddings = OllamaEmbeddings(
            base_url=Config.OLLAMA_BASE_URL,
            model=Config.OLLAMA_EMBEDDING_MODEL_NAME
        )
        logger.info(f"Using Ollama embedding model: {Config.OLLAMA_EMBEDDING_MODEL_NAME} from {Config.OLLAMA_BASE_URL}")
    else:
        raise ValueError(f"Unsupported embedding provider: {provider}")
        
    return embeddings

