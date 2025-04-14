"""
Document handling API routes.
"""
import os
import traceback
import shutil
import re
import logging
import PyPDF2
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Header, HTTPException, Request, UploadFile, Query
from fastapi.responses import FileResponse

from auth import get_current_user
from models.documents import DocumentMetadata
from ragbase.config import Config
# Import the consolidated Ingestor
from ragbase.ingestor import Ingestor

# Configure logger
logger = logging.getLogger(__name__)

# Define router
router = APIRouter()

# Define allowed extensions
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".xlsx", ".csv"}

def sanitize_filename_for_tenant(filename: str) -> str:
    """
    Sanitize a filename for use as a tenant ID.
    
    Args:
        filename: The filename to sanitize
        
    Returns:
        A sanitized string for use in tenant IDs
    """
    name_without_ext = Path(filename).stem
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', name_without_ext)
    sanitized = sanitized.strip('_')
    max_len = 50
    return sanitized[:max_len] if len(sanitized) > max_len else sanitized

@router.post("/upload", status_code=200) # Changed endpoint to /upload
async def upload_documents(
    files: List[UploadFile] = File(...),
    user_info: dict = Depends(get_current_user)
):
    """
    Upload one or more documents to a user-specific temporary directory.
    Does NOT process or ingest the documents.
    
    Args:
        files: The files to upload
        user_info: User information from JWT
        
    Returns:
        Dict with message and list of saved filenames
    """
    user_id = user_info.get("user_id")
    logger.info(f"Received {len(files)} file(s) for upload from user {user_id}.")
    
    # Use a temporary directory per user for uploads
    user_upload_dir = Config.Path.TEMP_DIR / user_id
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    
    saved_files_info = []

    for file in files:
        try:
            # Basic validation
            if not file.filename:
                logger.warning("Skipping file with no filename.")
                continue
            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in ALLOWED_EXTENSIONS:
                logger.warning(f"Skipping file with unsupported extension: {file.filename}")
                continue

            # Sanitize filename and save
            safe_filename = Path(file.filename).name # Keep original name for user reference
            file_path = user_upload_dir / safe_filename
            
            # Overwrite if exists, or handle differently if needed
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            saved_files_info.append({
                "filename": safe_filename,
                "path": str(file_path)
            })
            logger.info(f"Saved uploaded file for user {user_id}: {safe_filename} to {file_path}")
            
        except Exception as e:
            logger.error(f"Error saving uploaded file {getattr(file, 'filename', '(unknown)')} for user {user_id}: {e}")
            traceback.print_exc()
            # Continue processing other files
        finally:
            await file.close()

    if not saved_files_info:
        raise HTTPException(status_code=400, detail="No valid files were uploaded or saved.")

    return {
        "message": f"Successfully saved {len(saved_files_info)} file(s) for processing.",
        "uploaded_files": saved_files_info # Return list of saved filenames/paths
    }

@router.post("/process", summary="Process uploaded documents")
async def process_documents(
    request: Request,
    user_info: dict = Depends(get_current_user),
):
    """
    Process documents previously uploaded to the user's temp directory.
    Moves processed files to the main documents directory.
    
    Args:
        request: The request object (to access app state)
        user_info: User information from JWT
        
    Returns:
        Dict with processing status and counts.
    """
    user_id = user_info.get("user_id")
    logger.info(f"Received request to process documents for user {user_id}.")

    # Get Weaviate client (if in remote mode)
    weaviate_client = getattr(request.app.state, 'weaviate_client', None)
    if not Config.USE_LOCAL_VECTOR_STORE and not weaviate_client:
        logger.error(f"Weaviate client not available in app state for user {user_id} processing.")
        raise HTTPException(status_code=500, detail="Vector store client not configured or unavailable.")

    # --- Find documents in the user's temporary upload directory ---
    user_upload_dir = Config.Path.TEMP_DIR / user_id
    if not user_upload_dir.exists() or not any(f.is_file() for f in user_upload_dir.iterdir()):
        logger.warning(f"No documents found in upload directory {user_upload_dir} for user {user_id}")
        raise HTTPException(status_code=400, detail="No documents found in upload directory for processing. Please upload first.")

    documents_to_process = [f for f in user_upload_dir.iterdir() if f.is_file() and f.suffix.lower() in ALLOWED_EXTENSIONS]

    if not documents_to_process:
        logger.warning(f"No processable documents found (after filtering) in {user_upload_dir} for user {user_id}")
        raise HTTPException(status_code=400, detail="No processable documents found in upload directory.")

    logger.info(f"Found {len(documents_to_process)} documents to process for user {user_id} in {user_upload_dir}.")

    processed_count = 0
    moved_count = 0
    errors = []
    processed_details = []

    # --- Initialize Ingestor ---
    try:
        # Pass Weaviate client only if not using local store
        client_param = weaviate_client if not Config.USE_LOCAL_VECTOR_STORE else None
        ingestor = Ingestor(weaviate_client=client_param)
    except Exception as e:
        logger.error(f"Failed to initialize Ingestor for user {user_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to initialize ingestion engine: {e}")

    # --- Process each document ---
    # In Weaviate mode, each document gets its own tenant.
    # In FAISS mode, all documents are added to the single local index.
    user_perm_doc_dir = Config.Path.DOCUMENTS_DIR / user_id
    user_perm_doc_dir.mkdir(parents=True, exist_ok=True)

    for doc_path in documents_to_process:
        tenant_id = None
        ingest_successful = False
        try:
            # Determine tenant ID only needed for Weaviate
            if not Config.USE_LOCAL_VECTOR_STORE:
                safe_filename_part = sanitize_filename_for_tenant(doc_path.name)
                tenant_id = f"user_{user_id}_doc_{safe_filename_part}"
                logger.info(f"Processing document: {doc_path.name} for user {user_id} with Tenant ID: {tenant_id}")
            else:
                logger.info(f"Processing document locally (FAISS): {doc_path.name} for user {user_id}")
            
            # Ingest the single document (Ingestor handles mode)
            # Pass tenant_id only if not local
            ingest_successful = ingestor.ingest([doc_path], tenant_id=tenant_id if not Config.USE_LOCAL_VECTOR_STORE else None)
            
            if ingest_successful:
                logger.info(f"Successfully ingested document: {doc_path.name} (Tenant: {tenant_id or 'FAISS'})")
                processed_count += 1
                processed_details.append({"filename": doc_path.name, "status": "Processed", "tenant_id": tenant_id or "local"})
                
                # Move file from temp to permanent storage after successful ingest
                try:
                    destination_path = user_perm_doc_dir / doc_path.name
                    shutil.move(str(doc_path), str(destination_path))
                    logger.info(f"Moved processed file {doc_path.name} to {destination_path}")
                    moved_count += 1
                except Exception as move_e:
                    err_msg = f"Error moving processed file {doc_path.name}: {move_e}"
                    logger.error(err_msg)
                    errors.append(err_msg)
                    # Mark this specific file as having an error
                    detail = next((item for item in processed_details if item["filename"] == doc_path.name), None)
                    if detail: detail["status"] = f"Processed, Move Failed: {move_e}"
                    
            else:
                # Ingestion failed for this document
                error_msg = f"Ingestion failed for document {doc_path.name} (Tenant: {tenant_id or 'FAISS'})"
                logger.error(error_msg)
                errors.append(error_msg)
                processed_details.append({"filename": doc_path.name, "status": "Ingestion Failed", "tenant_id": tenant_id or "local"})

        except Exception as e:
            error_msg = f"Critical error processing document {doc_path.name} (Tenant: {tenant_id or 'FAISS'}): {str(e)}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
            errors.append(error_msg)
            processed_details.append({"filename": doc_path.name, "status": f"Processing Error: {e}", "tenant_id": tenant_id or "local"})
            # Continue processing other documents

    # --- Return summary ---
    total_attempted = len(documents_to_process)
    final_message = f"Processing complete for user {user_id}. Attempted: {total_attempted}, Ingested: {processed_count}, Moved: {moved_count}."
    
    if errors:
        logger.warning(f"{final_message} Errors occurred: {len(errors)}")
        # Return 207 Multi-Status if some succeeded but errors occurred
        status_code = 500 if processed_count == 0 else 207 
        return {
            "message": final_message,
            "status_code": status_code, # Informative for client
            "processed_details": processed_details,
            "errors": errors
        }
    else:
        logger.info(final_message)
        return {
            "message": final_message,
            "processed_details": processed_details,
            "processed_count": processed_count, # Kept for backward compatibility?
            "moved_count": moved_count
        }

def get_pdf_page_count(file_path: Path) -> int:
    """
    Get the number of pages in a PDF file.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        The number of pages, or 0 on error
    """
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            # Check if encrypted and needs password (not handled here)
            if pdf_reader.is_encrypted:
                logger.warning(f"PDF {file_path.name} is encrypted, cannot get page count.")
                return 0
            return len(pdf_reader.pages)
    except PyPDF2.errors.PdfReadError as pdf_err:
        logger.error(f"Error reading PDF {file_path.name} (corrupted?): {pdf_err}")
        return 0
    except Exception as e:
        logger.error(f"Unexpected error getting page count for {file_path.name}: {e}")
        return 0

def format_file_size(bytes_val: int) -> str:
    """
    Format file size in a human-readable format.
    
    Args:
        bytes_val: The size in bytes
        
    Returns:
        A formatted string representation of the size
    """
    if bytes_val < 1024:
        return f"{bytes_val} B"
    elif bytes_val < 1024**2:
        return f"{(bytes_val / 1024):.1f} KB"
    elif bytes_val < 1024**3:
        return f"{(bytes_val / (1024**2)):.1f} MB"
    else:
        return f"{(bytes_val / (1024**3)):.1f} GB"

@router.get("", response_model=List[DocumentMetadata])
async def get_user_documents(
    user_info: dict = Depends(get_current_user),
    user_id_query: Optional[str] = Query(None, alias="user_id") # Allow admin override
):
    """
    Get list of processed documents for a user from the permanent storage directory.
    Includes the unique tenant ID for Weaviate-stored documents.
    
    Args:
        user_info: User information from JWT
        user_id_query: Optional user ID override (for potential admin use)
        
    Returns:
        List of document metadata
    """
    # Determine effective user ID
    effective_user_id = user_id_query or user_info.get("user_id")
    if not effective_user_id:
        logger.error("User ID could not be determined for get_user_documents.")
        raise HTTPException(status_code=400, detail="User ID could not be determined.")
        
    logger.info(f"Request for processed documents for user_id: {effective_user_id}")

    # Look in the user's *permanent* document directory
    user_perm_doc_dir = Config.Path.DOCUMENTS_DIR / effective_user_id
    documents = []
    
    if user_perm_doc_dir.exists():
        logger.info(f"Directory {user_perm_doc_dir} exists. Listing files...")
        try:
            file_list = list(user_perm_doc_dir.iterdir()) 
            logger.info(f"Found {len(file_list)} total items in directory (before filtering).")
            
            for file_path in file_list:
                if file_path.is_file() and file_path.suffix.lower() in ALLOWED_EXTENSIONS:
                    logger.debug(f"Processing file: {file_path.name}")
                    try:
                        file_stat = file_path.stat()
                        file_ext = file_path.suffix.lower()
                        pages = get_pdf_page_count(file_path) if file_ext == ".pdf" else 1
                            
                        # Determine tenant ID (relevant for Weaviate)
                        if not Config.USE_LOCAL_VECTOR_STORE:
                            safe_filename_part = sanitize_filename_for_tenant(file_path.name)
                            doc_tenant_id = f"user_{effective_user_id}_doc_{safe_filename_part}"
                        else:
                            doc_tenant_id = "local" # Indicate local storage

                        document_details = DocumentMetadata(
                            # Use relative path or just filename? Using filename for simplicity.
                            id=file_path.name, 
                            name=file_path.name,
                            size=file_stat.st_size,
                            upload_time=datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                            status="Processed", # Assumed as it's in the permanent dir
                            doc_type=file_ext.strip('.'),
                            page_count=pages,
                            tenant_id=doc_tenant_id 
                        )
                        documents.append(document_details)
                    except Exception as e:
                        logger.error(f"Error processing file details for {file_path.name}: {e}")
                elif file_path.is_file():
                    logger.debug(f"Skipping file with disallowed extension: {file_path.name}")
        except OSError as os_err:
            logger.error(f"Error listing directory {user_perm_doc_dir}: {os_err}")
            # Decide if this should be a server error or empty list
            # raise HTTPException(status_code=500, detail="Error accessing user document storage.")
    else:
        logger.warning(f"Permanent documents directory {user_perm_doc_dir} does NOT exist for user {effective_user_id}.")

    logger.info(f"Returning {len(documents)} processed documents for user {effective_user_id}")
    return documents

@router.delete("/{document_filename}")
async def delete_document(
    document_filename: str,
    user_info: dict = Depends(get_current_user)
):
    """
    Delete a processed document from the permanent storage directory.
    Note: This currently only deletes the file, not the corresponding vectors 
    in Weaviate or FAISS. Vector cleanup requires additional implementation.
    
    Args:
        document_filename: Filename of the document to delete (not the full path)
        user_info: User information from JWT
        
    Returns:
        Dict with deletion status message
    """
    user_id = user_info.get("user_id")
    logger.info(f"Request to delete document '{document_filename}' for user {user_id}")
    
    # Construct path in the user's permanent directory
    user_perm_doc_dir = Config.Path.DOCUMENTS_DIR / user_id
    document_path = user_perm_doc_dir / document_filename 
    
    # --- TODO: Implement Vector Deletion --- 
    # - For Weaviate: Need to delete the tenant associated with this file.
    #   Requires getting the tenant_id (e.g., `user_{user_id}_doc_{sanitized_filename}`) 
    #   and using `client.collections.get(COLLECTION).tenants.delete([tenant_id])`
    # - For FAISS: Requires finding and removing vectors by metadata (e.g., source filename).
    #   This is complex with standard FAISS; might involve rebuilding the index 
    #   or using a vector DB that supports deletion by metadata.
    logger.warning(f"File deletion requested for '{document_filename}', but vector deletion is NOT YET IMPLEMENTED.")
    # ----------------------------------------
    
    try:
        # Check if file exists
        if not document_path.is_file():
            logger.error(f"Document not found for deletion: {document_path}")
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Delete the file
        document_path.unlink()
        logger.info(f"Successfully deleted file: {document_path}")
        
        return {"message": "Document file deleted successfully. Vector cleanup pending implementation."}
        
    except HTTPException:
        raise # Re-raise FastAPI exceptions
    except Exception as e:
        logger.error(f"Error deleting document file {document_path}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error deleting document file: {str(e)}")

@router.get("/{document_filename}/content")
async def get_document_content(
    document_filename: str,
    user_info: dict = Depends(get_current_user)
):
    """
    Serve the content of a *processed* document from the permanent storage directory.
    
    Args:
        document_filename: Filename of the document to view
        user_info: User information from JWT
        
    Returns:
        FileResponse with the document content
    """
    user_id = user_info.get("user_id")
    logger.info(f"Request for content of document '{document_filename}' for user {user_id}")
    
    # Look for the file in the user's permanent document directory
    user_perm_doc_dir = Config.Path.DOCUMENTS_DIR / user_id
    document_path = user_perm_doc_dir / document_filename
    
    logger.debug(f"Looking for document content at: {document_path}")
    
    if not document_path.is_file():
        logger.error(f"Document content not found: {document_path}")
        raise HTTPException(status_code=404, detail=f"Document '{document_filename}' not found in processed documents.")
        
    logger.info(f"Serving document content from {document_path}")
    
    # Determine media type (simple check)
    media_type = "application/octet-stream" # Default
    if document_path.suffix.lower() == ".pdf":
        media_type = "application/pdf"
    elif document_path.suffix.lower() in [".png", ".jpg", ".jpeg", ".gif"]:
        media_type = f"image/{document_path.suffix.lower().strip('.')}"
        
    return FileResponse(
        path=document_path,
        media_type=media_type, # Basic type detection
        filename=document_path.name # Suggest original filename to browser
    )

@router.get("/{document_filename}/download")
async def download_document(
    document_filename: str,
    user_info: dict = Depends(get_current_user)
):
    """
    Download a *processed* document from the permanent storage directory.
    
    Args:
        document_filename: Filename of the document to download
        user_info: User information from JWT
        
    Returns:
        FileResponse forcing download
    """
    user_id = user_info.get("user_id")
    logger.info(f"Request to download document '{document_filename}' for user {user_id}")
    
    user_perm_doc_dir = Config.Path.DOCUMENTS_DIR / user_id
    document_path = user_perm_doc_dir / document_filename
    
    logger.debug(f"Looking for document to download at: {document_path}")
    
    if not document_path.is_file():
        logger.error(f"Document not found for download: {document_path}")
        raise HTTPException(status_code=404, detail=f"Document '{document_filename}' not found for download.")
        
    logger.info(f"Serving document for download from {document_path}")
    
    return FileResponse(
        path=document_path,
        media_type='application/octet-stream', # Force download
        filename=document_path.name
    ) 