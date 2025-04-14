"""
Models for chat functionality.
"""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ChatRequest(BaseModel):
    """Request model for standard chat"""
    session_id: str
    query: str

class ChatResponse(BaseModel):
    """Response model for standard chat"""
    answer: str
    sources: List[Dict[str, Any]] = []

class ChatStreamRequest(BaseModel):
    """Request model for streaming chat"""
    question: str
    session_id: Optional[str] = None  # For general session management
    tenant_id: Optional[str] = None  # For document-specific tenant

class SystemPromptPreference(BaseModel):
    """System prompt preference model"""
    user_id: str
    response_style: str 