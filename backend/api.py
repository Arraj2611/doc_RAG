from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Request, BackgroundTasks, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import shutil
from pathlib import Path
import traceback
import asyncio
from typing import List, Dict, Optional, Any, Annotated, AsyncGenerator, Set
from contextlib import asynccontextmanager
import weaviate
from weaviate.classes.init import Auth
from weaviate.classes.config import Property, DataType, Configure, Reconfigure
from weaviate.classes.query import Filter
from weaviate.collections.classes.tenants import Tenant
from langchain_core.runnables import Runnable, RunnableConfig
from langchain_core.documents import Document
import json
from fastapi.responses import StreamingResponse, JSONResponse, Response
from dotenv import load_dotenv

# --- Load .env file explicitly if needed ---
# Usually FastAPI/Uvicorn handle this, but being explicit can help
load_dotenv()
# -----------------------------------------

# --- Relative Imports (Simplified) --- 
# Use consistent relative imports within the backend package
from .ragbase.chain import create_chain, get_session_history 
from .ragbase import ingest # Import the ingest module itself
from .ragbase.config import Config 
from .ragbase.retriever import create_retriever
from .ragbase.model import create_llm
# Assuming Ingestor might still be needed from ingestor.py
# If ragbase/ingestor.py doesn't exist or Ingestor isn't used, remove this line
try:
    from .ragbase.ingestor import Ingestor 
except ImportError:
    print("Warning: Could not import Ingestor from .ragbase.ingestor. If not needed, remove the import line.")
    Ingestor = None # Define as None to avoid NameErrors if import fails

from .ragbase.ingest import COLLECTION_NAME # Import the constant from ingest.py
# -------------------------------------

# --- Remove Global Variables --- 
# REMOVE: chain_instance: Runnable | None = None

# --- Dependency to get Weaviate client --- 
def get_weaviate_client_dependency(request: Request):
    """Dependency function to get the client from app state."""
    client = getattr(request.app.state, 'weaviate_client', None)
    # If remote mode is expected but client is missing, raise an error
    if not Config.USE_LOCAL_VECTOR_STORE and client is None:
         print("ERROR: Weaviate client dependency failed - client not initialized in app state for remote mode.")
         raise HTTPException(status_code=503, detail="Weaviate client not available")
    return client

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP --- 
    print("--- Application Startup --- ")
    
    # 1. Clear tmp upload directory
    upload_dir = Config.Path.DOCUMENTS_DIR
    if upload_dir.exists() and upload_dir.is_dir():
        print(f"Clearing existing upload directory: {upload_dir}")
        try:
            shutil.rmtree(upload_dir)
            print("Upload directory cleared.")
        except Exception as e:
            print(f"Warning: Could not clear upload directory {upload_dir}: {e}")
    # Ensure the directory exists after attempting removal
    try:
        upload_dir.mkdir(parents=True, exist_ok=True)
        print(f"Ensured upload directory exists: {upload_dir}")
    except Exception as e:
         print(f"FATAL: Could not create upload directory {upload_dir}: {e}")
         # Decide if you want to exit or continue without upload functionality
         # exit(1)

    # 2. Delete obsolete processed_hashes.json
    hashes_file = Config.Path.PROCESSED_HASHES_FILE
    if hashes_file.exists():
        print(f"Deleting obsolete hashes file: {hashes_file}")
        try:
            hashes_file.unlink()
            print("Obsolete hashes file deleted.")
        except Exception as e:
            print(f"Warning: Could not delete obsolete hashes file {hashes_file}: {e}")

    # 3. Initialize Weaviate Client (if needed)
    app.state.weaviate_client = None 
    if not Config.USE_LOCAL_VECTOR_STORE:
        print("Initializing Weaviate client at application startup (Remote Mode)...")
        weaviate_url = Config.Database.WEAVIATE_URL
        weaviate_key = Config.Database.WEAVIATE_API_KEY
        
        if not weaviate_url or not weaviate_key:
            print("ERROR: WEAVIATE_URL and WEAVIATE_API_KEY must be set for Weaviate mode.")
        else:
            try:
                # Connect WITHOUT extra headers
                client_instance = weaviate.connect_to_wcs(
                    cluster_url=weaviate_url,
                    auth_credentials=Auth.api_key(weaviate_key)
                )
                print("Weaviate client connected and ready.")
                app.state.weaviate_client = client_instance
                
                # Startup Check (remains the same)
                collection_name = COLLECTION_NAME 
                if not client_instance.collections.exists(collection_name):
                    print(f"Weaviate collection '{collection_name}' not found during startup. Will be created by ingest if needed.")
                else:
                    print(f"Weaviate collection '{collection_name}' already exists.")
                    
            except Exception as e:
                print(f"ERROR during Weaviate connection or initial check: {e}")
                traceback.print_exc()
                app.state.weaviate_client = None
    else:
        print("Running in LOCAL vector store mode. Weaviate client not initialized.")
        app.state.weaviate_client = None
            
    print("--- Startup Complete ---")
    yield # Application runs here
    
    # --- SHUTDOWN --- 
    print("--- Application Shutdown --- ")
    client_to_close = getattr(app.state, 'weaviate_client', None)
    if client_to_close and hasattr(client_to_close, 'close'):
        print("Closing Weaviate client connection...")
        client_to_close.close()
        print("Weaviate client closed.")
    else:
        print("No Weaviate client found in app.state to close.")
    print("--- Shutdown Complete --- ")

# --- Setup FastAPI App with Lifespan --- 
app = FastAPI(
    title="docRAG API",
    description="API for interacting with the RAG document chatbot.",
    version="0.1.0",
    lifespan=lifespan # Register the lifespan context manager
)

# CORS configuration
# Update origins if your frontend runs on a different port
origins = [
    "http://localhost",
    "http://localhost:5173", # Default Vite port
    "http://127.0.0.1:5173",
    "*",  # Allow all origins temporarily
    # Add other origins if needed (e.g., your deployed frontend URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

# --- REMOVE OLD get_rag_chain FUNCTION --- 
# def get_rag_chain() -> Runnable | None: 
#    ... (old logic with global instance) ...

# --- NEW FUNCTION TO CREATE CHAIN PER REQUEST --- 
def create_chain_for_request(session_id: str, client: Optional[weaviate.Client] = None) -> Runnable:
    """Creates a RAG chain instance specifically for the given session_id."""
    print(f"Creating new RAG chain for session: {session_id} (Mode: {'Local' if Config.USE_LOCAL_VECTOR_STORE else 'Remote'})...")
    llm = create_llm() # Create LLM

    retriever = None
    if Config.USE_LOCAL_VECTOR_STORE:
        # Local FAISS mode
        try:
            retriever = create_retriever(llm=llm) # create_retriever handles local setup
            if retriever is None:
                 raise ValueError("Failed to create local FAISS retriever.")
            print("Local FAISS retriever created successfully for chain.")
        except Exception as e:
            print(f"ERROR creating local retriever for session {session_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to initialize local retriever: {e}")
        # Pass retriever to create_chain, client will be None
        chain = create_chain(llm=llm, retriever=retriever, client=None)

    else:
        # Remote Weaviate mode
        if not client:
            # This should ideally be caught by the dependency, but double-check
            print(f"ERROR: Weaviate client is required for remote mode chain creation (session: {session_id})")
            raise HTTPException(status_code=500, detail="Weaviate client unavailable for chain creation.")
        
        # Pass client to create_chain, retriever will be None
        # create_chain uses the client to call retrieve_context_weaviate with session_id
        chain = create_chain(llm=llm, retriever=None, client=client)
        print(f"Weaviate-based chain created successfully for session {session_id}.")

    if chain is None:
        # This shouldn't happen if exceptions are raised correctly above
        raise HTTPException(status_code=500, detail="Failed to create RAG chain.")
        
    return chain

# --- Pydantic Models for Request/Response ---
class ChatRequest(BaseModel):
    session_id: str
    query: str

class ChatResponse(BaseModel):
    answer: str
    sources: list = []

class ProcessResponse(BaseModel):
    message: str
    processed_files: List[str] = [] # List of filenames successfully processed & ingested
    skipped_count: int = 0
    failed_files: List[str] = []

class ProcessRequest(BaseModel):
    session_id: str # Add session_id field

# --- API Endpoints ---

# Define allowed extensions
ALLOWED_EXTENSIONS = { ".pdf", ".docx", ".txt", ".md", ".xlsx", ".csv"} # Add/remove as needed

@app.post("/api/upload", status_code=200)
async def upload_documents(session_id: Annotated[str, Form()], files: Annotated[List[UploadFile], File()]) -> Dict:
    """Endpoint to upload one or more documents for a specific session."""
    print(f"Received {len(files)} file(s) for upload in session: {session_id}")
    
    # --- Create session-specific upload directory --- 
    session_upload_dir = Config.Path.DOCUMENTS_DIR / session_id
    session_upload_dir.mkdir(parents=True, exist_ok=True)
    print(f"Ensured upload directory exists: {session_upload_dir}")
    # -------------------------------------------

    processed_filenames = [] # Keep track of successfully saved files
    allowed_count = 0
    skipped_count = 0

    for file in files:
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            print(f"Skipping file with unsupported extension: {file.filename}")
            skipped_count += 1
            continue # Skip this file

        allowed_count += 1
        file_path = None # Initialize file_path outside try
        try:
            safe_filename = Path(file.filename).name
            # --- Save to session-specific directory --- 
            file_path = session_upload_dir / safe_filename
            # -------------------------------------------
            
            # Use 'await file.read()' and write bytes
            content = await file.read() 
            with open(file_path, "wb") as buffer:
                buffer.write(content)
                
            # uploaded_paths.append(file_path) # Store Path object - less critical now
            processed_filenames.append(safe_filename)
            print(f"Saved uploaded file to {file_path}")
            
        except Exception as e:
            print(f"Error saving file {file.filename} to {session_upload_dir}: {e}")
            traceback.print_exc()
            # Optionally, continue to next file or raise/return error
            
        finally:
            # Ensure file handle is closed even if error occurs
            # Check if file object exists and has a close method
            if file and hasattr(file, 'close') and callable(file.close):
                try:
                    await file.close()
                    print(f"Closed file handle for: {file.filename}")
                except Exception as close_err:
                    print(f"Warning: Error closing file handle for {file.filename}: {close_err}")
            elif file and hasattr(file, 'file') and hasattr(file.file, 'close') and callable(file.file.close):
                # Handle UploadFile's internal file object if needed (less common)
                 try:
                     file.file.close()
                     print(f"Closed internal file handle for: {file.filename}")
                 except Exception as close_err:
                     print(f"Warning: Error closing internal file handle for {file.filename}: {close_err}")

    if allowed_count == 0:
        raise HTTPException(status_code=400, detail=f"No files with allowed extensions ({', '.join(ALLOWED_EXTENSIONS)}) were provided.")

    if not processed_filenames:
        raise HTTPException(status_code=500, detail="All valid files failed to save.")

    return {
        "message": f"{len(processed_filenames)} valid file(s) uploaded successfully.", 
        "filenames_saved": processed_filenames,
        "skipped_unsupported_extension": skipped_count
    }

@app.post("/api/process", response_model=ProcessResponse)
async def process_documents(request: ProcessRequest, client: weaviate.Client = Depends(get_weaviate_client_dependency)):
    # <<< Pass client dependency correctly >>>
    session_id = request.session_id
    # ... (rest of the processing logic using the passed client) ...
    print(f"DEBUG /api/process: Session ID = {session_id}")
    print(f"DEBUG /api/process: Weaviate client obtained via dependency = {client is not None}")

    try:
        # --- Call the updated ingest function --- 
        # It now handles local mode check internally
        ingest_result = ingest.process_files_for_session(session_id, client)
        # -----------------------------------------
        
        print(f"DEBUG /api/process: Call to ingest.process_files_for_session completed for {session_id}")
        print(f"DEBUG /api/process: Result = {ingest_result}")

        # Return ProcessResponse based on the dictionary from ingest
        return ProcessResponse(
            message=ingest_result.get("message", "Processing status unknown."),
            processed_files=ingest_result.get("processed_filenames", []),
            skipped_count=ingest_result.get("skipped_count", 0),
            failed_files=ingest_result.get("failed_files", [])
        )

    except Exception as e:
        print(f"!!!!!!!! UNEXPECTED ERROR in /api/process endpoint for session {session_id}: {e} !!!!!!!!")
        traceback.print_exc()
        # Use 500 for internal server errors
        raise HTTPException(status_code=500, detail=f"Unexpected error during document processing: {e}")

@app.post("/api/chat")
async def chat_endpoint(chat_req: ChatRequest, client: weaviate.Client = Depends(get_weaviate_client_dependency)):
    """Endpoint to handle chat requests and stream responses using standard StreamingResponse."""
    session_id = chat_req.session_id
    query = chat_req.query

    if not session_id or not query:
        raise HTTPException(status_code=400, detail="session_id and query are required")

    try:
        rag_chain = create_chain_for_request(session_id, client)
        config = RunnableConfig(
            callbacks=[LoggingCallbackHandler("Chat Endpoint Chain")],
            configurable={
                "session_id": session_id,
                "client": client,
                "user_query": query
            },
            recursion_limit=25
        )

        async def stream_response() -> AsyncGenerator[str, Any]:
            """Async generator formatting output for SSE manually."""
            event_counter = 0
            final_sources = [] # <<< Store sources when found
            try:
                async for event in rag_chain.astream_events(
                    {"question": query},
                    config=config,
                    version="v1",
                ):
                    event_counter += 1
                    log_event(event, event_counter)
                    event_type = event["event"]
                    name = event.get("name", "Unknown")

                    # Capture sources on the END event of the final step
                    if event_type == "on_chain_end" and name == "FormatAndGenerate":
                        output_data = event.get("data", {}).get("output", {})
                        if isinstance(output_data, dict):
                            final_sources = output_data.get("source_documents", [])
                            print(f"--- Captured final sources ({len(final_sources)}) on chain end ---")
                        else:
                            print(f"Warning: Unexpected output type for {name} end event: {type(output_data)}")

                    # Yield tokens as they stream
                    elif event_type == "on_chat_model_stream":
                        content = event["data"]["chunk"].content
                        if content:
                            token_json = json.dumps({"type": "token", "content": content})
                            yield f"data: {token_json}\n\n"
                            
                    # Yield errors immediately
                    elif event_type == "on_chain_error" or event_type == "on_tool_error" or event_type == "on_retriever_error" or event_type == "on_llm_error":
                        error_message = str(event["data"].get("error", "Unknown stream error"))
                        print(f"ERROR during stream event: {error_message}")
                        error_json = json.dumps({"type": "error", "message": error_message})
                        yield f"data: {error_json}\n\n"
                        break

            except Exception as e:
                print(f"ERROR during chain execution or streaming: {e}")
                traceback.print_exc()
                error_json = json.dumps({"type": "error", "message": f"Server error during streaming: {e}"})
                yield f"data: {error_json}\n\n"
            finally:
                print("DEBUG stream_response: astream_events loop finished.")
                
                # Yield the captured sources *after* the loop finishes, before the end event
                if final_sources:
                    try:
                         sources_json = json.dumps({"type": "sources", "sources": [format_source(s) for s in final_sources]})
                         print(f"--- Backend Stream: Yielding final sources ({len(final_sources)}) --- ")
                         yield f"data: {sources_json}\n\n"
                    except Exception as format_err:
                         print(f"ERROR formatting final sources: {format_err}")
                         # Optionally yield an error event here if source formatting fails

                # Send the final 'end' event
                end_event = json.dumps({"type": "end", "content": "Stream finished"})
                print("--- Backend Stream: Sent 'end' event ---")
                yield f"data: {end_event}\n\n"

        # Use standard StreamingResponse
        headers = {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            # Keep Content-Type as text/event-stream for the frontend
            'Content-Type': 'text/event-stream' 
        }
        return StreamingResponse(stream_response(), media_type="text/event-stream", headers=headers)

    except HTTPException as he:
        print(f"HTTP Exception in chat endpoint: {he.detail}")
        raise he
    except Exception as e:
        print(f"Unhandled Exception in chat endpoint: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error in chat endpoint: {e}")

# Helper to format source documents
def format_source(doc: Document) -> Dict:
    # Basic formatting, adjust as needed
    metadata = doc.metadata or {}
    # Calculate distance if embeddings are available (example, adapt if needed)
    # distance = metadata.get('distance') 
    return {
        "content_snippet": doc.page_content[:100] + ("..." if len(doc.page_content) > 100 else ""), # Example snippet
        "metadata": {
            "source": metadata.get('source', 'Unknown'),
            "page": metadata.get('page'),
            # "distance": float(distance) if distance is not None else None, # Include distance if available
            # Add other relevant metadata fields
        }
    }

# --- Simple Logging Callback Handler --- 
from langchain_core.callbacks import BaseCallbackHandler
from typing import Dict, Any, List
from uuid import UUID

class LoggingCallbackHandler(BaseCallbackHandler):
    def __init__(self, name: str = "Unnamed Chain"):
        self.name = name
        self.event_count = 0
        
    def _log(self, event_name: str, run_id: UUID, **kwargs: Any) -> None:
        self.event_count += 1
        # print(f"--- {self.name} Callback #{self.event_count} ---")
        # print(f"  Event: {event_name} (Run ID: {run_id})")
        # for key, value in kwargs.items():
        #     print(f"  {key}: {value}")
        # print("-"*30)
        pass # Keep it quiet unless debugging

    def on_chain_start(self, serialized: Dict[str, Any], inputs: Dict[str, Any], *, run_id: UUID, parent_run_id: UUID | None = None, tags: List[str] | None = None, metadata: Dict[str, Any] | None = None, **kwargs: Any) -> Any:
        self._log("on_chain_start", run_id, inputs=inputs, tags=tags, metadata=metadata)

    def on_chain_end(self, outputs: Dict[str, Any], *, run_id: UUID, parent_run_id: UUID | None = None, **kwargs: Any) -> Any:
        self._log("on_chain_end", run_id, outputs=outputs)

    # Add other on_... methods if you need more detailed logging (on_llm_start, etc.)

def log_event(event: Dict[str, Any], counter: int):
    """Helper function to log specific details from astream_events."""
    event_kind = event.get("event")
    runnable_name = event.get("name", "Unknown Runnable")
    # print(f"--- Backend Stream Event #{counter} ---")
    # print(f"  Event Kind: {event_kind}")
    # print(f"  Runnable Name: {runnable_name}")

    if event_kind == "on_chat_model_stream":
        chunk_content = event.get("data", {}).get("chunk", None)
        if chunk_content:
            # print(f"  Chat Model Chunk: {chunk_content.content!r}")
            pass # Reduced verbosity
    elif event_kind == "on_chain_stream" and runnable_name == "RunnableParallel<answer,source_documents>":
        chunk = event.get("data", {}).get("chunk", {})
        if chunk.get("source_documents"):
             # print(f"  Source Documents Found: {len(chunk['source_documents'])}")
             pass # Reduced verbosity
    # else:
        # Log other relevant keys if needed for debugging
        # other_keys = [k for k in event.get("data", {}).keys() if k != 'chunk' and k != 'input' and k != 'output']
        # if other_keys:
        #     print(f"  Other Event Data (Keys): {other_keys}")
    # print("-"*35)
    pass # Keep overall logging quiet unless needed

# --- Add Root Endpoint --- 
@app.get("/")
def read_root():
    return {"message": "Welcome to the docRAG API!"}

# --- Main execution --- 
if __name__ == "__main__":
    # Set host to 0.0.0.0 to be accessible externally if needed
    uvicorn.run(app, host="0.0.0.0", port=8088, reload=True)
