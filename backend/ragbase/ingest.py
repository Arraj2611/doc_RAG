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
)

# Import Config
from .config import Config

# Import Tenant class
from weaviate.collections.classes.tenants import Tenant
from weaviate.classes.query import Filter # Ensure Filter is imported

# Add AWS Boto3 specific imports if needed, e.g.:
import boto3
from botocore.exceptions import ClientError
import tempfile # For temporary file handling if downloading from S3
# import io

# --- Configuration --- 
COLLECTION_NAME = "RaggerIndex" # Define collection name globally
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150
TEXT_KEY = "text" # Consistent key for text property

def get_file_hash(file_content: bytes = None, file_path: str = None) -> str:
    """Calculates SHA256 hash. Can take bytes directly or a file path."""
    hasher = hashlib.sha256()
    if file_content:
        hasher.update(file_content)
    elif file_path:
        with open(file_path, 'rb') as file:
            while chunk := file.read(8192):
                hasher.update(chunk)
    else:
        raise ValueError("Either file_content or file_path must be provided to get_file_hash")
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
                chunk_uuid = generate_uuid5(properties)
                
                batch.add_object(
                    properties=properties,
                    uuid=chunk_uuid
                )
                successful_inserts += 1
            except Exception as insert_e:
                print(f"  ERROR adding chunk {i+1} ({source_identifier}): {insert_e}")
                failed_inserts += 1

    # Check batch results (optional but recommended)
    if batch.number_errors > 0:
        print(f"!!!!!!!! WARNING: Batch insertion for tenant '{tenant_id}' finished with {batch.number_errors} errors !!!!!!!!")

    print(f"  Finished inserting chunks for tenant '{tenant_id}': {successful_inserts} succeeded, {failed_inserts} failed.")
    return failed_inserts == 0

def load_and_chunk_docs(file_path: str = None, file_content: bytes = None, filename_for_loader: str = "unknown_file", chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP) -> List[Document]:
    """Loads a document (from path or content) and splits it into chunks."""
    temp_file_path_for_loader = None # Initialize to ensure it's in scope for finally
    try:
        if file_content:
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(filename_for_loader).suffix or ".tmp") as tmp_file:
                tmp_file.write(file_content)
                temp_file_path_for_loader = tmp_file.name
            print(f"Ingestor: Loading document from temporary file (from content): {temp_file_path_for_loader} (original: {filename_for_loader})")
            loader_path = temp_file_path_for_loader
        elif file_path:
            print(f"Ingestor: Loading document from path: {file_path}")
            loader_path = file_path
        else:
            raise ValueError("Either file_path or file_content must be provided to load_and_chunk_docs")

        loader = UnstructuredFileLoader(
             loader_path,
             mode="elements", 
             strategy="fast"
        )
        docs = loader.load()
        print(f"Ingestor: Loaded {len(docs)} elements initially from {filename_for_loader}.")

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size, 
            chunk_overlap=chunk_overlap
        )
        chunks = text_splitter.split_documents(docs)
        print(f"Ingestor: Split {filename_for_loader} into {len(chunks)} chunks.")
        return chunks
    except Exception as e:
        original_source = filename_for_loader if file_content else file_path
        print(f"Error loading/chunking document {original_source}: {e}")
        traceback.print_exc() # Added for more detail on chunking errors
        return []
    finally:
        if temp_file_path_for_loader and os.path.exists(temp_file_path_for_loader):
            try:
                os.remove(temp_file_path_for_loader)
            except Exception as e:
                print(f"Warning: Could not delete temporary file {temp_file_path_for_loader}: {e}")

# --- UPDATED Main Processing Function --- 
def process_files_for_session(session_id: str, client: weaviate.Client = None) -> Dict[str, Any]:
    """Processes uploaded files for a given session_id from AWS S3,
    checking for existing hashes within the session's tenant before ingestion."""
    if Config.USE_LOCAL_VECTOR_STORE:
        print(f"Processing request for session '{session_id}' in LOCAL mode - skipping Weaviate ingestion.")
        # Still might need local hash checking if you maintain separate FAISS indexes per session
        return {"message": "Local mode - processing skipped.", "processed_files": [], "skipped_count": 0, "failed_files": []}

    if not client:
        print("ERROR: Weaviate client is required for processing in remote mode.")
        # Return a dictionary that matches the expected ProcessResponse structure implicitly
        return {"message": "Processing failed: Weaviate client not available.", "processed_files": [], "skipped_count": 0, "failed_files": []}

    start_time = time.time()
    print(f"Starting processing run for session '{session_id}' from AWS S3")
    s3_object_prefix = f"tenants/{session_id}/"

    # --- AWS S3 Client Initialization ---
    s3_client_boto = None 
    try:
        s3_client_boto = boto3.client('s3', region_name=Config.AWS.S3_REGION)
    except Exception as e:
        error_msg = f"INGEST: ERROR initializing AWS S3 client: {e}"
        print(error_msg)
        return {"message": error_msg, "processed_files": [], "skipped_count": 0, "failed_files": []}
    # No need for explicit check of s3_client_boto here as an exception would have returned.
    # -----------------------------------------------------

    processed_count = 0
    processed_filenames = []
    skipped_count = 0
    failed_files = []

    try:
        collection = ensure_collection_exists(client) 
        print(f"Weaviate Collection '{collection.name}' is ready.")
    except Exception as e: 
        error_msg = f"Stopping processing for session {session_id} due to Weaviate collection setup error: {e}"
        print(error_msg)
        return {"message": error_msg, "processed_files": [], "skipped_count": 0, "failed_files": []}

    try:
        if not collection.tenants.exists(session_id):
            collection.tenants.create(Tenant(name=session_id))
            print(f"Weaviate Tenant '{session_id}' created successfully.")
        else:
            print(f"Weaviate Tenant '{session_id}' already exists.")
    except Exception as e:
        error_msg = f"Error checking or creating Weaviate tenant '{session_id}': {e}"
        print(f"!!!!!!!! {error_msg} !!!!!!!!")
        traceback.print_exc()
        return {"message": error_msg, "processed_files": [], "skipped_count": 0, "failed_files": []}

    try:
        collection_tenant = collection.with_tenant(session_id)
        print(f"Obtained Weaviate handle for tenant '{session_id}'.")
    except Exception as e:
        error_msg = f"Error getting Weaviate tenant handle '{session_id}': {e}"
        print(f"!!!!!!!! {error_msg} !!!!!!!!")
        traceback.print_exc()
        return {"message": error_msg, "processed_files": [], "skipped_count": 0, "failed_files": []}
        
    print(f"Looking for files in S3 bucket '{Config.AWS.S3_BUCKET_NAME}' with prefix '{s3_object_prefix}'")
    
    objects_to_process_s3 = []
    try:
        paginator = s3_client_boto.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=Config.AWS.S3_BUCKET_NAME, Prefix=s3_object_prefix):
            if 'Contents' in page:
                for obj in page['Contents']:
                    # Skip "directory placeholder" objects (ending with '/' and size 0)
                    if not (obj['Key'].endswith('/') and obj.get('Size', 0) == 0):
                        objects_to_process_s3.append(obj) 
    except ClientError as e:
        error_msg = f"INGEST: S3 ClientError listing objects for prefix {s3_object_prefix}: {e}"
        print(error_msg)
        return {"message": error_msg, "processed_files": [], "skipped_count": 0, "failed_files": []}
    except Exception as e:
        error_msg = f"INGEST: Unexpected error listing objects from S3: {e}"
        print(error_msg)
        traceback.print_exc()
        return {"message": error_msg, "processed_files": [], "skipped_count": 0, "failed_files": []}

    if not objects_to_process_s3:
        print(f"  No files found in S3 for prefix: {s3_object_prefix}")
        return {"message": "No files found to process for this session.", "processed_files": [], "skipped_count": 0, "failed_files": []}

    print(f"Found {len(objects_to_process_s3)} object(s) in S3 to potentially process.")

    for s3_object_summary in objects_to_process_s3: 
        s3_key = s3_object_summary['Key']
        filename = Path(s3_key).name
        if not filename: # Should not happen if endsWith('/') check worked
            print(f"  Skipping S3 object with no filename (key: {s3_key})")
            continue
            
        print(f"Processing S3 object: {s3_key} (filename: {filename})...")

        try:
            file_content_bytes = None
            try:
                s3_response_object = s3_client_boto.get_object(Bucket=Config.AWS.S3_BUCKET_NAME, Key=s3_key)
                file_content_bytes = s3_response_object['Body'].read() 
                print(f"  Successfully fetched {len(file_content_bytes)} bytes from S3 for {filename}")
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code")
                if error_code == 'NoSuchKey':
                    print(f"  ERROR: S3 object {s3_key} not found (NoSuchKey). Maybe deleted after list? Skipping.")
                else:
                    print(f"  ERROR (ClientError) fetching S3 object {s3_key}: {e}. Skipping.")
                failed_files.append(filename)
                continue 
            except Exception as e:
                print(f"  Unexpected ERROR fetching S3 object {s3_key}: {e}. Skipping.")
                traceback.print_exc()
                failed_files.append(filename)
                continue 
            
            if not file_content_bytes:
                # This case should ideally be caught by previous error handling
                print(f"  No content fetched from S3 for {filename}. Skipping.")
                failed_files.append(filename)
                continue

            file_hash = get_file_hash(file_content=file_content_bytes)

            print(f"  Checking if hash {file_hash[:8]}... exists in Weaviate tenant '{session_id}'")
            response = collection_tenant.query.fetch_objects(
                filters=Filter.by_property("doc_hash").equal(file_hash),
                limit=1
            )
            if len(response.objects) > 0:
                print(f"  Skipping (hash already exists in Weaviate tenant '{session_id}'): {filename}")
                skipped_count += 1
                continue
            else:
                 print(f"  Hash not found in Weaviate tenant '{session_id}'. Proceeding with ingestion.")

            chunks = load_and_chunk_docs(file_content=file_content_bytes, filename_for_loader=filename)

            if not chunks:
                print(f"  No usable content extracted by Unstructured from {filename}. Skipping.")
                failed_files.append(filename)
                continue

            for chunk in chunks:
                chunk.metadata['doc_hash'] = file_hash
                if 'source' not in chunk.metadata:
                    chunk.metadata['source'] = filename 
            
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
            print(f"!!!!!!!! ERROR processing file {filename} (after S3 fetch and during Weaviate/chunking): {e} !!!!!!!!")
            traceback.print_exc()
            failed_files.append(filename)

    end_time = time.time()
    result = {
        "message": f"Processing finished for session {session_id} in {end_time - start_time:.2f} seconds.",
        "processed_files": processed_filenames,
        "skipped_count": skipped_count,
        "failed_files": failed_files
    }
    print(f"Processing result: {result}")
    return result