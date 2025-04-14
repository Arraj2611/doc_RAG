"""
Handles loading, splitting, hashing, and ingesting documents into 
either a local FAISS store or a remote Weaviate store based on configuration.
"""
from pathlib import Path
from typing import List, Set, Dict, Tuple
import traceback
import json
import hashlib
import logging
import os

# Langchain/Unstructured imports
from langchain_community.document_loaders import UnstructuredFileLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.embeddings import Embeddings

# Vector store imports
import weaviate
from langchain_community.vectorstores import FAISS

# Local imports
from .config import Config
from .model import create_embeddings # For local FAISS embeddings

# Configure logger
logger = logging.getLogger(__name__)

# --- Helper Functions ---

def get_file_hash(file_path: Path) -> str:
    """Calculates the SHA256 hash of a file."""
    hasher = hashlib.sha256()
    try:
        with open(file_path, 'rb') as file:
            while chunk := file.read(8192): # Read in chunks
                hasher.update(chunk)
        return hasher.hexdigest()
    except IOError as e:
        logger.error(f"Error calculating hash for {file_path.name}: {e}. Returning empty hash.")
        return ""

def load_processed_hashes(hash_file_path: Path) -> Set[str]:
    """Loads the set of processed file hashes from the JSON file (for local mode)."""
    if not hash_file_path.exists():
        return set()
    try:
        with open(hash_file_path, 'r') as f:
            data = json.load(f)
        # Expects format: {"processed_hashes": ["hash1", "hash2", ...]}
        if isinstance(data, dict) and isinstance(data.get("processed_hashes"), list):
            return set(data["processed_hashes"])
        else:
            logger.warning(f"Hash file {hash_file_path} has unexpected format. Starting fresh.")
            return set()
    except (json.JSONDecodeError, IOError) as e:
        logger.warning(f"Could not load/parse hash file {hash_file_path}: {e}. Starting fresh.")
        return set()

def save_processed_hashes(hash_file_path: Path, hashes: Set[str]):
    """Saves the set of processed file hashes to the JSON file (for local mode)."""
    try:
        hash_file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(hash_file_path, 'w') as f:
            json.dump({"processed_hashes": sorted(list(hashes))}, f, indent=4)
    except IOError as e:
        logger.error(f"Could not save hash file {hash_file_path}: {e}")

# --- Ingestor Class ---

class Ingestor:
    """
    Handles document ingestion pipeline: loading, splitting, hashing (local only), 
    and vector store indexing (FAISS or Weaviate).
    """
    def __init__(self, weaviate_client: weaviate.Client | None = None):
        """
        Initializes the Ingestor based on Config settings.

        Args:
            weaviate_client: An initialized Weaviate client (required for remote mode).
        """
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=Config.Processing.CHUNK_SIZE,
            chunk_overlap=Config.Processing.CHUNK_OVERLAP,
            length_function=len,
            is_separator_regex=False,
        )
        self.use_local = Config.USE_LOCAL_VECTOR_STORE
        self.weaviate_client = weaviate_client
        self.embedder: Embeddings | None = None
        self.faiss_index_path = str(Config.Path.FAISS_INDEX_DIR / "docs_index")
        self.hash_file_path = Config.Path.PROCESSED_HASHES_FILE
        self.processed_hashes: Set[str] = set() # Only used in local mode

        if self.use_local:
            logger.info("Ingestor: Initializing for LOCAL vector store (FAISS).")
            self.embedder = create_embeddings()
            Config.Path.FAISS_INDEX_DIR.mkdir(parents=True, exist_ok=True)
            self.processed_hashes = load_processed_hashes(self.hash_file_path)
            logger.info(f"  Loaded {len(self.processed_hashes)} previously processed file hashes.")
            if not self.embedder:
                 raise ValueError("Embedder could not be created for local mode.")
        else:
            logger.info("Ingestor: Initializing for REMOTE vector store (Weaviate).")
            if not self.weaviate_client:
                raise ValueError("Weaviate client must be provided for remote mode.")
            # Schema is assumed to be created/verified by the client setup process (e.g., api.py lifespan)

    def _load_and_split(self, doc_paths: List[Path]) -> Tuple[List[Document], Set[str]]:
        """
        Loads documents, splits them, adds metadata, and handles hash checking for local mode.

        Args:
            doc_paths: List of file paths to process.

        Returns:
            A tuple containing:
                - List of processed Langchain Document chunks.
                - Set of file hashes successfully processed in *this run* (for local mode).
        """
        docs_to_add: List[Document] = []
        newly_processed_hashes: Set[str] = set() # Track hashes processed in this run (local mode)

        files_to_process: List[Tuple[Path, str | None]] = [] # List of (Path, hash or None)

        # --- Filter based on hashes ONLY if in local mode ---
        if self.use_local:
            logger.info(f"Checking {len(doc_paths)} file(s) against {len(self.processed_hashes)} known hashes...")
            for doc_path in doc_paths:
                file_hash = get_file_hash(doc_path)
                if not file_hash:
                    logger.warning(f"Skipping file due to hash error: {doc_path.name}")
                    continue # Skip if hash calculation failed
                if file_hash not in self.processed_hashes:
                    files_to_process.append((doc_path, file_hash))
                else:
                    logger.info(f"Skipping (already processed): {doc_path.name} (Hash: {file_hash[:8]}...)")
            logger.info(f"Found {len(files_to_process)} new file(s) to process.")
        else:
            # In Weaviate mode, process all provided files regardless of hash
            files_to_process = [(p, None) for p in doc_paths]

        # --- Load and Split ---
        logger.info(f"Processing {len(files_to_process)} file(s)...")
        for doc_path, file_hash in files_to_process:
            logger.info(f"  Loading: {doc_path.name}")
            try:
                # Using UnstructuredFileLoader with fast strategy
                loader = UnstructuredFileLoader(
                    str(doc_path), 
                    mode="elements", 
                    strategy="fast" 
                )
                raw_docs = loader.load()
                logger.debug(f"    Loaded {len(raw_docs)} elements initially from {doc_path.name}.")

                # Add metadata *before* splitting if possible (Unstructured adds some)
                # Ensure source, doc_type, element_index are present
                for i, doc in enumerate(raw_docs):
                    doc.metadata["source"] = doc.metadata.get("filename", doc_path.name) # Use unstructured's filename if present
                    doc.metadata["doc_type"] = doc.metadata.get("category", "text") # Use unstructured's category
                    doc.metadata["page"] = doc.metadata.get("page_number", None) # Get page number if available
                    doc.metadata["element_index"] = i
                    if self.use_local and file_hash:
                        doc.metadata["doc_hash"] = file_hash # Store hash for local mode if needed later

                split_docs = self.text_splitter.split_documents(raw_docs)
                docs_to_add.extend(split_docs)
                logger.info(f"    -> Split into {len(split_docs)} chunks.")

                # If successful, record hash for this run (local mode)
                if self.use_local and file_hash:
                    newly_processed_hashes.add(file_hash)

            except Exception as e:
                logger.error(f"ERROR loading/splitting file {doc_path.name}: {e}")
                logger.error(traceback.format_exc())
                # Optionally decide whether to skip the file or raise the error

        logger.info(f"Total chunks prepared for ingestion: {len(docs_to_add)}")
        return docs_to_add, newly_processed_hashes

    def ingest(self, doc_paths: List[Path], tenant_id: str | None = None) -> bool:
        """
        Processes and ingests documents into the configured vector store.
        For remote (Weaviate) mode, a tenant_id is required.
        For local (FAISS) mode, tenant_id is ignored, and hashes are checked.

        Args:
            doc_paths: A list of Path objects for the documents to ingest.
            tenant_id: The Weaviate tenant ID to ingest into (required for remote mode).

        Returns:
            True if ingestion process completed (potentially with partial success), 
            False if a critical error occurred.
        """
        if not self.use_local and not tenant_id:
            logger.error("Tenant ID is required for Weaviate ingestion.")
            return False
            
        if self.use_local and tenant_id:
            logger.warning(f"Tenant ID '{tenant_id}' provided but running in local (FAISS) mode. Tenant ID will be ignored.")

        # --- Load, Split, and Check Hashes (local only) ---
        docs_to_add, newly_processed_hashes = self._load_and_split(doc_paths)

        if not docs_to_add:
            if self.use_local and newly_processed_hashes:
                 logger.warning("No document chunks generated, but hashes were processed? This shouldn't happen.")
                 return False # Indicate potential issue
            elif self.use_local:
                 logger.info("No *new* documents to process (all previously processed or failed loading).")
                 return True # Success, nothing to do
            else:
                 logger.warning("No document chunks generated to ingest.")
                 # For Weaviate, this might mean loading failed for all docs
                 # Return True as the ingest *function* completed, but log the warning.
                 return True 

        # --- Indexing ---
        success = False
        if self.use_local:
            # --- FAISS Ingestion ---
            logger.info(f"Ingesting {len(docs_to_add)} chunks into FAISS index: {self.faiss_index_path}")
            if not self.embedder: # Should have been checked in init
                logger.error("Embedder not initialized for local ingestion.")
                return False
            try:
                if os.path.exists(self.faiss_index_path):
                    logger.info(f"Loading existing FAISS index...")
                    vector_store = FAISS.load_local(self.faiss_index_path, self.embedder, allow_dangerous_deserialization=True)
                    logger.info(f"Adding new documents to existing index.")
                    vector_store.add_documents(docs_to_add)
                else:
                    logger.info(f"Creating new FAISS index...")
                    vector_store = FAISS.from_documents(docs_to_add, self.embedder)

                logger.info(f"Saving FAISS index...")
                vector_store.save_local(self.faiss_index_path)
                logger.info(f"Successfully added {len(docs_to_add)} chunks to FAISS.")

                # Update and save the global hash list only if FAISS ops were successful
                logger.info("Updating and saving processed file hashes...")
                self.processed_hashes.update(newly_processed_hashes)
                save_processed_hashes(self.hash_file_path, self.processed_hashes)
                success = True
            except Exception as e:
                logger.error(f"ERROR during FAISS ingestion/saving: {e}")
                logger.error(traceback.format_exc())
                # Do not save hashes if saving the index failed
                success = False

        else:
            # --- Weaviate Ingestion ---
            logger.info(f"Ingesting {len(docs_to_add)} chunks into Weaviate tenant: '{tenant_id}'")
            if not self.weaviate_client: # Should have been checked in init
                 logger.error("Weaviate client not available for remote ingestion.")
                 return False
            try:
                collection = self.weaviate_client.collections.get(Config.Database.WEAVIATE_INDEX_NAME)
                collection_tenant = collection.with_tenant(tenant_id) # Get tenant-specific access
                
                # Use batch import
                with collection_tenant.batch.dynamic() as batch:
                    for i, doc in enumerate(docs_to_add):
                        properties = {
                            Config.Database.WEAVIATE_TEXT_KEY: doc.page_content,
                            # Ensure metadata matches schema defined in weaviate_client.py
                            "source": doc.metadata.get("source", "unknown"),
                            "page": doc.metadata.get("page", None), # Use None if not available
                            "doc_type": doc.metadata.get("doc_type", "text"),
                            "element_index": doc.metadata.get("element_index", -1),
                            "doc_hash": doc.metadata.get("doc_hash", None), # Can be None if not local
                        }
                        # Remove keys with None values as Weaviate might error
                        properties = {k: v for k, v in properties.items() if v is not None}

                        batch.add_object(properties=properties)
                        # Weaviate v4 batch handles retries/errors internally to some extent
                        # Check results after the context manager exits if needed

                # Check for batch errors after completion
                # Note: .failed_objects might not be populated if errors occurred earlier
                # It's safer to check the return value of batch operations if available or rely on exceptions
                # For simplicity here, we assume success if no exception is raised.
                # For robust error handling, examine batch results more closely.
                # e.g., results = batch.execute() and check results.has_errors

                logger.info(f"Weaviate batch ingestion complete for tenant '{tenant_id}'.")
                # Consider adding check for batch.failed_objects if needed for more detailed logging
                success = True

            except Exception as e:
                 logger.error(f"ERROR during Weaviate batch ingestion for tenant '{tenant_id}': {e}")
                 logger.error(traceback.format_exc())
                 success = False

        return success

    def add_document_chunks(self, chunks: List[Element], document_hash: str, source: str, tenant_id: str):
        collection_name = Config.Database.WEAVIATE_INDEX_NAME
        text_key = Config.Database.WEAVIATE_TEXT_KEY
        
        if not self.weaviate_client:
             print("ERROR Ingestor: Weaviate client is None during add_document_chunks.")
             raise ValueError("Weaviate client not initialized in Ingestor")
        
        try:
            # Get the main collection object
            collection = self.weaviate_client.collections.get(collection_name)
            # Get a tenant-specific interface
            collection_tenant = collection.with_tenant(tenant_id) 
            
            objects_to_add = []
            for i, chunk in enumerate(chunks):
                metadata = chunk.metadata.to_dict()
                metadata['doc_hash'] = document_hash
                metadata['source'] = source
                metadata['element_index'] = i 
                
                properties = {
                    text_key: chunk.text,
                    **metadata 
                }
                
                objects_to_add.append(DataObject(properties=properties))
            
            if objects_to_add:
                # Use the tenant-specific batch
                with collection_tenant.batch.fixed_size() as batch:
                    for obj in objects_to_add:
                        batch.add_object(properties=obj.properties)
                
                print(f"Ingestor: Successfully added {len(objects_to_add)} chunks for source '{source}' to tenant '{tenant_id}' in '{collection_name}'.")
                return len(objects_to_add)
            else:
                print(f"Ingestor: No chunks to add for source '{source}'.")
                return 0
        except Exception as e:
            print(f"ERROR Ingestor add_document_chunks: Failed to add chunks for {source} to tenant '{tenant_id}'. Error: {e}")
            traceback.print_exc()
            raise # Re-raise the exception
