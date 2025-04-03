from pathlib import Path
from typing import List, Set, Dict
import mimetypes
import traceback
import shutil
import uuid
import os

from langchain_community.document_loaders import UnstructuredFileLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from ragbase.config import Config

# Add Weaviate imports
import weaviate
# Keep Auth import
from weaviate.classes.init import Auth 

# FAISS / Local imports
from langchain_community.vectorstores import FAISS
from langchain_core.embeddings import Embeddings 

# Bring back local embedder creation
from ragbase.model import create_embeddings 

# Add json and hashlib for hashing
import json
import hashlib

# --- Helper Functions for Hashing --- 

def get_file_hash(file_path: Path) -> str:
    """Calculates the SHA256 hash of a file."""
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as file:
        while chunk := file.read(8192): # Read in chunks
            hasher.update(chunk)
    return hasher.hexdigest()

def load_processed_hashes(hash_file_path: Path) -> Set[str]:
    """Loads the set of processed file hashes from the JSON file."""
    if not hash_file_path.exists():
        return set()
    try:
        with open(hash_file_path, 'r') as f:
            data = json.load(f)
        # Check the type of loaded data
        if isinstance(data, dict):
            # Expected format: {"processed_hashes": [...]}
            return set(data.get("processed_hashes", [])) 
        elif isinstance(data, list):
            # Handle old format: [...]
            print(f"Warning: Hash file {hash_file_path} contains old list format. Converting.")
            return set(data)
        else:
             # Unexpected format
            print(f"Warning: Hash file {hash_file_path} has unexpected format type {type(data)}. Starting fresh.")
            return set()
    except (json.JSONDecodeError, IOError) as e:
        print(f"Warning: Could not load or parse hash file {hash_file_path}: {e}. Starting fresh.")
        return set()

def save_processed_hashes(hash_file_path: Path, hashes: Set[str]):
    """Saves the set of processed file hashes to the JSON file."""
    try:
        hash_file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(hash_file_path, 'w') as f:
            # Store as a list in JSON for compatibility
            json.dump({"processed_hashes": sorted(list(hashes))}, f, indent=4)
    except IOError as e:
        print(f"ERROR: Could not save hash file {hash_file_path}: {e}")

class Ingestor:
    def __init__(self, client: weaviate.Client | None = None): # Client is now optional
        """Initializes based on Config.USE_LOCAL_VECTOR_STORE."""
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100,
            length_function=len,
            is_separator_regex=False,
        )
        self.use_local = Config.USE_LOCAL_VECTOR_STORE
        self.client = client # Store Weaviate client if provided
        self.embedder: Embeddings | None = None
        self.faiss_index_path = str(Config.Path.FAISS_INDEX_DIR / "docs_index")
        self.hash_file_path = Config.Path.PROCESSED_HASHES_FILE
        self.processed_hashes: Set[str] = set() # Initialize hash set
        
        if self.use_local:
            print("Ingestor: Initializing for LOCAL vector store (FAISS/Ollama) with HASHING.")
            self.embedder = create_embeddings()
            Config.Path.FAISS_INDEX_DIR.mkdir(parents=True, exist_ok=True)
            # Load existing hashes only in local mode
            self.processed_hashes = load_processed_hashes(self.hash_file_path)
            print(f"  Loaded {len(self.processed_hashes)} previously processed hashes.")
        else:
            print("Ingestor: Initializing for REMOTE vector store (Weaviate).")
            if not self.client:
                # This shouldn't happen if api.py logic is correct, but good practice
                raise ValueError("Weaviate client must be provided when USE_LOCAL_VECTOR_STORE is False.")

    def _load_and_split(self, doc_paths: List[Path]) -> List[Document]:
        docs_to_add = []
        newly_processed_hashes = set() # Track hashes processed in *this* run
        
        # Filter out already processed files if in local mode
        files_to_process = []
        if self.use_local:
            print(f"Ingestor: Checking {len(doc_paths)} file(s) against {len(self.processed_hashes)} known hashes...")
            for doc_path in doc_paths:
                try:
                    file_hash = get_file_hash(doc_path)
                    if file_hash not in self.processed_hashes:
                        files_to_process.append((doc_path, file_hash))
                    else:
                        print(f"  Skipping (already processed): {doc_path.name} (Hash: {file_hash[:8]}...)")
                except Exception as e:
                     print(f"ERROR calculating hash for {doc_path.name}: {e}. Skipping file.")
            print(f"Ingestor: Found {len(files_to_process)} new file(s) to process.")
        else:
            # In Weaviate mode, process all provided files (no hash check)
            files_to_process = [(p, None) for p in doc_paths] # Keep tuple structure, hash is None

        print(f"Ingestor: Processing {len(files_to_process)} file(s)...")
        for doc_path, file_hash in files_to_process:
            print(f"  Loading: {doc_path.name}")
            try:
                loader = UnstructuredFileLoader(str(doc_path))
                raw_docs = loader.load()
                
                # Add file hash and element index to metadata before splitting
                for i, doc in enumerate(raw_docs):
                    doc.metadata["source"] = doc_path.name # Use name instead of full path if preferred
                    doc.metadata["doc_type"] = "text" # Default or determine from loader
                    doc.metadata["element_index"] = i 
                    if self.use_local and file_hash:
                        doc.metadata["file_hash"] = file_hash
                
                split_docs = self.text_splitter.split_documents(raw_docs)
                docs_to_add.extend(split_docs)
                print(f"    -> Split into {len(split_docs)} chunks.")
                
                # Add hash to the set for *this* run if processed successfully
                if self.use_local and file_hash:
                    newly_processed_hashes.add(file_hash)
            except Exception as e:
                print(f"ERROR loading/splitting file {doc_path.name}: {e}")
                # Optionally skip file or raise error

        print(f"Ingestor: Total chunks prepared: {len(docs_to_add)}")
        # Return prepared docs AND the hashes of files successfully processed in this run
        return docs_to_add, newly_processed_hashes 

    def ingest(self, doc_paths: List[Path]) -> bool:
        """Processes and adds documents, skipping processed files in local mode."""
        # Unpack results from _load_and_split
        docs_to_add, newly_processed_hashes = self._load_and_split(doc_paths)
        
        if not docs_to_add and not newly_processed_hashes:
             # Handle case where all files were already processed or no files provided
             if self.use_local and any(get_file_hash(p) in self.processed_hashes for p in doc_paths):
                 print("Ingestor: No *new* documents to process (all previously processed).")
                 return True # Indicate success as nothing needed doing
             else:
                 print("Ingestor: No valid documents generated to add.")
                 return True

        success = False
        if self.use_local:
            # --- FAISS Ingestion --- 
            print(f"Ingestor (FAISS): Adding {len(docs_to_add)} chunks...")
            if not self.embedder:
                print("ERROR: Embedder not initialized for local ingestion.")
                return False
            try:
                if os.path.exists(self.faiss_index_path):
                    print(f"  Loading existing FAISS index from: {self.faiss_index_path}")
                    vector_store = FAISS.load_local(self.faiss_index_path, self.embedder, allow_dangerous_deserialization=True)
                    print(f"  Adding new documents to existing FAISS index.")
                    vector_store.add_documents(docs_to_add)
                else:
                    print(f"  Creating new FAISS index at: {self.faiss_index_path}")
                    vector_store = FAISS.from_documents(docs_to_add, self.embedder)
                
                print(f"  Saving FAISS index to: {self.faiss_index_path}")
                vector_store.save_local(self.faiss_index_path)
                print(f"Ingestor (FAISS): Successfully added {len(docs_to_add)} chunks.")
                
                # Update the main hash set and save ONLY if FAISS ops were successful
                print("Updating and saving processed hashes...")
                self.processed_hashes.update(newly_processed_hashes)
                save_processed_hashes(self.hash_file_path, self.processed_hashes)
                success = True
            except Exception as e:
                print(f"ERROR during FAISS ingestion/saving: {e}")
                traceback.print_exc()
                return False
        else:
            # --- Weaviate Ingestion --- 
            print(f"Ingestor (Weaviate): Adding {len(docs_to_add)} chunks...")
            if not self.client:
                 print("ERROR: Weaviate client not available for remote ingestion.")
                 return False
            try:
                collection = self.client.collections.get(Config.Database.WEAVIATE_INDEX_NAME)
                with collection.batch.dynamic() as batch:
                    for doc in docs_to_add:
                        properties = {
                            Config.Database.WEAVIATE_TEXT_KEY: doc.page_content, 
                            "source": doc.metadata.get("source", "unknown"),
                            "page": doc.metadata.get("page", 0),
                            "doc_type": doc.metadata.get("doc_type", "text"),
                            "element_index": doc.metadata.get("element_index", -1)
                        }
                        batch.add_object(properties=properties)
                
                failed_objects = collection.batch.failed_objects 
                if failed_objects:
                    print(f"ERROR: Ingestor (Weaviate) encountered {len(failed_objects)} errors.")
                    return False
                else:
                    print(f"Ingestor (Weaviate): Successfully added {len(docs_to_add)} chunks.")
                    success = True
            except Exception as e:
                 print(f"ERROR: Ingestor (Weaviate) failed during batch import: {e}")
                 traceback.print_exc()
                 return False

        return success
