from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import logging
from typing import Dict, Any, List
from datetime import datetime, timezone
import uuid
import os
from pathlib import Path
import shutil

from auth import get_current_user
from db import (
    create_document,
    get_documents_by_user_id,
    get_document_by_id,
    update_document_status
)
from ragbase.config import Config

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/documents", tags=["Documents"])

# Define allowed extensions
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".xlsx", ".csv"}

@router.get("/", response_model=List[Dict[str, Any]])
async def get_documents(current_user: Any = Depends(get_current_user)):
    """Get all documents for the current user."""
    try:
        documents = await get_documents_by_user_id(current_user.id)
        return [
            {
                "id": doc.id,
                "name": doc.name,
                "size": doc.size,
                "type": doc.doc_type,
                "upload_time": doc.upload_time.isoformat(),
                "status": doc.status,
                "page_count": doc.page_count,
                "tenant_id": doc.tenant_id,
                "processed": doc.processed
            }
            for doc in documents
        ]
    except Exception as e:
        logger.error(f"Error getting documents: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving documents")

@router.get("/{document_id}", response_model=Dict[str, Any])
async def get_document(
    document_id: str,
    current_user: Any = Depends(get_current_user)
):
    """Get a specific document."""
    try:
        document = await get_document_by_id(document_id)

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # Check if the document belongs to the current user
        if document.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this document")

        return {
            "id": document.id,
            "name": document.name,
            "size": document.size,
            "type": document.doc_type,
            "upload_time": document.upload_time.isoformat(),
            "status": document.status,
            "page_count": document.page_count,
            "tenant_id": document.tenant_id,
            "processed": document.processed
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving document")

@router.post("/upload", response_model=Dict[str, Any])
async def upload_document(
    files: List[UploadFile] = File(...),
    current_user: Any = Depends(get_current_user)
):
    """Upload a new document."""
    try:
        # Create user-specific directory if it doesn't exist
        user_dir = Config.Path.DOCUMENTS_DIR / current_user.id
        user_dir.mkdir(parents=True, exist_ok=True)

        uploaded_documents = []

        for file in files:
            # Validate file extension
            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in ALLOWED_EXTENSIONS:
                logger.warning(f"Skipping file with unsupported extension: {file.filename}")
                continue

            # Generate a unique document ID
            document_id = str(uuid.uuid4())

            # Save the file
            safe_filename = Path(file.filename).name
            file_path = user_dir / safe_filename

            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # Get file size
            file_size = os.path.getsize(file_path)

            # Create a tenant ID for this document
            tenant_id = f"user_{current_user.id}_doc_{document_id}"

            # Create document in database
            document = await create_document({
                "id": document_id,
                "name": safe_filename,
                "user_id": current_user.id,
                "size": file_size,
                "type": file_ext,
                "upload_time": datetime.now(timezone.utc),
                "status": "uploaded",
                "doc_type": file_ext.replace(".", ""),
                "page_count": 0,
                "tenant_id": tenant_id,
                "processed": False,
                "metadata": {}
            })

            uploaded_documents.append({
                "id": document.id,
                "name": document.name,
                "size": document.size,
                "type": document.doc_type,
                "upload_time": document.upload_time.isoformat(),
                "status": document.status,
                "tenant_id": document.tenant_id
            })

        if not uploaded_documents:
            raise HTTPException(status_code=400, detail="No valid files were uploaded")

        return {
            "message": f"Successfully uploaded {len(uploaded_documents)} file(s)",
            "documents": uploaded_documents
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document: {e}")
        raise HTTPException(status_code=500, detail="Error uploading document")

@router.put("/{document_id}/status", response_model=Dict[str, Any])
async def update_document_status_endpoint(
    document_id: str,
    status_data: Dict[str, Any],
    current_user: Any = Depends(get_current_user)
):
    """Update the status of a document."""
    try:
        # First, check if the document exists and belongs to the current user
        document = await get_document_by_id(document_id)

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        if document.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this document")

        # Update the status
        new_status = status_data.get("status")
        if not new_status:
            raise HTTPException(status_code=400, detail="Status is required")

        updated_document = await update_document_status(document_id, new_status)

        return {
            "id": updated_document.id,
            "name": updated_document.name,
            "status": updated_document.status,
            "message": f"Document status updated to {new_status}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating document status: {e}")
        raise HTTPException(status_code=500, detail="Error updating document status")
