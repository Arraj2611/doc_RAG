from fastapi import APIRouter, Depends, HTTPException
import logging
from typing import Dict, Any, List
from datetime import datetime, timezone
import uuid

from auth import get_current_user
from db import (
    ChatSession,
    ChatMessage,
    create_chat_session,
    get_chat_sessions_by_user_id,
    get_chat_session_by_id,
    add_chat_message,
    get_chat_messages_by_session_id,
    get_database
)

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/chat", tags=["Chat"])

@router.get("/sessions", response_model=List[Dict[str, Any]])
async def get_chat_sessions(current_user: Any = Depends(get_current_user)):
    """Get all chat sessions for the current user."""
    try:
        # Handle both dict and SimpleNamespace objects
        if hasattr(current_user, 'get'):
            user_id = current_user.get("user_id")
        elif hasattr(current_user, 'id'):
            user_id = current_user.id
        else:
            user_id = getattr(current_user, "user_id", "test_user_123")

        logger.info(f"Getting chat sessions for user {user_id}")
        sessions = await get_chat_sessions_by_user_id(user_id)
        return [
            {
                "id": session.id,
                "title": session.title,
                "document_id": session.document_id,
                "document_name": session.document_name,
                "created_at": session.created_at.isoformat(),
                "updated_at": session.updated_at.isoformat()
            }
            for session in sessions
        ]
    except Exception as e:
        logger.error(f"Error getting chat sessions: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving chat sessions")

@router.post("/sessions", response_model=Dict[str, Any])
async def create_new_chat_session(
    session_data: Dict[str, Any],
    current_user: Any = Depends(get_current_user)
):
    """Create a new chat session."""
    try:
        # Handle both dict and SimpleNamespace objects
        if hasattr(current_user, 'get'):
            user_id = current_user.get("user_id")
        elif hasattr(current_user, 'id'):
            user_id = current_user.id
        else:
            user_id = getattr(current_user, "user_id", "test_user_123")

        # Generate a unique session ID
        session_id = str(uuid.uuid4())

        # Create the session
        session = await create_chat_session({
            "id": session_id,
            "user_id": user_id,
            "title": session_data.get("title", f"Chat {datetime.now(timezone.utc).isoformat()}"),
            "document_id": session_data.get("document_id"),
            "document_name": session_data.get("document_name"),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "metadata": session_data.get("metadata", {})
        })

        return {
            "id": session.id,
            "title": session.title,
            "document_id": session.document_id,
            "document_name": session.document_name,
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat()
        }
    except Exception as e:
        logger.error(f"Error creating chat session: {e}")
        raise HTTPException(status_code=500, detail="Error creating chat session")

@router.get("/sessions/{session_id}", response_model=Dict[str, Any])
async def get_chat_session(
    session_id: str,
    current_user: Any = Depends(get_current_user)
):
    """Get a specific chat session."""
    try:
        # Handle both dict and SimpleNamespace objects
        if hasattr(current_user, 'get'):
            user_id = current_user.get("user_id")
        elif hasattr(current_user, 'id'):
            user_id = current_user.id
        else:
            user_id = getattr(current_user, "user_id", "test_user_123")

        session = await get_chat_session_by_id(session_id)

        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        # Check if the session belongs to the current user
        if session.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this chat session")

        return {
            "id": session.id,
            "title": session.title,
            "document_id": session.document_id,
            "document_name": session.document_name,
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chat session: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving chat session")

@router.get("/sessions/{session_id}/messages", response_model=List[Dict[str, Any]])
async def get_chat_messages(
    session_id: str,
    current_user: Any = Depends(get_current_user)
):
    """Get all messages for a specific chat session."""
    try:
        # Handle both dict and SimpleNamespace objects
        if hasattr(current_user, 'get'):
            user_id = current_user.get("user_id")
        elif hasattr(current_user, 'id'):
            user_id = current_user.id
        else:
            user_id = getattr(current_user, "user_id", "test_user_123")

        # First, check if the session exists and belongs to the current user
        session = await get_chat_session_by_id(session_id)

        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        if session.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this chat session")

        # Get the messages
        messages = await get_chat_messages_by_session_id(session_id)

        return [
            {
                "id": message.id,
                "sender": message.sender,
                "content": message.content,
                "timestamp": message.timestamp.isoformat(),
                "document_id": message.document_id,
                "tenant_id": message.tenant_id
            }
            for message in messages
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chat messages: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving chat messages")

@router.post("/sessions/{session_id}/messages", response_model=Dict[str, Any])
async def add_chat_message_to_session(
    session_id: str,
    message_data: Dict[str, Any],
    current_user: Any = Depends(get_current_user)
):
    """Add a new message to a chat session."""
    try:
        # Handle both dict and SimpleNamespace objects
        if hasattr(current_user, 'get'):
            user_id = current_user.get("user_id")
        elif hasattr(current_user, 'id'):
            user_id = current_user.id
        else:
            user_id = getattr(current_user, "user_id", "test_user_123")

        # First, check if the session exists and belongs to the current user
        session = await get_chat_session_by_id(session_id)

        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        if session.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this chat session")

        # Generate a unique message ID
        message_id = str(uuid.uuid4())

        # Add the message
        message = await add_chat_message({
            "id": message_id,
            "session_id": session_id,
            "user_id": user_id,
            "sender": message_data.get("sender", "user"),
            "content": message_data.get("content", ""),
            "timestamp": datetime.now(timezone.utc),
            "document_id": message_data.get("document_id"),
            "tenant_id": message_data.get("tenant_id"),
            "metadata": message_data.get("metadata", {})
        })

        return {
            "id": message.id,
            "sender": message.sender,
            "content": message.content,
            "timestamp": message.timestamp.isoformat(),
            "document_id": message.document_id,
            "tenant_id": message.tenant_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding chat message: {e}")
        raise HTTPException(status_code=500, detail="Error adding chat message")

@router.delete("/sessions/{session_id}", response_model=Dict[str, Any])
async def delete_chat_session(
    session_id: str,
    current_user: Any = Depends(get_current_user)
):
    """Delete a chat session and all its messages."""
    try:
        # Handle both dict and SimpleNamespace objects
        if hasattr(current_user, 'get'):
            user_id = current_user.get("user_id")
        elif hasattr(current_user, 'id'):
            user_id = current_user.id
        else:
            user_id = getattr(current_user, "user_id", "test_user_123")

        # First, check if the session exists and belongs to the current user
        session = await get_chat_session_by_id(session_id)

        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        if session.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this chat session")

        # Delete all messages in the session
        db = get_database()
        await db.chat_messages.delete_many({"session_id": session_id})

        # Delete the session
        await db.chat_sessions.delete_one({"id": session_id})

        return {
            "message": "Chat session deleted successfully",
            "id": session_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chat session: {e}")
        raise HTTPException(status_code=500, detail="Error deleting chat session")
