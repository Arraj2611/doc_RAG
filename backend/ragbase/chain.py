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

# --- Weaviate Retrieval --- 
def retrieve_context_weaviate(query: str, client: weaviate.WeaviateClient, session_id: str, k: int = 5) -> List[Document]:
    """Retrieves documents from Weaviate using nearText search for a specific tenant."""
    tenant_id = session_id 
    print(f"--- DEBUG retrieve_context_weaviate: Tenant='{tenant_id}' Query='{query[:50]}...' K={k}") 

    try:
        # Use the imported COLLECTION_NAME
        collection = client.collections.get(COLLECTION_NAME).with_tenant(tenant_id)
        near_text_params = {"query": query, "limit": k}
        print(f"--- DEBUG retrieve_context_weaviate: Executing nearText with params: {near_text_params}")
        
        response = collection.query.near_text(
            query=query,
            limit=k,
        )

        print(f"--- DEBUG retrieve_context_weaviate: Received {len(response.objects)} results via nearText for tenant '{tenant_id}'.")
        
        docs = [
            Document(
                page_content=obj.properties.get('text', ''), 
                metadata={**obj.properties, "distance": obj.metadata.distance if obj.metadata else None}
            ) 
            for obj in response.objects
        ]
        return docs
    except Exception as e:
        print(f"ERROR in retrieve_context_weaviate for tenant '{tenant_id}': {e}")
        return []

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
            return format_docs(docs)
        elif client:
            # Remote mode with Weaviate
            print(f"Using Weaviate retrieval for session '{session_id}'")
            return format_docs(retrieve_context_weaviate(question, client, session_id))
        else:
            print(f"WARNING: No retriever or client available for session '{session_id}'")
            return "No retrieval system available."

    # Define the core RAG chain
    rag_chain = (
        RunnablePassthrough.assign( # Step 1: Fetch history object and extract messages
            chat_history=(
                itemgetter("session_id") 
                | RunnableLambda(get_session_history, name="FetchHistoryObject") 
                | RunnableLambda(lambda history_obj: history_obj.messages, name="ExtractMessages")
            ) # Pass the list of messages
        )
        | RunnableParallel( # Step 2: Retrieve context and pass history list 
            {
                "context": RunnableLambda(get_context),
                "question": itemgetter("question"),
                "chat_history": itemgetter("chat_history") # Pass the list of messages fetched in Step 1
            }
        )
        | prompt # Step 3: Format prompt
        | llm    # Step 4: Call LLM
        | StrOutputParser() # Step 5: Parse output
    )

    print("RAG chain (Manual History Version) created successfully.")
    return rag_chain

