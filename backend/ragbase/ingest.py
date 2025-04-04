import os
import json
import time
import hashlib
import traceback
from typing import List, Dict, Any
from pathlib import Path

import weaviate
from weaviate.util import generate_uuid5 # Example for generating IDs
from langchain_core.documents import Document # Ensure Document is imported if used

from langchain_community.document_loaders import UnstructuredFileLoader # Assuming this loader
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Import Weaviate configuration classes
from weaviate.classes.config import (
    Configure,
    Property,
    DataType,
    Tokenization,
    Reconfigure,
)

# Import Config
from ragbase.config import Config

# --- Configuration --- 
COLLECTION_NAME = "DocRagIndex" # Define collection name globally
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150
PROCESSED_HASHES_FILE = "backend/processed_hashes.json"
UPLOAD_FOLDER = "backend/tmp"
TEXT_KEY = "text" # Consistent key for text property

def load_processed_hashes() -> Dict[str, str]:
    if os.path.exists(PROCESSED_HASHES_FILE):
        try:
            with open(PROCESSED_HASHES_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load processed hashes file: {e}")
    return {}

def save_processed_hash(file_hash: str, filename: str, processed_hashes: Dict[str, str]):
    processed_hashes[file_hash] = filename
    try:
        with open(PROCESSED_HASHES_FILE, 'w') as f:
            json.dump(processed_hashes, f, indent=2)
    except IOError as e:
        print(f"Warning: Could not save processed hashes file: {e}")

def get_file_hash(file_path: str) -> str:
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as file:
        while chunk := file.read(8192):
            hasher.update(chunk)
    return hasher.hexdigest()

def ensure_collection_exists(client: weaviate.Client):
    """Checks if the collection exists and creates it with the correct schema if not."""
    collection_name = COLLECTION_NAME
    
    # Check if collection exists using Weaviate v4 API
    if client.collections.exists(collection_name):
        print(f"Collection '{collection_name}' already exists. Verifying configuration (basic check)...")
        # Basic verification (can be expanded)
        try:
            collection = client.collections.get(collection_name)
            config = collection.config.get()
            
            if not config.multi_tenancy_config.enabled:
                print(f"!!!!!!!! WARNING: Multi-tenancy is DISABLED for existing collection '{collection_name}'. Re-enabling is complex and data loss prone via client. Consider manual WCD check/fix or deletion.")
            elif not config.multi_tenancy_config.auto_tenant_creation:
                print(f"Attempting to enable auto-tenant creation on existing MT collection '{collection_name}'...")
                collection.config.update(
                    multi_tenancy_config=Reconfigure.multi_tenancy(auto_tenant_creation=True)
                )
                print(f"Auto-tenant creation enabled.")
        except Exception as e:
            print(f"Warning: Could not verify configuration for existing collection '{collection_name}': {e}")
        
        print(f"Skipping creation. Assuming existing schema is acceptable.")
        return

    # If collection doesn't exist, create it
    print(f"Collection '{collection_name}' does not exist. Creating...")
    try:
        # Create collection using v4 API
        client.collections.create(
            name=collection_name,
            description="Index for Document RAG",
            properties=[
                Property(name=TEXT_KEY, data_type=DataType.TEXT, description="Content chunk"),
                Property(name="source", data_type=DataType.TEXT, description="Document source filename"),
                Property(name="page", data_type=DataType.INT, description="Page number"),
                Property(name="doc_type", data_type=DataType.TEXT, description="Document type (e.g., pdf)"),
                Property(name="element_index", data_type=DataType.INT, description="Index of element on page"),
                Property(name="doc_hash", data_type=DataType.TEXT, description="Hash of the original document"),
            ],
            # Vectorizer configuration
            vectorizer_config=Configure.Vectorizer.none(),
            # Enable multi-tenancy
            multi_tenancy_config=Configure.multi_tenancy(
                enabled=True,
                auto_tenant_creation=True
            ),
        )
        print(f"Collection '{collection_name}' created successfully.")
        # Add a small delay after creation might sometimes help consistency
        time.sleep(2)
    except Exception as e:
        print(f"!!!!!!!! FATAL ERROR: Failed to create collection '{collection_name}' !!!!!!!!")
        print(f"  Exception: {e}")
        traceback.print_exc()
        # Re-raise to stop processing if collection creation fails
        raise e

def add_chunks_to_weaviate(client: weaviate.Client, tenant_id: str, chunks: List[Document], text_key: str = TEXT_KEY):
    """Adds document chunks to Weaviate one by one for a specific tenant with individual error checking."""
    
    print(f"Ingestor: Preparing to add {len(chunks)} chunks one-by-one to tenant '{tenant_id}'...")
    collection_name = COLLECTION_NAME
    
    # Check if collection exists
    if not client.collections.exists(collection_name):
        print(f"Collection '{collection_name}' not found. Create it first.")
        return False
    
    # Get collection and check/create tenant
    try:
        collection = client.collections.get(collection_name)
        
        # Get all tenants and check if our tenant exists
        tenants = collection.tenants.get()
        
        # Check if tenant exists - handle both string and object formats
        tenant_exists = False
        for tenant in tenants:
            # If tenant is an object with name attribute
            if hasattr(tenant, 'name') and tenant.name == tenant_id:
                tenant_exists = True
                break
            # If tenant is a string
            elif isinstance(tenant, str) and tenant == tenant_id:
                tenant_exists = True
                break
            # If tenant is a dict with name key
            elif isinstance(tenant, dict) and tenant.get('name') == tenant_id:
                tenant_exists = True
                break
        
        if not tenant_exists:
            print(f"Ingestor: Tenant '{tenant_id}' not found, creating it.")
            from weaviate.collections.classes.tenants import Tenant
            collection.tenants.create(Tenant(name=tenant_id))
            print(f"Created tenant '{tenant_id}'")
        else:
            print(f"Tenant '{tenant_id}' already exists")
        
        # Get tenant-specific collection handle
        collection_tenant = collection.with_tenant(tenant_id)
        print(f"  Obtained handle for tenant '{tenant_id}'.")
    except Exception as e:
        print(f"!!!!!!!! ERROR setting up tenant '{tenant_id}': {e} !!!!!!!!")
        traceback.print_exc()  # Add traceback for better debugging
        return False
    
    successful_inserts = 0
    failed_inserts = 0
    source_identifier = chunks[0].metadata.get('source', 'Unknown') if chunks else 'Unknown'

    # --- Insert Objects One by One --- 
    print(f"  Starting individual inserts for {len(chunks)} chunks...")
    for i, chunk in enumerate(chunks):
        if not hasattr(chunk, 'page_content') or not chunk.page_content:
            print(f"    Skipping chunk {i+1}/{len(chunks)}: Missing or empty page_content.")
            continue

        # --- Explicitly remove coordinates from metadata BEFORE creating properties --- 
        if chunk.metadata and 'coordinates' in chunk.metadata:
            del chunk.metadata['coordinates']

        try:
            # Create properties dict with content
            properties = {
                text_key: chunk.page_content
            }
            
            # Add metadata fields as properties
            for key, value in chunk.metadata.items():
                if key != 'coordinates':
                    properties[key] = value
            
            # Insert data with tenant-specific collection handle
            uuid = collection_tenant.data.insert(properties)
            successful_inserts += 1
            
        except Exception as e:
            print(f"!!!!!!!! ERROR inserting chunk {i+1}/{len(chunks)} for tenant '{tenant_id}': !!!!!!!!")
            print(f"  Properties attempted: {properties}") 
            print(f"  Exception Type: {type(e).__name__}")
            print(f"  Exception Args: {e.args}")
            failed_inserts += 1

        if (i + 1) % 10 == 0: # Log progress
             print(f"    Progress: Attempted {i+1}/{len(chunks)} inserts ({successful_inserts} success, {failed_inserts} failed)...")

    print(f"Ingestor: Finished individual inserts for source '{source_identifier}' for tenant '{tenant_id}'.")
    print(f"  Total Successful: {successful_inserts}/{len(chunks)}")
    print(f"  Total Failed:     {failed_inserts}/{len(chunks)}")

    # Return True if at least one insert succeeded, or adjust as needed
    if successful_inserts > 0:
        return True 
    else:
        # If zero successes (either no chunks or all failed)
        return False

def load_and_chunk_docs(file_path: str, chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP) -> List[Document]:
    """Loads a document and splits it into chunks."""
    try:
        print(f"Ingestor: Loading document: {file_path}")
        # --- Modify Loader to use 'fast' strategy --- 
        loader = UnstructuredFileLoader(
             file_path,
             mode="elements", 
             strategy="fast" # Use "fast" to potentially skip coordinate generation
        )
        # -------------------------------------------
        docs = loader.load()
        print(f"Ingestor: Loaded {len(docs)} elements initially.")

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size, 
            chunk_overlap=chunk_overlap
        )
        chunks = text_splitter.split_documents(docs)
        print(f"Ingestor: Split into {len(chunks)} chunks.")
        
        # --- Optional: Double-check metadata AFTER splitting --- 
        # It's possible coordinates are re-introduced or modified during splitting,
        # though less likely. If the strategy="fast" doesn't work, 
        # we might need to explicitly delete coordinates from `chunks` here.
        # for i, chunk in enumerate(chunks):
        #     if chunk.metadata and 'coordinates' in chunk.metadata:
        #         print(f"    DEBUG: Deleting coordinates from final chunk {i+1}")
        #         del chunk.metadata['coordinates']
        # --------------------------------------------------------
        
        return chunks
    except Exception as e:
        print(f"Error loading/chunking document {file_path}: {e}")
        return []

# --- Main Processing Function (Example Structure) --- 
def process_files_for_session(session_id: str, client: weaviate.Client = None) -> Dict[str, Any]:
    """Processes all files found in the temp folder for the given session."""
    print(f"Starting processing run for session '{session_id}'")
    
    # Check if we're using local vector store
    if Config.USE_LOCAL_VECTOR_STORE:
        print(f"Using LOCAL vector store (FAISS) for session '{session_id}'")
        # Use ingestor to handle local mode
        from ragbase.ingestor import Ingestor
        ingestor = Ingestor()
        
        # Ensure upload folder exists
        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER)
            print(f"Created upload folder: {UPLOAD_FOLDER}")
        
        # Process files in upload folder
        files_to_process = [Path(os.path.join(UPLOAD_FOLDER, f)) for f in os.listdir(UPLOAD_FOLDER) 
                           if os.path.isfile(os.path.join(UPLOAD_FOLDER, f))]
        
        if not files_to_process:
            print(f"No files found in {UPLOAD_FOLDER} to process for session '{session_id}'.")
            return {"message": f"No new files found to process for session '{session_id}'.", 
                    "processed_count": 0, "skipped_count": 0, "failed_files": []}
        
        try:
            # Use ingestor to handle local FAISS ingestion
            success = ingestor.ingest(files_to_process)
            
            if success:
                return {"message": f"Successfully processed {len(files_to_process)} files for session '{session_id}'", 
                        "processed_count": len(files_to_process), "skipped_count": 0, "failed_files": []}
            else:
                return {"message": f"Failed to process files for session '{session_id}'", 
                        "processed_count": 0, "skipped_count": 0, "failed_files": [f.name for f in files_to_process]}
        except Exception as e:
            print(f"Error processing files for session '{session_id}': {e}")
            traceback.print_exc()
            return {"message": f"Error processing files: {str(e)}", 
                    "processed_count": 0, "skipped_count": 0, "failed_files": [f.name for f in files_to_process]}
    
    # Original Weaviate-based processing logic
    else:
        # --- Ensure collection exists --- 
        try:
            if not client:
                msg = "Weaviate client is required for remote vector store mode"
                print(msg)
                return {"message": msg, "processed_count": 0, "skipped_count": 0, "failed_files": []}
                
            ensure_collection_exists(client)
        except Exception as e:
            msg = f"Stopping processing for session {session_id} due to collection setup error: {e}"
            print(msg)
            return {"message": msg, "processed_count": 0, "skipped_count": 0, "failed_files": []}
        # ---------------------------------

        processed_files_count = 0
        skipped_files_count = 0
        failed_files_list = []
        processed_hashes = load_processed_hashes()

        # Ensure upload folder exists
        if not os.path.exists(UPLOAD_FOLDER):
             os.makedirs(UPLOAD_FOLDER)
             print(f"Created upload folder: {UPLOAD_FOLDER}")

        # Process files in the upload folder (adjust path/filtering as needed)
        files_to_process = [f for f in os.listdir(UPLOAD_FOLDER) if os.path.isfile(os.path.join(UPLOAD_FOLDER, f))]
        if not files_to_process:
            print(f"No files found in {UPLOAD_FOLDER} to process for session '{session_id}'.")
            return {"message": f"No new files found to process for session '{session_id}'.", "processed_count": 0, "skipped_count": 0, "failed_files": []}

        print(f"Found {len(files_to_process)} files in upload folder.")

        for filename in files_to_process:
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            try:
                file_hash = get_file_hash(file_path)
                if file_hash in processed_hashes:
                    print(f"Skipping already processed file: {filename} (Hash: {file_hash[:8]}...)")
                    skipped_files_count += 1
                    continue

                print(f"Processing new file: {filename}")
                chunks = load_and_chunk_docs(file_path)
                if not chunks:
                    print(f"Failed to load or chunk file: {filename}")
                    failed_files_list.append(filename)
                    continue

                # Add hash and source to metadata *after* chunking
                for chunk in chunks:
                    chunk.metadata["doc_hash"] = file_hash
                    chunk.metadata["source"] = filename # Store original filename
                
                # Attempt to add chunks to Weaviate for the current session/tenant
                success = add_chunks_to_weaviate(
                    client=client, 
                    tenant_id=session_id, # Use session_id as tenant_id
                    chunks=chunks
                )

                if success:
                    print(f"Successfully processed and ingested: {filename}")
                    save_processed_hash(file_hash, filename, processed_hashes)
                    processed_files_count += 1
                else:
                    print(f"Failed to ingest chunks for file: {filename}")
                    failed_files_list.append(filename)
            
            except Exception as e:
                 print(f"!!!!!!!! UNEXPECTED ERROR processing file {filename}: {e} !!!!!!!!")
                 traceback.print_exc()
                 failed_files_list.append(filename)
            finally:
                 # Optionally remove file after processing attempt
                 # try:
                 #     os.remove(file_path)
                 #     print(f"Removed temporary file: {filename}")
                 # except OSError as rm_err:
                 #     print(f"Warning: Could not remove temporary file {filename}: {rm_err}")
                 pass # Decide on file removal strategy
                 
        final_message = f"Processing finished for session '{session_id}'. Processed {processed_files_count} new files, skipped {skipped_files_count}, failed {len(failed_files_list)}."
        if failed_files_list:
             final_message += f" Failed files: {', '.join(failed_files_list)}"
        print(final_message)
        
        return {"message": final_message, "processed_count": processed_files_count, "skipped_count": skipped_files_count, "failed_files": failed_files_list}

# Note: You would typically call process_files_for_session from your API endpoint
#       after potentially getting the Weaviate client instance.