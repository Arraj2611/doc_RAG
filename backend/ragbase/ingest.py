import os
import json
import time
import hashlib
import traceback
from typing import List, Dict, Any
from pathlib import Path

import weaviate
from weaviate.util import generate_uuid5 # Example for generating IDs
from langchain_core.documents import Document # Ensure Document is imported

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
from .config import Config

# Import Tenant class
from weaviate.collections.classes.tenants import Tenant
from weaviate.classes.query import Filter # Ensure Filter is imported

# --- Configuration --- 
COLLECTION_NAME = "RaggerIndex" # Define collection name globally
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150
TEXT_KEY = "text" # Consistent key for text property

def get_file_hash(file_path: str) -> str:
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as file:
        while chunk := file.read(8192):
            hasher.update(chunk)
    return hasher.hexdigest()

def ensure_collection_exists(client: weaviate.Client):
    """Checks if the collection exists. If not, creates it. If it exists, returns the handle without deep verification."""
    collection_name = COLLECTION_NAME
    expected_vectorizer_model = Config.Database.WEAVIATE_EMBEDDING_MODEL # Still needed for creation

    if client.collections.exists(collection_name):
        print(f"Collection '{collection_name}' exists. Assuming configuration is correct and returning handle.")
        # --- Skip verification, just get the existing collection ---
        try:
             collection = client.collections.get(collection_name)
             # Basic check that MT is enabled, as this is critical for the rest of the code
             # config = collection.config.get()
             # mt_config = config.multi_tenancy_config
             # if not mt_config or not mt_config.enabled:
             #     print(f"WARNING: Multi-tenancy appears disabled on existing collection '{collection_name}'. This might cause issues.")
             #     # Decide whether to raise error or proceed cautiously
             #     # raise ValueError(f"Multi-tenancy is disabled for existing collection '{collection_name}'.")
             return collection
        except Exception as e:
             print(f"!!!!!!!! ERROR getting existing collection '{collection_name}': {e} !!!!!!!!")
             traceback.print_exc()
             raise # Re-raise error if we can't even get the collection handle
        # ----------------------------------------------------------
    else:
        # --- Create Collection with correct config if it doesn't exist ---
        print(f"Collection '{collection_name}' does not exist. Creating with Weaviate Embeddings and Multi-Tenancy...")
        try:
            vectorizer_config = [ # Define vectorizer config for creation
                Configure.NamedVectors.text2vec_weaviate(
                    name="content_vector",
                    source_properties=[TEXT_KEY],
                    model=expected_vectorizer_model
                )
            ]
            collection = client.collections.create(
                name=collection_name,
                description="Index for Document RAG with Weaviate Embeddings and Multi-Tenancy",
                properties=[
                    Property(name=TEXT_KEY, data_type=DataType.TEXT, description="Content chunk"),
                    Property(name="source", data_type=DataType.TEXT, description="Document source filename"),
                    Property(name="page", data_type=DataType.INT, description="Page number"),
                    Property(name="doc_type", data_type=DataType.TEXT, description="Document type (e.g., pdf)"),
                    Property(name="element_index", data_type=DataType.INT, description="Index of element on page"),
                    Property(name="doc_hash", data_type=DataType.TEXT, description="Hash of the original document"),
                ],
                vectorizer_config=vectorizer_config,
                multi_tenancy_config=Configure.multi_tenancy(enabled=True)
            )
            print(f"Collection '{collection_name}' created successfully with Weaviate Embeddings vectorizer and Multi-Tenancy enabled.")
            time.sleep(2) # Allow time for creation to settle
            return collection # Return the newly created collection object
        except Exception as e:
            print(f"!!!!!!!! FATAL ERROR: Failed to create collection '{collection_name}' !!!!!!!!")
            print(f"  Exception: {e}")
            traceback.print_exc()
            raise e
        # -------------------------------------------------------------------

def add_chunks_to_weaviate(client: weaviate.Client, tenant_id: str, chunks: List[Document], text_key: str = TEXT_KEY):
    """Adds document chunks to Weaviate one by one for a specific tenant with individual error checking."""
    
    print(f"Ingestor: Preparing to add {len(chunks)} chunks one-by-one to tenant '{tenant_id}'...")
    collection_name = COLLECTION_NAME
    
    if not client.collections.exists(collection_name):
        # This case should ideally be prevented by ensure_collection_exists
        print(f"Collection '{collection_name}' not found during chunk addition. Cannot proceed.")
        return False
    
    try:
        collection = client.collections.get(collection_name)
        
        tenants = collection.tenants.get()
        tenant_exists = any(t.name == tenant_id for t in tenants.values()) # Simplified check
        
        if not tenant_exists:
            print(f"Ingestor: Tenant '{tenant_id}' not found, creating it.")
            collection.tenants.create(Tenant(name=tenant_id))
            print(f"Created tenant '{tenant_id}'")
        else:
            print(f"Tenant '{tenant_id}' already exists")
        
        collection_tenant = collection.with_tenant(tenant_id)
        print(f"  Obtained handle for tenant '{tenant_id}'.")
    except Exception as e:
        print(f"!!!!!!!! ERROR setting up tenant '{tenant_id}': {e} !!!!!!!!")
        traceback.print_exc()
        return False
    
    successful_inserts = 0
    failed_inserts = 0
    source_identifier = chunks[0].metadata.get('source', 'Unknown') if chunks else 'Unknown'

    print(f"  Starting individual inserts for {len(chunks)} chunks...")
    with collection_tenant.batch.dynamic() as batch:
        for i, chunk in enumerate(chunks):
            if not hasattr(chunk, 'page_content') or not chunk.page_content:
                print(f"    Skipping chunk {i+1}/{len(chunks)}: Missing or empty page_content.")
                continue

            if chunk.metadata and 'coordinates' in chunk.metadata:
                del chunk.metadata['coordinates'] # Remove problematic key

            # --- Prepare properties, ensuring 'page' exists if 'page_number' does --- 
            prepared_metadata = chunk.metadata.copy() if chunk.metadata else {}
            if 'page_number' in prepared_metadata and 'page' not in prepared_metadata:
                print(f"    DEBUG: Mapping metadata['page_number'] ({prepared_metadata['page_number']}) to metadata['page']")
                prepared_metadata['page'] = prepared_metadata['page_number']
            # Ensure page is an int if it exists, handle potential errors
            if 'page' in prepared_metadata:
                try:
                    prepared_metadata['page'] = int(prepared_metadata['page'])
                except (ValueError, TypeError):
                    print(f"    WARNING: Could not convert metadata['page'] ('{prepared_metadata['page']}') to int. Setting to None.")
                    prepared_metadata['page'] = None # Or set to 0 or handle as error

            properties = {text_key: chunk.page_content, **prepared_metadata}
            # ---------------------------------------------------------------------
            
            try:
                # Generate UUID based on content and source to potentially help with deduplication if needed
                # Note: If content/metadata changes slightly, UUID will change.
                # Consider a more robust deduplication strategy if required.
                chunk_uuid = generate_uuid5(properties)
                
                batch.add_object(
                    properties=properties,
                    uuid=chunk_uuid
                )
                successful_inserts += 1
            except Exception as insert_e:
                print(f"  ERROR adding chunk {i+1} ({source_identifier}): {insert_e}")
                # Optionally log the failed chunk data (beware of large logs)
                # print(f"    Failed chunk properties: {properties}") 
                failed_inserts += 1

    # Check batch results (optional but recommended)
    if batch.number_errors > 0:
        print(f"!!!!!!!! WARNING: Batch insertion for tenant '{tenant_id}' finished with {batch.number_errors} errors !!!!!!!!")
        # You might want to iterate through batch.errors for details

    print(f"  Finished inserting chunks for tenant '{tenant_id}': {successful_inserts} succeeded, {failed_inserts} failed.")
    return failed_inserts == 0

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

# --- UPDATED Main Processing Function --- 
def process_files_for_session(session_id: str, client: weaviate.Client = None) -> Dict[str, Any]:
    """Processes uploaded files for a given session_id, checking for existing hashes within the session's tenant before ingestion."""
    if Config.USE_LOCAL_VECTOR_STORE:
        print(f"Processing request for session '{session_id}' in LOCAL mode - skipping Weaviate ingestion.")
        # Still might need local hash checking if you maintain separate FAISS indexes per session
        return {"message": "Local mode - processing skipped.", "processed_files": [], "skipped_count": 0, "failed_files": []}

    if not client:
        print("ERROR: Weaviate client is required for processing in remote mode.")
        # Return a dictionary that matches the expected ProcessResponse structure implicitly
        return {"message": "Processing failed: Weaviate client not available.", "processed_files": [], "skipped_count": 0, "failed_files": []}

    start_time = time.time()
    print(f"Starting processing run for session '{session_id}'")
    session_upload_dir = Config.Path.DOCUMENTS_DIR / session_id
    processed_count = 0
    processed_filenames = []
    skipped_count = 0
    failed_files = []

    # 1. Ensure Collection Exists
    try:
        collection = ensure_collection_exists(client)
        print(f"Collection '{collection.name}' is ready.")
    except ValueError as e: # Catch specific config verification error
        error_msg = f"Stopping processing for session {session_id} due to collection setup error: {e}"
        print(error_msg)
        return {"message": error_msg, "processed_files": [], "skipped_count": 0, "failed_files": []}
    except Exception as e:
        error_msg = f"Unexpected error during collection check for session {session_id}: {e}"
        print(f"!!!!!!!! {error_msg} !!!!!!!!")
        traceback.print_exc()
        return {"message": error_msg, "processed_files": [], "skipped_count": 0, "failed_files": []}

    # --- ADDED: Ensure Tenant Exists BEFORE Querying --- 
    try:
        if not collection.tenants.exists(session_id):
            print(f"Tenant '{session_id}' does not exist in collection '{collection.name}'. Creating tenant...")
            collection.tenants.create(Tenant(name=session_id))
            print(f"Tenant '{session_id}' created successfully.")
        else:
            print(f"Tenant '{session_id}' already exists.")
    except Exception as e:
        error_msg = f"Error checking or creating tenant '{session_id}': {e}"
        print(f"!!!!!!!! {error_msg} !!!!!!!!")
        traceback.print_exc()
        return {"message": error_msg, "processed_files": [], "skipped_count": 0, "failed_files": []}
    # ---------------------------------------------------

    # 2. Get Tenant-Specific Handle 
    try:
        collection_tenant = collection.with_tenant(session_id)
        print(f"Obtained handle for tenant '{session_id}'.") # Added log
    except Exception as e:
        # This error is less likely now that we create the tenant above, but keep for safety
        error_msg = f"Error getting tenant handle '{session_id}' even after check/create: {e}"
        print(f"!!!!!!!! {error_msg} !!!!!!!!")
        traceback.print_exc()
        return {"message": error_msg, "processed_files": [], "skipped_count": 0, "failed_files": []}
        
    # 3. Process Files in Session Directory
    print(f"Looking for files in session directory: {session_upload_dir}")
    if not session_upload_dir.is_dir():
        print(f"  Session directory not found: {session_upload_dir}")
        return {"message": "No files found to process for this session.", "processed_files": [], "skipped_count": 0, "failed_files": []}

    files_to_process = list(session_upload_dir.iterdir())
    if not files_to_process:
        print("  No files found in the session directory.")
        return {"message": "No files found in the session directory to process.", "processed_files": [], "skipped_count": 0, "failed_files": []}

    print(f"Found {len(files_to_process)} file(s) to potentially process.")

    for file_path in files_to_process:
        if not file_path.is_file():
            continue
        filename = file_path.name
        try:
            print(f"Processing: {filename}...")
            file_hash = get_file_hash(str(file_path))

            # --- Check if hash exists IN THIS TENANT --- 
            print(f"  Checking if hash {file_hash[:8]}... exists in tenant '{session_id}'")
            # This query should now work because the tenant exists
            response = collection_tenant.query.fetch_objects(
                filters=Filter.by_property("doc_hash").equal(file_hash),
                limit=1
            )
            if len(response.objects) > 0:
                print(f"  Skipping (hash already exists in tenant '{session_id}'): {filename}")
                skipped_count += 1
                continue
            else:
                 print(f"  Hash not found in tenant '{session_id}'. Proceeding with ingestion.")
            # -------------------------------------------

            chunks = load_and_chunk_docs(str(file_path))
            if not chunks:
                print(f"  No content extracted from {filename}. Skipping.")
                failed_files.append(filename)
                continue

            # Add hash to metadata before ingestion
            for chunk in chunks:
                chunk.metadata['doc_hash'] = file_hash
                if 'source' not in chunk.metadata:
                    chunk.metadata['source'] = filename 
            
            # Ingest into the specific tenant (add_chunks handles tenant check/create but check is redundant now)
            print(f"  Adding {len(chunks)} chunks to Weaviate tenant '{session_id}'...")
            ingestion_success = add_chunks_to_weaviate(client, session_id, chunks)
            
            if ingestion_success:
                print(f"  Successfully processed and ingested: {filename}")
                processed_count += 1
                processed_filenames.append(filename)
            else:
                print(f"  Failed to ingest chunks for: {filename}")
                failed_files.append(filename)

        except Exception as e:
            print(f"!!!!!!!! ERROR processing file {filename}: {e} !!!!!!!!")
            traceback.print_exc()
            failed_files.append(filename)

    end_time = time.time()
    result = {
        "message": f"Processing finished for session {session_id} in {end_time - start_time:.2f} seconds.",
        "processed_files": processed_filenames, # Changed key to match ProcessResponse
        "skipped_count": skipped_count,
        "failed_files": failed_files
    }
    print(f"Processing result: {result}")
    return result

# Note: You would typically call process_files_for_session from your API endpoint
#       after potentially getting the Weaviate client instance.