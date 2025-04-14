import re
from operator import itemgetter
from typing import List
from pathlib import Path
import traceback
import os

from langchain.schema.runnable import RunnablePassthrough, RunnableParallel
from langchain_core.documents import Document
from langchain_core.language_models import BaseLanguageModel
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder, format_document
from langchain_core.runnables import Runnable
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.tracers.stdout import ConsoleCallbackHandler
from langchain_core.vectorstores import VectorStoreRetriever
from langchain_core.runnables import RunnableLambda
from langchain_core.retrievers import BaseRetriever
from langchain_community.chat_message_histories import ChatMessageHistory
import weaviate
from weaviate.classes.query import MetadataQuery, Filter
from langchain_core.output_parsers import StrOutputParser

from .retriever import create_retriever
from .config import Config
from .ingest import COLLECTION_NAME

# --- Prompt Setup ---
# Update SYSTEM_PROMPT to include chat_history instructions
SYSTEM_PROMPT = (
    "You are a helpful assistant who answers questions based ONLY on the provided context. "
    "If the answer is not found in the context, respond with 'Answer cannot be found.'. "
    "Consider the chat history provided for context, but prioritize the current question and the retrieved document context." 
    "\n\n"
    "Context:\n{context}\n"
)

# --- Chat History Management --- 
store = {} # In-memory store (replace with DB interaction later)

def remove_links(text: str) -> str:
    url_pattern = r"https?://\S+|www\.\S+"
    return re.sub(url_pattern, "", text)

def format_docs(documents: List[Document]) -> str:
    """Formats retrieved documents (text and images) into a context string for the LLM."""
    formatted_context = []
    print(f"\n--- DEBUG format_docs: Received {len(documents)} documents to format ---")
    if not documents:
        print("DEBUG format_docs: No documents received.")
        return "No relevant context found."

    for i, doc in enumerate(documents):
        print(f"--- Document #{i+1} ---")
        print(f"  Metadata: {doc.metadata}")
        content = doc.page_content if doc.page_content else "[NO CONTENT]"
        print(f"  Content Preview (first 200 chars):\n    {content[:200]}...")
        print(f"---------------------")
        
        source = doc.metadata.get("source", "Unknown source")
        try:
            source_name = Path(source).name
        except Exception:
            source_name = str(source)

        doc_type = doc.metadata.get("doc_type")

        context_piece = ""
        if doc_type == "image":
            context_piece = f"[Context from image: {source_name}]"
        elif doc_type == "text":
            page_num = doc.metadata.get("page")
            page_info = f", page {page_num + 1}" if page_num is not None else ""
            content = doc.page_content
            if not content or not content.strip():
                print(f"WARNING format_docs: Doc {i+1} (text) has empty page_content. Source: {source_name}{page_info}")
                content = "[Content missing or empty]"
            else:
                content = remove_links(content)
            context_piece = f"[Context from text document: {source_name}{page_info}]\n{content}"
        else:
            content = doc.page_content
            if not content or not content.strip():
                print(f"WARNING format_docs: Doc {i+1} (unknown/missing type) has empty page_content. Source: {source_name}")
                content = "[Content missing or empty]"
            else:
                content = remove_links(content)
            context_piece = f"[Context from: {source_name}]\n{content}"

        formatted_context.append(context_piece)
        if i < len(documents) - 1:
            formatted_context.append("---")

    full_context = "\n".join(formatted_context).strip()
    print(f"\n--- DEBUG format_docs: Final Context String --- ")
    print(f"Length: {len(full_context)}")
    print(f"Preview (first 500 chars):\n{full_context[:500]}...")
    print("--- End Final Context ---")
    return full_context if full_context else "No relevant context found."

def get_session_history(session_id: str) -> ChatMessageHistory:
    if session_id not in store:
        print(f"DEBUG get_session_history: Creating new history for session '{session_id}'")
        store[session_id] = ChatMessageHistory()
    else:
        print(f"DEBUG get_session_history: Retrieving history for session '{session_id}'")
    return store[session_id]

# --- Weaviate Retrieval (Multi-Tenant) ---
def retrieve_context_weaviate(query: str, client: weaviate.Client, session_id: str) -> List[Document]:
    """Retrieves context from Weaviate for a specific tenant."""
    print(f"Retrieving context from Weaviate for tenant '{session_id}' with query: '{query[:50]}...'")
    collection_name = Config.Database.WEAVIATE_INDEX_NAME # Use config
    text_key = Config.Database.WEAVIATE_TEXT_KEY       # Use config

    try:
        # Check if collection exists
        if not client.collections.exists(collection_name):
            print(f"  Warning: Collection '{collection_name}' does not exist. Cannot retrieve.")
            return [] # Return empty list if collection doesn't exist

        # Get tenant-specific collection handle
        collection = client.collections.get(collection_name)
        collection_tenant = collection.with_tenant(session_id)

        # Perform vector search
        response = collection_tenant.query.near_text(
            query=query,
            limit=Config.Retriever.SEARCH_K, # Use config for K
            # metadata=MetadataQuery(properties=["source", "page", "doc_hash"]) # Removed - metadata is included by default
        )

        # --- Convert Weaviate results to LangChain Documents ---
        retrieved_docs = []
        if response and response.objects:
             print(f"  Retrieved {len(response.objects)} results from Weaviate.")
             for obj in response.objects:
                 metadata = {k: v for k, v in obj.properties.items() if k != text_key} # Extract metadata
                 doc = Document(
                     page_content=obj.properties.get(text_key, ""), # Get text content
                     metadata=metadata # Assign extracted metadata
                 )
                 retrieved_docs.append(doc)
        else:
            print(f"  No results retrieved from Weaviate for tenant '{session_id}'.")

        return retrieved_docs # Return list of Document objects
        # ----------------------------------------------------

    except Exception as e:
        print(f"!!!!!!!! ERROR retrieving context from Weaviate for tenant '{session_id}': {e} !!!!!!!!")
        traceback.print_exc()
        return [] # Return empty list on error

# --- Chain Creation (Revised) ---
def create_chain(llm: BaseLanguageModel, client=None, retriever=None) -> Runnable:
    """
    Creates the main RAG chain with explicit history lookup and session-specific retrieval.
    Expects input dict with 'question' and 'session_id'.
    
    Args:
        llm: The language model to use
        client: The Weaviate client for remote vector store (used for Weaviate mode)
        retriever: An already initialized retriever (used for local FAISS mode)
    """
    print("--- Creating RAG chain (Manual History Version) ---")

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{question}"),
        ]
    )

    # Function to retrieve context based on mode (local or remote)
    def get_context(inputs):
        question = inputs["question"]
        session_id = inputs["session_id"]
        
        if retriever:
            # Local mode with FAISS retriever
            print(f"Using local retriever for session '{session_id}'")
            docs = retriever.get_relevant_documents(question)
            return docs
        elif client:
            # Remote mode with Weaviate
            print(f"Using Weaviate retrieval for session '{session_id}'")
            docs = retrieve_context_weaviate(question, client, session_id)
            return docs
        else:
            print(f"WARNING: No retriever or client available for session '{session_id}'")
            return []

    # Define the core RAG chain
    rag_chain = (
        # Step 1: Fetch history and assign to chat_history
        RunnablePassthrough.assign(
            chat_history=(
                itemgetter("session_id") 
                | RunnableLambda(get_session_history, name="FetchHistoryObject") 
                | RunnableLambda(lambda history_obj: history_obj.messages, name="ExtractMessages")
            )
        )
        # Step 2: Retrieve docs and format them (fixed to avoid duplicate calls)
        | RunnablePassthrough.assign(
            retrieved_docs=RunnableLambda(get_context, name="GetRelevantDocs"),
        )
        | RunnablePassthrough.assign(
            context=lambda x: format_docs(x["retrieved_docs"]),
        )
        # Step 3: Run LLM and keep sources
        | RunnableParallel(
            {
                "answer": prompt | llm | StrOutputParser(),
                "source_documents": itemgetter("retrieved_docs") 
            }
        )
    )

    print("RAG chain (Manual History Version) created successfully.")
    return rag_chain

