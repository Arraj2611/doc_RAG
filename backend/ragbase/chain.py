import re
from operator import itemgetter
from typing import List, Dict
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
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
import weaviate
from weaviate.classes.query import MetadataQuery, Filter
from langchain_core.output_parsers import StrOutputParser

from .retriever import create_retriever
from .config import Config
from .ingest import COLLECTION_NAME, TEXT_KEY
from ..database import mongo_handler

# --- Prompt Setup ---
# Update SYSTEM_PROMPT to include chat_history instructions
SYSTEM_PROMPT = (
    "You are a helpful assistant that answers questions primarily using the provided context. "
    "If the context is sufficient, use it directly to answer. "
    "If the context is limited or not directly relevant, you may still attempt to answer based on general knowledge, "
    "but clearly state that the document context is limited and the response is based on AI reasoning and may be inaccurate.\n\n"
    "Context:\n{context}\n"
)


# --- Chat History Management (MODIFIED) --- 

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
    """Retrieves chat history from MongoDB and converts it to ChatMessageHistory object."""
    # Use the MongoDB handler to get history
    history_list: List[Dict] = mongo_handler.get_chat_history(session_id)
    
    # Convert the list of dicts to Langchain BaseMessage objects
    messages: List[BaseMessage] = []
    for msg_data in history_list:
        role = msg_data.get("role")
        content = msg_data.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant" or role == "ai": # Handle both common names
            messages.append(AIMessage(content=content))
        # Add other roles (system, tool) if needed
        
    print(f"DEBUG get_session_history: Retrieved {len(messages)} messages from MongoDB for session '{session_id}'")
    return ChatMessageHistory(messages=messages)

# --- Weaviate Retrieval (Multi-Tenant) ---
def retrieve_context_weaviate(query: str, client: weaviate.Client, session_id: str) -> List[Document]:
    """Retrieves context from Weaviate for a specific tenant using nearText vector search against the named vector."""
    print(f"Retrieving context from Weaviate for tenant '{session_id}' using nearText with query: '{query[:50]}...'")
    collection_name = COLLECTION_NAME # Use constant defined in ingest.py or Config
    text_key = TEXT_KEY             # Use constant defined in ingest.py or Config
    target_vector_name = "content_vector" # The name we gave our vector in ingest.py

    try:
        if not client.collections.exists(collection_name):
            print(f"  Warning: Collection '{collection_name}' does not exist. Cannot retrieve.")
            return []

        collection = client.collections.get(collection_name)
        collection_tenant = collection.with_tenant(session_id)

        # --- Perform nearText vector search targeting the correct named vector --- 
        response = collection_tenant.query.near_text(
            query=query,
            limit=Config.Retriever.SEARCH_K,
            target_vector=target_vector_name, # Specify the target vector name
            return_metadata=MetadataQuery(distance=True)
        )
        # ----------------------------------------------------------------------

        retrieved_docs = []
        if response and response.objects:
             print(f"  Retrieved {len(response.objects)} nearText results from Weaviate.")
             for obj in response.objects:
                 metadata = {k: v for k, v in obj.properties.items() if k != text_key}
                 if obj.metadata and obj.metadata.distance is not None:
                     metadata["distance_score"] = obj.metadata.distance
                 doc = Document(
                     page_content=obj.properties.get(text_key, ""),
                     metadata=metadata
                 )
                 retrieved_docs.append(doc)
        else:
            print(f"  No nearText results retrieved from Weaviate for tenant '{session_id}'.")

        return retrieved_docs

    except Exception as e:
        print(f"!!!!!!!! ERROR retrieving context from Weaviate (nearText) for tenant '{session_id}': {e} !!!!!!!!")
        traceback.print_exc()
        return []

# --- Chain Creation (REVISED) ---
def create_chain(llm: BaseLanguageModel, client=None, retriever=None) -> Runnable:
    """
    Creates the main RAG chain with explicit history lookup and session-specific retrieval.
    Expects input dict with 'question' and 'session_id'.
    
    Args:
        llm: The language model to use
        client: The Weaviate client for remote vector store (used for Weaviate mode)
        retriever: An already initialized retriever (used for local FAISS mode)
    """
    print("--- Creating RAG chain (Revised Structure) ---")

    # --- Define Components ---
    # Prompt remains the same
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{question}"),
        ]
    )

    # LLM part of the chain
    llm_chain = prompt | llm | StrOutputParser()

    # --- Define Retrieval/Formatting Functions ---
    # Function to retrieve context based on mode (local or remote)
    def get_context(inputs: dict) -> List[Document]: # Added type hint
        question = inputs["question"]
        session_id = inputs["session_id"] # Expects session_id here
        print(f"DEBUG get_context called for session: {session_id}")
        if retriever:
            print(f"Using local retriever for session '{session_id}'")
            try:
                docs = retriever.get_relevant_documents(question)
                print(f"Local retriever returned {len(docs)} docs.")
                return docs
            except Exception as e:
                 print(f"ERROR in local retriever: {e}")
                 traceback.print_exc()
                 return []
        elif client:
            print(f"Using Weaviate retrieval for session '{session_id}'")
            # retrieve_context_weaviate already has error handling
            docs = retrieve_context_weaviate(question, client, session_id)
            print(f"Weaviate retriever returned {len(docs)} docs.")
            return docs
        else:
            print(f"WARNING: No retriever or client available for session '{session_id}'")
            return []

    # Function to get history messages (Now uses get_session_history which fetches from Mongo)
    def get_history_messages(inputs: dict) -> List[BaseMessage]: # Return type changed
        session_id = inputs["session_id"] # Expects session_id here
        print(f"DEBUG get_history_messages called for session: {session_id}")
        history_obj = get_session_history(session_id) # Fetches from Mongo
        return history_obj.messages

    # --- Define Parallel Steps --- 
    # Step 1: Prepare initial context dict with question and session_id
    prepare_initial_context = RunnableParallel(
        question=itemgetter("question"),
        session_id=RunnableLambda(lambda x, config: config["configurable"]["session_id"], name="GetSessionIdFromConfig")
    ).with_config({"run_name": "PrepareInitialContext"})

    # Step 2: Fetch docs and history in parallel, **pass question through**
    fetch_docs_and_history = RunnableParallel(
        # Pass question directly through from Step 1's output
        question=itemgetter("question"),
        # Run get_context using the dict from Step 1
        retrieved_docs=RunnableLambda(get_context, name="GetRelevantDocs"),
        # Run get_history_messages using the dict from Step 1
        chat_history=RunnableLambda(get_history_messages, name="FetchHistoryMessages")
    ).with_config({"run_name": "FetchDocsAndHistory"})

    # Step 3: Format docs and prepare LLM input
    format_and_generate = RunnableParallel(
         answer = (
             RunnablePassthrough.assign( # Input: {'question':..., 'retrieved_docs':..., 'chat_history':...} from Step 2
                context = itemgetter("retrieved_docs") | RunnableLambda(format_docs, name="FormatDocs")
                # Output: {'question':..., 'retrieved_docs':..., 'chat_history':..., 'context':...}
             )
             # llm_chain now receives all required keys: 'question', 'chat_history', 'context'
             | llm_chain
         ),
         # Pass original docs through
         source_documents = itemgetter("retrieved_docs")
    ).with_config({"run_name": "FormatAndGenerate"})

    # --- Define the Main RAG Chain --- 
    rag_chain = (
        # Step 1: Prepare initial context dict with question and session_id
        prepare_initial_context

        # Step 2: Fetch docs and history in parallel, **pass question through**
        | fetch_docs_and_history

        # Step 3: Format docs and prepare LLM input
        | format_and_generate
    )

    print("RAG chain (Revised Structure) created successfully.")
    return rag_chain


# --- Function to save messages (NEW) ---
def save_message_pair(session_id: str, user_query: str, ai_response: str):
    """Saves both the user query and the AI response to MongoDB."""
    print(f"DEBUG save_message_pair: Saving user query and AI response for session {session_id}")
    # Save user message
    user_saved = mongo_handler.add_chat_message(session_id=session_id, role="user", content=user_query)
    if not user_saved:
        print(f"WARNING: Failed to save user message for session {session_id}")
    
    # Save AI message
    ai_saved = mongo_handler.add_chat_message(session_id=session_id, role="assistant", content=ai_response)
    if not ai_saved:
        print(f"WARNING: Failed to save AI response for session {session_id}")

