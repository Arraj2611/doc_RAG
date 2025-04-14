import re
from operator import itemgetter
from typing import List, Dict, Optional, Any
from pathlib import Path
import traceback
import os
import logging

from langchain.schema.runnable import RunnableParallel
from langchain_core.documents import Document
from langchain_core.language_models import BaseLanguageModel
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.retrievers import BaseRetriever
from langchain_community.chat_message_histories import ChatMessageHistory
import weaviate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import BaseMessage, AIMessage, HumanMessage

from .config import Config
from .model import create_embedding_model, create_embeddings
from .retriever import create_retriever as create_faiss_retriever
from db import get_chat_messages_by_session_id, add_chat_message, get_user_by_id
from routes.preferences import SYSTEM_PROMPTS, DEFAULT_RESPONSE_STYLE

# Initialize logger - Get logger by name, config happens in api.py
logger = logging.getLogger(__name__) # Use __name__ for module-specific logger

# --- Prompt Setup ---
# Update SYSTEM_PROMPT to include chat_history instructions
SYSTEM_PROMPT = (
    "You are an intelligent assistant specialized in answering questions based on the provided context documents. "
    "Use the following pieces of retrieved context and the chat history to answer the question. "
    "If you don't know the answer, just say that you don't know. Don't try to make up an answer. "
    "Keep the answer concise and relevant to the question."
    "\n\n"
    "Chat History:\n{chat_history}\n"
    "Context:\n{context}\n"
    "Question:\n{question}\n"
    "Answer:"
)

# --- Chat History Management --- 
store = {} # In-memory store (replace with DB interaction later)

def remove_links(text: str) -> str:
    url_pattern = r"https?://\S+|www\.\S+"
    return re.sub(url_pattern, "", text)

def format_docs(documents: List[Document]) -> str:
    """Formats retrieved documents (text and images) into a context string for the LLM."""
    logger.info(f"\n--- DEBUG format_docs: Received {len(documents)} documents to format ---")
    if not documents:
        logger.info("DEBUG format_docs: No documents received.")
        return "No relevant context found."

    formatted_context = []
    for i, doc in enumerate(documents):
        # logger.info(f"--- Document #{i+1} ---") # Can be noisy, keep if needed
        # logger.info(f"  Metadata: {doc.metadata}")
        content = doc.page_content if doc.page_content else "[NO CONTENT]"
        # logger.info(f"  Content Preview (first 200 chars):\n    {content[:200]}...")
        # logger.info(f"---------------------")
        
        source = doc.metadata.get("source", "Unknown source")
        page = doc.metadata.get("page", None)
        doc_type = doc.metadata.get("doc_type", "text") # Default to text if missing
        
        source_name = os.path.basename(source)
        page_info = f" (Page {page})" if page is not None else ""

        if doc_type == 'text':
            content = doc.page_content
            if not content or not content.strip():
                logger.warning(f"WARNING format_docs: Doc {i+1} (text) has empty page_content. Source: {source_name}{page_info}")
                content = "[Content missing or empty]"
            else:
                 formatted_context.append(f"Source: {source_name}{page_info}\nContent: {content.strip()}\n---")
        else:
            content = doc.page_content
            if not content or not content.strip():
                logger.warning(f"WARNING format_docs: Doc {i+1} (unknown/missing type) has empty page_content. Source: {source_name}")
                content = "[Content missing or empty]"
            else:
                formatted_context.append(f"Source: {source_name}\nContent: {content.strip()}\n---")

    full_context = "\n".join(formatted_context).strip()
    # logger.info(f"\n--- DEBUG format_docs: Final Context String --- ") # Can be noisy
    # logger.info(f"Length: {len(full_context)}")
    # logger.info(f"Preview (first 500 chars):\n{full_context[:500]}...")
    # logger.info("--- End Final Context ---")
    return full_context if full_context else "No relevant context found."

def get_session_history(session_id: str) -> ChatMessageHistory:
    if session_id not in store:
        # logger.info(f"DEBUG get_session_history: Creating new history for session '{session_id}'")
        store[session_id] = ChatMessageHistory()
    # else:
        # logger.info(f"DEBUG get_session_history: Retrieving history for session '{session_id}'")
    return store[session_id]

# --- Weaviate Retrieval --- 
async def retrieve_context_weaviate(query: str, client: weaviate.WeaviateClient, tenant_id: str, k: int = 5) -> List[Document]:
    """Retrieve documents from Weaviate using nearVector search for a specific tenant."""
    
    # Ensure tenant_id is provided
    if not tenant_id:
        logger.error("ERROR in retrieve_context_weaviate: tenant_id is missing.")
        return [] # Return empty list if tenant_id is missing

    logger.info(f"Retrieving context for tenant='{tenant_id}', query='{query[:50]}...' k={k} using nearVector")

    try:
        # Get the collection for the specific tenant
        collection = client.collections.get(Config.Database.WEAVIATE_INDEX_NAME).with_tenant(tenant_id)
        
        # --- Vectorize the query locally ---
        logger.info("Creating embedding model...")
        embedding_model = create_embedding_model()
        logger.info("Vectorizing query...")
        query_vector = embedding_model.embed_query(query)
        logger.info(f"Query vector created (length: {len(query_vector) if query_vector else 0}).")
        # ------------------------------------

        # --- Use near_vector search ---
        response = collection.query.near_vector(
            near_vector=query_vector,
            limit=k,
            include_vector=True
        )
        # ------------------------------
        
        logger.info(f"Received {len(response.objects)} results from Weaviate for tenant '{tenant_id}' using nearVector.")
        
        # Construct Document objects
        documents = []
        for obj in response.objects:
            content = obj.properties.get(Config.Database.WEAVIATE_TEXT_KEY, "")
            metadata = {
                "source": obj.properties.get("source", "unknown"),
                "page": obj.properties.get("page", 0),
                "doc_type": obj.properties.get("doc_type", "unknown"),
                "element_index": obj.properties.get("element_index", -1),
                "doc_hash": obj.properties.get("doc_hash", "unknown"),
                "tenant_id": tenant_id, # Add tenant ID to metadata
                "distance": getattr(obj, "distance", None) # Updated to access distance directly
            }
            documents.append(Document(page_content=content, metadata=metadata))
            
        return documents
    
    except Exception as e:
        logger.error(f"ERROR in retrieve_context_weaviate for tenant '{tenant_id}': {e}")
        logger.error(f"ERROR details: Query was '{query}' with tenant='{tenant_id}'")
        # Log the full traceback for detailed debugging
        logger.error(traceback.format_exc()) 
        return [] # Return empty list on error

# --- Chain Creation (Revised) ---
def create_chain(llm: BaseLanguageModel, retriever: BaseRetriever = None, client: weaviate.WeaviateClient = None, system_prompt=SYSTEM_PROMPT):
    """
    Creates the main RAG chain with explicit history lookup and session-specific retrieval.
    Expects input dict with 'question' and 'configurable.session_id'.
    
    Args:
        llm: The language model to use
        retriever: An already initialized retriever (used for local FAISS mode)
        client: The Weaviate client for remote vector store (used for Weaviate mode)
        system_prompt: Custom system prompt to use for this chain
    """
    logger.info("Creating RAG chain (Manual History Version)...")

    logger.info(f"Using system prompt: {system_prompt[:100]}...")

    # Create the RAG prompt
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{question}"),
        ]
    )

    # Function to retrieve context based on mode (local or remote)
    def get_context(inputs):
        question = inputs["question"]
        # Extract session_id from configurable dictionary
        configurable = inputs.get("configurable", {})
        session_id = configurable.get("session_id", "default")
        logger.info(f"Chain: Getting context for target tenant ID: '{session_id}'")
        
        if retriever:
            # Local mode with FAISS retriever
            logger.info(f"Using local retriever...")
            docs = retriever.get_relevant_documents(question)
            return format_docs(docs)
        elif client:
            # Remote mode with Weaviate
            logger.info(f"Using Weaviate retrieval for tenant '{session_id}'")
            docs = retrieve_context_weaviate(question, client, session_id)
            return format_docs(docs)
        else:
            logger.warning(f"WARNING: No retriever or client available for context retrieval (Target Tenant: '{session_id}')")
            return "No retrieval system available."

    # Define the chat history retrieval function
    def get_history_for_session(inputs):
        configurable = inputs.get("configurable", {})
        session_id = configurable.get("session_id", "default")
        logger.info(f"Fetching chat history for history_session_id: '{session_id}'")
        return get_session_history(session_id).messages

    # Define the core RAG chain
    runnable_map = RunnableParallel(
            context=get_context,
            chat_history=lambda x: get_history_for_session(x),
            question=itemgetter("question")
        )

    rag_chain = (
        runnable_map
        | prompt
        | llm
        | StrOutputParser()
    )

    logger.info("RAG chain (Manual History Version) created successfully.")
    return rag_chain

# --- Prompt Definition ---
# Base template, context and history will be added dynamically
BASE_SYSTEM_TEMPLATE = (
    "{user_specific_prompt}\n\n"
    "Answer the question based only on the following context and chat history.\n"
    "If the answer is not in the context or history, say you don't know.\n\n"
    "Context:\n{context}\n\n"
    "Chat History:\n{chat_history}"
)

# --- Document Formatting ---
def format_docs_for_context(docs: List[Document]) -> str:
    """Formats retrieved documents into a numbered list string for the LLM context."""
    if not docs:
        return "No relevant context found."
    
    formatted_lines = []
    for i, doc in enumerate(docs):
        source = doc.metadata.get("source", "Unknown")
        page = doc.metadata.get("page", None)
        page_info = f" (Page {page})" if page is not None else ""
        content = doc.page_content.strip()
        if not content:
            logger.warning(f"Document {i+1} (Source: {source}{page_info}) has empty content.")
            content = "[Empty Content]"
        formatted_lines.append(f"[{i+1}] Source: {source}{page_info}\nContent: {content}")
        
    return "\n---\n".join(formatted_lines)

# --- Database Chat History --- 
class MongoDBDBChatHistory(BaseChatMessageHistory):
    """Chat message history that stores messages in MongoDB via async functions."""
    def __init__(self, session_id: str, user_id: str):
        self.session_id = session_id
        self.user_id = user_id
        self._messages: Optional[List[BaseMessage]] = None # Cache messages

    async def load_messages(self) -> List[BaseMessage]:
        """Retrieve messages from MongoDB."""
        if self._messages is None:
            logger.debug(f"Loading chat history for session: {self.session_id}")
            db_messages = await get_chat_messages_by_session_id(self.session_id)
            self._messages = []
            for msg in db_messages:
                if msg.sender == "user":
                    self._messages.append(HumanMessage(content=msg.content))
                elif msg.sender == "ai":
                    self._messages.append(AIMessage(content=msg.content))
                else:
                    logger.warning(f"Unknown message sender type '{msg.sender}' in session {self.session_id}")
            logger.debug(f"Loaded {len(self._messages)} messages for session {self.session_id}")
        return self._messages

    @property
    async def messages(self) -> List[BaseMessage]:
        """Messages loaded from the database"""
        return await self.load_messages()

    async def add_message(self, message: BaseMessage) -> None:
        """Append the message to the record in MongoDB."""
        logger.debug(f"Adding message to session {self.session_id}: ({type(message).__name__}) {message.content[:50]}...")
        sender_type = ""
        if isinstance(message, HumanMessage):
            sender_type = "user"
        elif isinstance(message, AIMessage):
            sender_type = "ai"
        else:
            logger.error(f"Unsupported message type: {type(message)} for session {self.session_id}")
            return # Don't save unsupported types
            
        try:
            await add_chat_message({
                "session_id": self.session_id,
                "user_id": self.user_id,
                "sender": sender_type,
                "content": message.content,
                # Add other relevant fields like tenant_id if needed
            })
            # Invalidate cache after adding
            self._messages = None 
            logger.debug(f"Message added successfully to session {self.session_id}")
        except Exception as e:
            logger.error(f"Failed to add message to MongoDB for session {self.session_id}: {e}", exc_info=True)
            # Decide how to handle DB write failure - maybe raise?

    async def clear(self) -> None:
        """Clear session memory from MongoDB - NOT IMPLEMENTED."""
        # Requires a delete_chat_messages_by_session_id function in db/mongodb.py
        logger.warning("Clearing chat history from MongoDB is not implemented.")
        self._messages = []

# --- Retriever Logic --- 

def get_retriever(session_id: str, weaviate_client: Optional[weaviate.Client] = None) -> Optional[BaseRetriever]:
    """Gets the appropriate retriever based on config and session_id (tenant)."""
    if Config.USE_LOCAL_VECTOR_STORE:
        logger.info("Using local FAISS retriever.")
        # Create FAISS retriever - it handles loading/errors internally
        return create_faiss_retriever()
    elif weaviate_client:
        logger.info(f"Creating Weaviate retriever for tenant: {session_id}")
        try:
            # Use WeaviateVectorStore directly for tenant-specific retrieval
            vectorstore = WeaviateVectorStore(
                client=weaviate_client,
                index_name=Config.Database.WEAVIATE_INDEX_NAME,
                text_key=Config.Database.WEAVIATE_TEXT_KEY,
                # We need embeddings to vectorize the query *before* sending to Weaviate
                # embedding=create_embeddings(), # Not used by Weaviate store itself for retrieval
                attributes=["source", "page", "doc_type"], # Metadata to retrieve
                by_text=False # Crucial: We will use near_vector, not by_text
            )
            # Configure retriever settings
            search_type = Config.Retriever.SEARCH_TYPE.lower()
            search_kwargs = {'k': Config.Retriever.SEARCH_K}
            if search_type == "mmr": # MMR not directly supported by WeaviateVectorStore retriever
                logger.warning("MMR search type requested but not directly supported by WeaviateVectorStore. Using similarity.")
                search_type = "similarity"
            
            # We need to perform near_vector search manually, so we wrap the logic
            # This retriever won't use vectorstore.as_retriever() directly
            # Instead, we'll use a RunnableLambda to call our custom retrieval function
            # (or integrate the logic directly into the chain)
            logger.info(f"Weaviate store configured for tenant '{session_id}'. Retrieval logic handled in chain.")
            # Returning the vectorstore object itself might be useful for manual queries
            # but the chain needs a retriever interface or direct query function.
            # For now, return None and handle Weaviate query in the chain flow.
            return None # Indicate Weaviate retrieval needs special handling
        except Exception as e:
            logger.error(f"Failed to create Weaviate vector store for tenant {session_id}: {e}", exc_info=True)
            return None
    else:
        logger.error("Neither local retriever nor Weaviate client is available.")
        return None
        
async def retrieve_weaviate_docs(input_dict: Dict, weaviate_client: weaviate.Client) -> List[Document]:
    """Retrieves documents from Weaviate using near_vector search."""
    query = input_dict["question"]
    session_id = input_dict["session_id"] # Assuming session_id is passed in
    k = Config.Retriever.SEARCH_K
    
    if not session_id:
        logger.error("Session ID (tenant) missing for Weaviate retrieval.")
        return []
        
    logger.info(f"Weaviate Retrieval: tenant='{session_id}', k={k}, query='{query[:50]}...'")
    
    try:
        embeddings = create_embeddings()
        query_vector = embeddings.embed_query(query)
        
        collection = weaviate_client.collections.get(Config.Database.WEAVIATE_INDEX_NAME)
        tenant_collection = collection.with_tenant(session_id)
        
        response = tenant_collection.query.near_vector(
            near_vector=query_vector,
            limit=k,
            # return_metadata=MetadataQuery(distance=True) # Get distance if needed
        )
        
        docs = []
        for obj in response.objects:
            content = obj.properties.get(Config.Database.WEAVIATE_TEXT_KEY, "")
            metadata = {k: v for k, v in obj.properties.items() if k != Config.Database.WEAVIATE_TEXT_KEY}
            metadata["tenant_id"] = session_id
            # metadata["distance"] = obj.metadata.distance if obj.metadata else None
            docs.append(Document(page_content=content, metadata=metadata))
            
        logger.info(f"Weaviate Retrieval: Found {len(docs)} documents for tenant '{session_id}'.")
        return docs
        
    except Exception as e:
        logger.error(f"Error during Weaviate retrieval for tenant '{session_id}': {e}", exc_info=True)
        return []

# --- RAG Chain Creation ---

def create_rag_chain(llm: BaseLanguageModel, weaviate_client: Optional[weaviate.Client] = None):
    """
    Creates the main RAG chain with integrated history and retrieval.
    Handles both local FAISS and remote Weaviate retrieval based on config.
    Dynamically loads user's system prompt preference from DB.
    Input keys: "question", "session_id", "user_id"
    Output: String response from the LLM.
    """
    logger.info(f"Creating RAG chain (Mode: {'Local FAISS' if Config.USE_LOCAL_VECTOR_STORE else 'Remote Weaviate'})")

    # --- Define Retriever Logic --- 
    if Config.USE_LOCAL_VECTOR_STORE:
        faiss_retriever = create_faiss_retriever()
        if not faiss_retriever:
            raise RuntimeError("Failed to create FAISS retriever for local mode.")
        retriever_step = RunnableLambda(lambda inputs: faiss_retriever.get_relevant_documents(inputs["question"]))
    elif weaviate_client:
        retriever_step = RunnableLambda(retrieve_weaviate_docs)
    else:
        raise ValueError("Vector store configuration error: No FAISS retriever or Weaviate client available.")

    # --- Define History Logic --- 
    def get_chat_history_instance(inputs: Dict) -> BaseChatMessageHistory:
        return MongoDBDBChatHistory(session_id=inputs["session_id"], user_id=inputs["user_id"])
        
    async def load_chat_history_messages(history_instance: BaseChatMessageHistory) -> List[BaseMessage]:
        return await history_instance.messages
        
    history_step = RunnableLambda(get_chat_history_instance) | RunnableLambda(load_chat_history_messages)

    # --- Define Prompt Logic (including dynamic preference loading) --- 
    async def get_dynamic_prompt(inputs: Dict) -> ChatPromptTemplate:
        user_id = inputs.get("user_id")
        response_style = DEFAULT_RESPONSE_STYLE # Default
        if user_id:
            try:
                db_user = await get_user_by_id(user_id)
                if db_user and db_user.preferences:
                    pref_style = db_user.preferences.get("response_style")
                    if pref_style in SYSTEM_PROMPTS:
                        response_style = pref_style
                    elif pref_style:
                        logger.warning(f"User {user_id} has invalid pref '{pref_style}'. Using default.")
            except Exception as e:
                logger.error(f"Error fetching user preferences for {user_id}: {e}")
                # Continue with default prompt
        
        user_specific_prompt = SYSTEM_PROMPTS.get(response_style, SYSTEM_PROMPTS[DEFAULT_RESPONSE_STYLE])
        logger.debug(f"Using response style '{response_style}' for user '{user_id}'")
        
        # Format the base template with the user-specific prompt text
        final_system_prompt = BASE_SYSTEM_TEMPLATE.format(user_specific_prompt=user_specific_prompt, 
                                                          context="{context}", 
                                                          chat_history="{chat_history}")

        return ChatPromptTemplate.from_messages([
            ("system", final_system_prompt),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{question}"),
        ])
        
    # --- Assemble the RAG Core Chain --- 
    # This part gets context and history, formats prompt, calls LLM
    rag_core = (
        RunnablePassthrough.assign(
            chat_history=history_step,
            weaviate_client=lambda x: weaviate_client if not Config.USE_LOCAL_VECTOR_STORE else None
        )
        | RunnablePassthrough.assign(
            context=(lambda inputs: retriever_step.invoke(inputs) if Config.USE_LOCAL_VECTOR_STORE 
                       else retrieve_weaviate_docs(inputs, inputs["weaviate_client"]))
            | RunnableLambda(format_docs_for_context)
        )
        # Dynamically create the prompt based on user preference
        | RunnableLambda(get_dynamic_prompt) 
        | llm
        | StrOutputParser()
    )
    
    # --- Define History Update Logic --- 
    async def add_history_and_return_answer(inputs_and_answer: Dict) -> str:
        """Adds question and answer to history after generation."""
        inputs = inputs_and_answer["input_data"]
        answer = inputs_and_answer["answer"]
        try:
            history = MongoDBDBChatHistory(session_id=inputs["session_id"], user_id=inputs["user_id"])
            await history.add_message(HumanMessage(content=inputs["question"]))
            await history.add_message(AIMessage(content=answer))
        except Exception as e:
            logger.error(f"Failed to add history for session {inputs['session_id']}: {e}", exc_info=True)
            # Decide if we should raise or just log
        return answer # Pass the answer through
        
    # --- Final Chain Assembly (Parallel Execution) ---
    # Runs the RAG core and then passes the original input + answer to the history update function.
    final_chain = RunnableParallel(
        input_data=RunnablePassthrough(), 
        answer=rag_core
    ) | RunnableLambda(add_history_and_return_answer)

    logger.info("RAG chain created successfully.")
    return final_chain

