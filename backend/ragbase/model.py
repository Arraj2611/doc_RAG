from langchain_community.chat_models import ChatOllama
from langchain_community.document_compressors.flashrank_rerank import FlashrankRerank
from langchain_community.embeddings import OllamaEmbeddings
from langchain_core.embeddings import Embeddings
from langchain_core.language_models import BaseLanguageModel
from langchain_groq import ChatGroq
import os
from .config import Config
from .config import Config
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
    """Creates the embedding model instance based on configuration."""
    provider = Config.Embedding.PROVIDER.lower()
    model_name = Config.Embedding.MODEL_NAME
    print(f"Creating embeddings: Provider='{provider}', Model='{model_name}'")

    if provider == "ollama":
        return OllamaEmbeddings(model=model_name)
    # elif provider == "openai":
    #     return OpenAIEmbeddings(model=model_name, api_key=Config.Auth.OPENAI_API_KEY)
    # elif provider == "azure_openai":
    #     if not Config.Auth.AZURE_OPENAI_API_KEY or not Config.Auth.AZURE_OPENAI_ENDPOINT:
    #         raise ValueError("Azure OpenAI requires AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT")
    #     return AzureOpenAIEmbeddings(
    #         model=model_name,
    #         azure_deployment=model_name, # Often deployment name matches model
    #         api_key=Config.Auth.AZURE_OPENAI_API_KEY,
    #         azure_endpoint=Config.Auth.AZURE_OPENAI_ENDPOINT,
    #         api_version=Config.Auth.AZURE_OPENAI_API_VERSION # Add API version
    #     )
    # elif provider == "huggingface_inference":
    #     if not Config.Auth.HUGGINGFACE_API_KEY:
    #          raise ValueError("HuggingFace Inference API requires HUGGINGFACE_API_KEY")
    #     return HuggingFaceInferenceAPIEmbeddings(
    #         api_key=Config.Auth.HUGGINGFACE_API_KEY, model_name=model_name
    #     )
    # elif provider == "huggingface_local":
    #      # For local HF models, uses sentence-transformers library
    #     # Ensure device is set correctly (cpu, cuda, mps)
    #     model_kwargs = {'device': Config.Embedding.DEVICE}
    #     encode_kwargs = {'normalize_embeddings': False}
    #     print(f"  Local HF args: model_kwargs={model_kwargs}, encode_kwargs={encode_kwargs}")
    #     return HuggingFaceEmbeddings(
    #         model_name=model_name,
    #         model_kwargs=model_kwargs,
    #         encode_kwargs=encode_kwargs
    #     )
    # Add other providers like Cohere, Bedrock etc. here
    # elif provider == "cohere":
    #     return CohereEmbeddings(model=model_name, cohere_api_key=Config.Auth.COHERE_API_KEY)
    else:
        raise ValueError(f"Unsupported embedding provider: {provider}")

def create_llm() -> BaseLanguageModel:
    """Creates the LLM instance based on configuration."""
    provider = Config.LLM.PROVIDER.lower()
    model_name = Config.LLM.MODEL_NAME
    temperature = Config.LLM.TEMPERATURE
    print(f"Creating LLM: Provider='{provider}', Model='{model_name}', Temp={temperature}")

    # if provider == "ollama":
    #     return Ollama(
    #         model=model_name,
    #         temperature=temperature,
    #         # Add other Ollama parameters if needed
    #         base_url=Config.LLM.OLLAMA_BASE_URL 
    #     )
    # elif provider == "openai":
    #     return ChatOpenAI(
    #         model=model_name,
    #         temperature=temperature,
    #         api_key=Config.Auth.OPENAI_API_KEY,
    #         # model_kwargs={"response_format": {"type": "json_object"}}, # If JSON mode needed
    #         streaming=True # Enable streaming by default for chat models
    #     )
    # elif provider == "azure_openai":
    #     if not Config.Auth.AZURE_OPENAI_API_KEY or not Config.Auth.AZURE_OPENAI_ENDPOINT:
    #         raise ValueError("Azure OpenAI requires AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT")
    #     return AzureChatOpenAI(
    #         model=model_name,
    #         azure_deployment=model_name, # Often deployment name matches model
    #         temperature=temperature,
    #         api_key=Config.Auth.AZURE_OPENAI_API_KEY,
    #         azure_endpoint=Config.Auth.AZURE_OPENAI_ENDPOINT,
    #         api_version=Config.Auth.AZURE_OPENAI_API_VERSION,
    #         streaming=True
    #     )
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
    # Add other providers like Anthropic, Gemini, etc. here
    # elif provider == "anthropic":
    #     from langchain_anthropic import ChatAnthropic
    #     return ChatAnthropic(model=model_name, temperature=temperature, api_key=Config.Auth.ANTHROPIC_API_KEY)
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")

