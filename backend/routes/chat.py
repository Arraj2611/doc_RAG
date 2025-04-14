"""
Chat API routes.
"""
import asyncio
import json
import traceback
import logging
from typing import Dict, List, Optional, AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from auth import get_current_user
from models.chat import ChatRequest, ChatResponse, ChatStreamRequest
# Import the consolidated RAG chain creator
from ragbase.chain import create_rag_chain, MongoDBDBChatHistory
from ragbase.config import Config
from ragbase.model import create_llm

# Configure logger
logger = logging.getLogger(__name__)

# Define router
router = APIRouter()

# --- RAG Chain Caching (Simple in-memory) ---
# For production, consider a more robust caching mechanism or 
# initializing the chain within the request lifecycle if needed.
_cached_rag_chain = None

def get_or_create_rag_chain(request: Request):
    """Gets the cached RAG chain or creates it if needed."""
    global _cached_rag_chain
    if _cached_rag_chain is None:
        logger.info("No cached RAG chain found, creating a new one...")
        try:
            llm = create_llm()
            # Pass Weaviate client if in remote mode
            client = getattr(request.app.state, 'weaviate_client', None) 
            if not Config.USE_LOCAL_VECTOR_STORE and not client:
                raise ValueError("Weaviate client required but not found in app state.")
            
            _cached_rag_chain = create_rag_chain(llm, weaviate_client=client if not Config.USE_LOCAL_VECTOR_STORE else None)
            logger.info("RAG chain created and cached.")
        except Exception as e:
            logger.error(f"Failed to create RAG chain: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Could not initialize RAG engine: {e}")
    # else:
        # logger.debug("Returning cached RAG chain.")
    return _cached_rag_chain

# --- Routes ---

# Note: The standard /chat endpoint might need adjustments 
# if the chain is now fully async due to history updates.
# For simplicity, we focus on the streaming endpoint first.

@router.post("/stream")
async def chat_stream(
    request_data: ChatStreamRequest,
    request: Request, # Needed for app state access
    user_info: dict = Depends(get_current_user)
):
    """
    Handle chat with streaming response using the consolidated RAG chain.
    Uses document-specific tenant ID if provided, otherwise defaults to user session.
    
    Args:
        request_data: Chat stream request (question, session_id, tenant_id)
        request: The request object (to access app state for Weaviate client)
        user_info: User information from JWT
        
    Returns:
        StreamingResponse with Server-Sent Events.
    """
    user_id = user_info.get("id") # Use user.id from the authenticated user object
    if not user_id:
        # This shouldn't happen if get_current_user is working, but good practice
        logger.error("Could not determine user ID from authenticated user info.")
        raise HTTPException(status_code=401, detail="Invalid authentication token.")
        
    question = request_data.question
    session_id_from_req = request_data.session_id
    doc_tenant_id = request_data.tenant_id

    # Determine the target session/tenant ID for this interaction
    # Priority: Specific document tenant > Session ID from request > Generic user session
    target_session_id = doc_tenant_id or session_id_from_req or f"user_{user_id}_default"
    logger.info(f"Chat stream request for user '{user_id}'. Target session/tenant ID: '{target_session_id}'")

    try:
        rag_chain = get_or_create_rag_chain(request)
    except Exception as e:
        # Handle chain creation errors
        logger.error(f"Error getting/creating RAG chain: {e}", exc_info=True)
        async def error_stream_gen(msg: str):
             yield f"data: {json.dumps({'error': msg})}\n\n"
        return StreamingResponse(error_stream_gen(f"Failed to initialize chat engine: {e}"), media_type="text/event-stream")

    async def stream_generator() -> AsyncGenerator[str, None]:
        """Generates Server-Sent Events for the streaming response."""
        try:
            # Prepare input for the chain
            chain_input = {
                "question": question,
                "session_id": target_session_id, # Used for history AND Weaviate tenant ID
                "user_id": user_id
            }
            logger.debug(f"Streaming chain with input: {chain_input}")
            
            # Use astream for the async chain
            # The consolidated chain now handles history internally.
            async for chunk in rag_chain.astream(chain_input):
                # Assuming the final step is StrOutputParser, chunks are strings
                if isinstance(chunk, str):
                    yield f"data: {json.dumps({'answer': chunk})}\n\n"
                else:
                    # Log unexpected chunk types
                    logger.warning(f"Unexpected chunk type in chat stream: {type(chunk)} - {chunk}")
                await asyncio.sleep(0.01) # Small delay

            # Signal completion (client-side can use this)
            yield f"data: {json.dumps({'status': 'done'})}\n\n"
            logger.info(f"Chat stream completed successfully for session '{target_session_id}'.")

        except Exception as e:
            error_msg = f"Error during chat stream generation (Session: {target_session_id}): {str(e)}"
            logger.error(error_msg, exc_info=True)
            yield f"data: {json.dumps({'error': error_msg})}\n\n"

    # Return the streaming response
    return StreamingResponse(stream_generator(), media_type="text/event-stream")

@router.get("/history")
async def get_chat_history_route(
    session_id: str,
    user_info: dict = Depends(get_current_user)
):
    """
    Get chat history for a given session ID from MongoDB.
    
    Args:
        session_id: The session ID to retrieve history for.
        user_info: User information from JWT.
        
    Returns:
        Dict containing session ID and list of messages.
    """
    user_id = user_info.get("id") # Use user.id
    if not user_id:
        logger.error("Could not determine user ID from authenticated user info for history request.")
        raise HTTPException(status_code=401, detail="Invalid authentication token.")
        
    # Basic check: Does the user own this session?
    # A more robust check might involve querying ChatSession collection if it exists
    # Or checking if session_id follows the pattern `user_{user_id}_...`
    # For now, just log the request.
    logger.info(f"Request for chat history for session '{session_id}' by user '{user_id}'")

    try:
        # Use the MongoDBDBChatHistory class to load messages
        # Pass the authenticated user_id for potential validation inside history class if needed
        history = MongoDBDBChatHistory(session_id=session_id, user_id=user_id)
        messages = await history.load_messages() # Load fresh from DB
        
        # Convert Langchain messages to simple dicts for JSON response
        response_messages = []
        for msg in messages:
            role = "user" if msg.type == "human" else "assistant" if msg.type == "ai" else "unknown"
            response_messages.append({"role": role, "content": msg.content})
            
        return {
            "session_id": session_id,
            "messages": response_messages
        }
    except Exception as e:
        logger.error(f"Error retrieving chat history for session '{session_id}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve chat history: {e}")

# TODO: Re-evaluate the non-streaming /chat endpoint. 
# It would need to use `rag_chain.ainvoke` and might not return sources easily
# as the sources are used internally to generate the context string.
# @router.post("", response_model=ChatResponse)
# async def chat(
#     request_data: ChatRequest,
#     request: Request, # Needed for app state access
#     user_info: dict = Depends(get_current_user)
# ):
#     # ... implementation needed ...
#     pass 