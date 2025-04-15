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
COLLECTION_NAME = "RaggerIndex" # Define collection name globally
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150
PROCESSED_HASHES_FILE = Config.Path.PROCESSED_HASHES_FILE # Use config
# UPLOAD_FOLDER = "backend/tmp" # REMOVE - Use Config.Path.DOCUMENTS_DIR instead
TEXT_KEY = "text" # Consistent key for text property

def load_processed_hashes() -> Dict[str, str]:
    # Use path from Config
    hashes_file_path = Config.Path.PROCESSED_HASHES_FILE
    if os.path.exists(hashes_file_path):
        try:
            with open(hashes_file_path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load processed hashes file: {e}")
    return {}

def save_processed_hash(file_hash: str, filename: str, processed_hashes: Dict[str, str]):
    # Use path from Config
    hashes_file_path = Config.Path.PROCESSED_HASHES_FILE 
    processed_hashes[file_hash] = filename
    try:
        with open(hashes_file_path, 'w') as f:
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
    """Checks if the collection exists and creates it with the Weaviate Embeddings vectorizer if not. Raises error if existing config is wrong."""
    collection_name = COLLECTION_NAME
    # --- Use Weaviate Embeddings Model --- 
    expected_vectorizer_model = "Snowflake/snowflake-arctic-embed-l-v2.0"
    # -------------------------------------
    
    if client.collections.exists(collection_name):
        print(f"Collection '{collection_name}' already exists. Verifying configuration...")
        try:
            collection = client.collections.get(collection_name)
            config = collection.config.get()
            
            # 1. Verify Multi-Tenancy 
            mt_config = config.multi_tenancy_config
            if not mt_config or not mt_config.enabled:
                 error_msg = f"Multi-tenancy is DISABLED for existing collection '{collection_name}'. Cannot proceed."
                 print(f"!!!!!!!! CONFIG ERROR: {error_msg} !!!!!!!!")
                 raise ValueError(error_msg)
            elif not mt_config.auto_tenant_creation:
                 print(f"Attempting to enable auto-tenant creation on existing MT collection '{collection_name}'...")
                 try:
                     collection.config.update(
                         multi_tenancy_config=Reconfigure.multi_tenancy(auto_tenant_creation=True)
                     )
                     print(f"Auto-tenant creation enabled.")
                 except Exception as update_e:
                     error_msg = f"Failed to enable auto-tenant creation for '{collection_name}': {update_e}. Cannot proceed."
                     print(f"!!!!!!!! CONFIG ERROR: {error_msg} !!!!!!!!")
                     raise ValueError(error_msg)
            else:
                 print("  Multi-tenancy check passed (Enabled with auto-creation).")

            # 2. Verify Vectorizer Configuration (Check for Weaviate Embeddings and Model)
            vec_config = config.vectorizer_config
            is_correct_vectorizer = False
            if isinstance(vec_config, list) and len(vec_config) == 1:
                # --- Check for Text2VecWeaviateConfig --- 
                module_config = vec_config[0].module_config 
                if isinstance(module_config, weaviate.classes.config.Text2VecWeaviateConfig):
                # ----------------------------------------
                    # Check model name 
                    # Note: Weaviate might store the default if none was explicitly provided during creation.
                    # We check if the explicitly set model matches, or if it's None (implying default was used).
                    # You might need to adjust this check based on Weaviate's exact behavior with defaults.
                    retrieved_model = getattr(module_config, 'model', None) # Safely get model
                    if retrieved_model == expected_vectorizer_model or (retrieved_model is None and expected_vectorizer_model == "Snowflake/snowflake-arctic-embed-l-v2.0"): # Check against expected or default
                        is_correct_vectorizer = True
                        print(f"  Vectorizer check passed (Found compatible Weaviate Embeddings Config - Model: {retrieved_model or 'Default'}).")
                    else:
                         print(f"  Vectorizer mismatch: Found Weaviate Embeddings but model is '{retrieved_model}', expected '{expected_vectorizer_model}'.")
                else:
                     # --- Update expected type --- 
                     print(f"  Vectorizer mismatch: Expected Text2VecWeaviateConfig, found {type(module_config)}.")
                     # --------------------------
            elif vec_config is None:
                 print(f"  Vectorizer mismatch: Expected vectorizer, but found None.")
            else:
                 print(f"  Vectorizer check failed: Unexpected format - {vec_config}")
            
            if not is_correct_vectorizer:
                # Update error message
                error_msg = f"Existing collection '{collection_name}' does not have the correct vectorizer configuration (Expected: Weaviate Embeddings with model {expected_vectorizer_model}). Cannot proceed. Please delete the collection and restart."
                print(f"!!!!!!!! CONFIG ERROR: {error_msg} !!!!!!!!")
                raise ValueError(error_msg) 

            print(f"Configuration verified. Using existing collection '{collection_name}'.")
            return

        except Exception as e:
            print(f"!!!!!!!! ERROR verifying configuration for existing collection '{collection_name}': {e} !!!!!!!!")
            traceback.print_exc()
            raise ValueError(f"Failed to verify configuration for existing collection '{collection_name}': {e}")

    # --- Create Collection if it doesn't exist --- 
    print(f"Collection '{collection_name}' does not exist. Creating with Weaviate Embeddings vectorizer...") # Update log message
    try:
        client.collections.create(
            name=collection_name,
            description="Index for Document RAG with Weaviate Embeddings", # Update description
            properties=[
                Property(name=TEXT_KEY, data_type=DataType.TEXT, description="Content chunk"),
                Property(name="source", data_type=DataType.TEXT, description="Document source filename"),
                Property(name="page", data_type=DataType.INT, description="Page number"),
                Property(name="doc_type", data_type=DataType.TEXT, description="Document type (e.g., pdf)"),
                Property(name="element_index", data_type=DataType.INT, description="Index of element on page"),
                Property(name="doc_hash", data_type=DataType.TEXT, description="Hash of the original document"),
            ],
            # --- Use text2vec_weaviate --- 
            vectorizer_config=[
                Configure.NamedVectors.text2vec_weaviate(
                    name="content_vector",
                    source_properties=[TEXT_KEY],
                    model=expected_vectorizer_model
                )
            ],
            # -----------------------------
            multi_tenancy_config=Configure.multi_tenancy(
                enabled=True,
                auto_tenant_creation=True
            ),
        )
        print(f"Collection '{collection_name}' created successfully with Weaviate Embeddings vectorizer.") # Update log message
        time.sleep(2)
    except Exception as e:
        print(f"!!!!!!!! FATAL ERROR: Failed to create collection '{collection_name}' !!!!!!!!")
        print(f"  Exception: {e}")
        traceback.print_exc()
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
    """Processes all files found in the specific session's temp folder."""
    print(f"Starting processing run for session '{session_id}'")
    
    # --- Determine session-specific upload directory --- 
    session_upload_dir = Config.Path.DOCUMENTS_DIR / session_id
    session_upload_dir_str = str(session_upload_dir)
    print(f"Looking for files in session directory: {session_upload_dir_str}")
    # -------------------------------------------------

    # Check if we're using local vector store
    if Config.USE_LOCAL_VECTOR_STORE:
        print(f"Using LOCAL vector store (FAISS) for session '{session_id}'")
        from ragbase.ingestor import Ingestor
        ingestor = Ingestor()
        
        # --- Check session-specific directory --- 
        if not session_upload_dir.exists():
            # If the session dir doesn't exist, there's nothing to process for this session
            print(f"Session directory {session_upload_dir_str} not found. No files to process.")
            return {"message": f"No files found to process for session '{session_id}'.", 
                    "processed_count": 0, "skipped_count": 0, "failed_files": []}
        
        # Process files ONLY from the session-specific directory
        files_to_process = [f for f in session_upload_dir.iterdir() if f.is_file()]
        # ------------------------------------------
        
        if not files_to_process:
            print(f"No files found in {session_upload_dir_str} to process for session '{session_id}'.")
            return {"message": f"No new files found to process for session '{session_id}'.", 
                    "processed_count": 0, "skipped_count": 0, "failed_files": []}
        
        # --- Rest of local processing logic (unchanged) --- 
        try:
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
        # ------------------------------------------------
    
    # Original Weaviate-based processing logic
    else:
        # --- Ensure collection exists (unchanged) --- 
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

        # --- Check session-specific directory --- 
        if not session_upload_dir.exists():
            # If the session dir doesn't exist, there's nothing to process for this session
            print(f"Session directory {session_upload_dir_str} not found. No files to process.")
            return {"message": f"No files found to process for session '{session_id}'.", 
                    "processed_count": 0, "skipped_count": 0, "failed_files": []}
        
        # Process files ONLY from the session-specific directory
        files_to_process = [f for f in session_upload_dir.iterdir() if f.is_file()]
        # ------------------------------------------
        
        if not files_to_process:
            print(f"No files found in {session_upload_dir_str} to process for session '{session_id}'.")
            return {"message": f"No new files found to process for session '{session_id}'.", 
                    "processed_count": 0, "skipped_count": 0, "failed_files": []}

        print(f"Found {len(files_to_process)} files in session directory {session_upload_dir_str}.")

        # --- Rest of Weaviate processing logic (largely unchanged, but operates on session files) --- 
        for file_path_obj in files_to_process:
            filename = file_path_obj.name
            file_path_str = str(file_path_obj) 
            try:
                processed_hashes = load_processed_hashes() # Load fresh before each file
                file_hash = get_file_hash(file_path_str)
                
                if file_hash in processed_hashes:
                    print(f"Skipping already processed file: {filename} (Hash: {file_hash[:8]}...)")
                    skipped_files_count += 1
                    continue

                print(f"Processing new file: {filename}")
                chunks = load_and_chunk_docs(file_path_str)
                if not chunks:
                    print(f"Failed to load or chunk file: {filename}")
                    failed_files_list.append(filename)
                    continue

                # Add hash and source to metadata
                for chunk in chunks:
                    chunk.metadata["doc_hash"] = file_hash
                    chunk.metadata["source"] = filename 
                
                success = add_chunks_to_weaviate(
                    client=client, 
                    tenant_id=session_id, 
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
                 # --- IMPORTANT: Consider deleting file AFTER successful processing --- 
                 # If you want to remove the file from the session dir after it's in Weaviate
                 # if success: # Only remove if successfully ingested
                 #     try:
                 #         os.remove(file_path_str)
                 #         print(f"Removed temporary file: {filename} from {session_upload_dir_str}")
                 #     except OSError as rm_err:
                 #         print(f"Warning: Could not remove temporary file {filename}: {rm_err}")
                 pass # Current strategy: Leave files in session folders
                 # --------------------------------------------------------------------
                 
        final_message = f"Processing finished for session '{session_id}'. Processed {processed_files_count} new files from session folder, skipped {skipped_files_count}, failed {len(failed_files_list)}."
        if failed_files_list:
             final_message += f" Failed files: {', '.join(failed_files_list)}"
        print(final_message)
        
        return {"message": final_message, "processed_count": processed_files_count, "skipped_count": skipped_files_count, "failed_files": failed_files_list}

# Note: You would typically call process_files_for_session from your API endpoint
#       after potentially getting the Weaviate client instance.