"""
Models for document handling.
"""
from pydantic import BaseModel
from typing import List, Optional

class DocumentMetadata(BaseModel):
    """Document metadata model"""
    id: str
    name: str
    size: int
    upload_time: str  # ISO format string
    status: str
    doc_type: str
    page_count: int
    tenant_id: str  # Tenant ID for document-specific vector store

class ProcessResponse(BaseModel):
    """Response model for document processing"""
    message: str
    indexed_files: List[str]

class ProcessRequest(BaseModel):
    """Request model for document processing"""
    session_id: Optional[str] = None 