from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Request, BackgroundTasks, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
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
from fastapi.responses import StreamingResponse, JSONResponse, Response, FileResponse
from dotenv import load_dotenv
from datetime import datetime
import stat # For checking file permissions/type
import aiofiles
import uuid
import logging
import PyPDF2

# --- Load .env file explicitly if needed ---
# Usually FastAPI/Uvicorn handle this, but being explicit can help
load_dotenv()
# -----------------------------------------

# --- Relative Imports (Simplified) --- 
# Use consistent relative imports within the backend package
from .ragbase.chain import create_chain, get_session_history, save_message_pair
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
# --- Import MongoDB Handler --- 
from .database import mongo_handler
# -----------------------------

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
            
    # 4. Initialize MongoDB Client
    print("Initializing MongoDB client...")
    if mongo_handler.connect_to_mongo() is not None: 
        print("MongoDB connection successful.")
    else:
        print("ERROR: Failed to connect to MongoDB during startup.")
        # Decide if this is fatal
        # exit(1) 
            
    print("--- Startup Complete ---")
    yield # Application runs here
    
    # --- SHUTDOWN --- 
    print("--- Application Shutdown --- ")
    # Close Weaviate
    client_to_close = getattr(app.state, 'weaviate_client', None)
    if client_to_close and hasattr(client_to_close, 'close'):
        print("Closing Weaviate client connection...")
        client_to_close.close()
        print("Weaviate client closed.")
    else:
        print("No Weaviate client found in app.state to close.")
        
    # Close MongoDB
    mongo_handler.close_mongo_connection()
    
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
    "http://localhost:5173", # Default Vite port (keep for reference)
    "http://127.0.0.1:5173", # Default Vite port (keep for reference)
    "http://localhost:5000", # Add the actual frontend origin
    # "*",  # Remove wildcard when using specific origins and allow_credentials=True
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Use the updated list
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
    user_id: Optional[str] = None # Add optional user_id

# --- NEW Models for Mongo Endpoints --- 
class DocumentMetadata(BaseModel):
    session_id: str
    filename: str
    user_id: Optional[str] = None
    # Add other fields that might be saved in mongo_handler.save_document_metadata
    processed_at: Optional[datetime] = None 

class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: Optional[datetime] = None # Included if returned by handler

class InsightData(BaseModel):
    id: str # Add the ID field
    insight: str
    timestamp: Optional[datetime] = None # Included if returned by handler

class InsightRequest(BaseModel):
    session_id: str
    insight: str = Field(..., min_length=1)
# -------------------------------------

# --- API Endpoints ---

# Define allowed extensions
ALLOWED_EXTENSIONS = { ".pdf", ".docx", ".txt", ".md", ".xlsx", ".csv"}

@app.post("/api/upload", status_code=200)
async def upload_documents(session_id: Annotated[str, Form()], files: Annotated[List[UploadFile], File()]) -> Dict:
    """Endpoint to upload one or more documents for a specific session."""
    print(f"UPLOAD: Received {len(files)} file(s) for upload in session: {session_id}")
    
    # --- Create session-specific upload directory --- 
    # Use the configured path
    session_upload_dir = Config.Path.DOCUMENTS_DIR / session_id 
    session_upload_dir.mkdir(parents=True, exist_ok=True)
    # Log the directory path being used
    print(f"UPLOAD: Ensured upload directory exists: {session_upload_dir.resolve()}") 
    # -------------------------------------------

    processed_filenames = []
    allowed_count = 0
    skipped_count = 0

    for file in files:
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            print(f"UPLOAD: Skipping file with unsupported extension: {file.filename}")
            skipped_count += 1
            continue

        allowed_count += 1
        file_path = None
        try:
            safe_filename = Path(file.filename).name
            file_path = session_upload_dir / safe_filename
            # Log the specific file path before writing
            print(f"UPLOAD: Attempting to save file to: {file_path.resolve()}") 
            
            content = await file.read() 
            with open(file_path, "wb") as buffer:
                buffer.write(content)
                
            processed_filenames.append(safe_filename)
            # Log success AFTER write completes
            print(f"UPLOAD: Successfully saved file: {file_path.resolve()}") 
            
        except Exception as e:
            # Log the exact error during save
            print(f"UPLOAD: ERROR saving file {file.filename} to {session_upload_dir}: {e}")
            traceback.print_exc()
            
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
    session_id = request.session_id
    user_id = request.user_id # Get user_id from request
    print(f"DEBUG /api/process: Session ID = {session_id}, User ID = {user_id}")

    try:
        # Call the ingest function
        ingest_result = ingest.process_files_for_session(session_id, client)
        print(f"DEBUG /api/process: ingest_result = {ingest_result}")

        # --- Save metadata to MongoDB for successfully processed files --- 
        processed_files = ingest_result.get("processed_files", []) # Use "processed_files" key
        if processed_files:
            print(f"Saving metadata to MongoDB for {len(processed_files)} processed files in session {session_id}...")
            saved_count = 0
            for filename in processed_files:
                # Pass user_id to the handler
                metadata_saved = mongo_handler.save_document_metadata(
                    session_id=session_id, 
                    filename=filename, 
                    user_id=user_id, # Pass it here
                    processed_at=datetime.utcnow()
                )
                if metadata_saved:
                    saved_count += 1
                else:
                    print(f"Warning: Failed to save metadata for {filename} in session {session_id}")
            print(f"Successfully saved metadata for {saved_count}/{len(processed_files)} files.")
        else:
             print(f"No files were successfully processed in session {session_id}, skipping metadata save.")
        # ----------------------------------------------------------------
        
        # Return ProcessResponse based on the dictionary from ingest
        return ProcessResponse(
            message=ingest_result.get("message", "Processing status unknown."),
            processed_files=processed_files,
            skipped_count=ingest_result.get("skipped_count", 0),
            failed_files=ingest_result.get("failed_files", [])
        )

    except Exception as e:
        print(f"!!!!!!!! UNEXPECTED ERROR in /api/process endpoint for session {session_id}: {e} !!!!!!!!")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Unexpected error during document processing: {e}")

@app.post("/api/chat")
async def chat_endpoint(chat_req: ChatRequest, background_tasks: BackgroundTasks, client: weaviate.Client = Depends(get_weaviate_client_dependency)):
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
                "user_query": query # Pass user query here
            },
            recursion_limit=25
        )

        async def stream_response() -> AsyncGenerator[str, Any]:
            event_counter = 0
            final_sources = []
            full_answer = "" # Accumulate the full answer
            try:
                async for event in rag_chain.astream_events(
                    {"question": query},
                    config=config,
                    version="v1",
                ):
                    event_counter += 1
                    # log_event(event, event_counter) # Keep quiet unless debugging
                    event_type = event["event"]
                    name = event.get("name", "Unknown")

                    # Capture sources from the specific step if needed (adjust name if chain changes)
                    if event_type == "on_chain_end" and name == "FormatAndGenerate":
                        output_data = event.get("data", {}).get("output", {})
                        if isinstance(output_data, dict):
                             final_sources = output_data.get("source_documents", [])
                             # Get the final generated answer here as well
                             answer_part = output_data.get("answer", "")
                             if isinstance(answer_part, str): # If it's already parsed to string
                                 full_answer = answer_part 
                                 print(f"--- Captured final answer (str) on chain end ---")
                             elif hasattr(answer_part, 'content'): # If it's an AIMessageChunk/AIMessage
                                 full_answer = answer_part.content
                                 print(f"--- Captured final answer (AIMessage) on chain end ---")
                             else:
                                 print(f"Warning: Unexpected answer type on FormatAndGenerate end: {type(answer_part)}")
                                # Attempt to capture from llm stream if direct capture fails
                        else:
                            print(f"Warning: Unexpected output type for {name} end event: {type(output_data)}")

                    # Yield tokens and accumulate answer
                    elif event_type == "on_chat_model_stream":
                        chunk = event["data"]["chunk"]
                        content = chunk.content
                        if content:
                            full_answer += content # Accumulate here
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
                # --- Save message pair after streaming finishes --- 
                if full_answer: # Only save if an answer was generated
                    print(f"DEBUG stream_response: Adding save_message_pair to background tasks for session {session_id}.")
                    background_tasks.add_task(save_message_pair, session_id, query, full_answer)
                else:
                    print(f"WARNING stream_response: No full answer generated for session {session_id}, skipping history save.")
                # ----------------------------------------------------
                
                # Yield final sources
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

# --- NEW MongoDB Endpoints --- 

# TODO: Add Authentication/Authorization checks to endpoints needing user context

@app.get("/api/documents", response_model=List[DocumentMetadata])
async def get_documents_for_user(user_id: str): # How to get user_id? Auth needed.
    """Retrieves list of documents associated with a user."""
    # This endpoint NEEDS proper authentication to get the correct user_id
    # For now, it takes user_id as a query parameter for testing.
    print(f"Endpoint /api/documents called for user_id: {user_id}")
    docs = mongo_handler.get_user_documents(user_id)
    if not docs:
        # Return empty list, or 404 if preferred
        # raise HTTPException(status_code=404, detail="No documents found for this user.")
        pass 
    return docs

@app.get("/api/history/{session_id}", response_model=List[ChatMessage])
async def get_session_chat_history(session_id: str):
    """Retrieves the chat history for a specific session."""
    print(f"Endpoint /api/history/{session_id} called")
    history = mongo_handler.get_chat_history(session_id)
    # The response model will validate the structure
    return history

@app.post("/api/insights", status_code=201)
async def save_user_insight(request: InsightRequest):
    """Saves a user-provided insight for a specific session."""
    print(f"Endpoint /api/insights called for session: {request.session_id}")
    success = mongo_handler.save_insight(request.session_id, request.insight)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save insight.")
    return {"message": "Insight saved successfully."}

@app.get("/api/insights/{session_id}", response_model=List[InsightData])
async def get_session_insights(session_id: str):
    """Retrieves all saved insights for a specific session."""
    print(f"Endpoint /api/insights/{session_id} called")
    insights = mongo_handler.get_insights(session_id)
    return insights

@app.delete("/api/insights/{insight_id}", status_code=200)
async def delete_user_insight(insight_id: str):
    """Deletes a specific insight by its ID."""
    print(f"Endpoint DELETE /api/insights/{insight_id} called")
    success = mongo_handler.delete_insight_by_id(insight_id)
    if not success:
        # Consider returning 404 if not found vs 500 for other errors
        raise HTTPException(status_code=404, detail=f"Insight with id {insight_id} not found or failed to delete.")
    return {"message": "Insight deleted successfully."}

# --- NEW Endpoint to Serve Uploaded Files --- 
@app.get("/api/files/{session_id}/{filename}", response_class=FileResponse)
async def get_document_file(session_id: str, filename: str):
    # TODO: Add user authentication check - does the user own this session_id?
    # SECURITY: Prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
        
    # Construct the path using Config
    file_path = Config.Path.DOCUMENTS_DIR / session_id / filename
    
    if not file_path.exists() or not file_path.is_file():
        print(f"Error: File not found at {file_path}")
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check if file is within the intended directory (extra safety)
    try:
        resolved_base = Config.Path.DOCUMENTS_DIR.resolve()
        resolved_file = file_path.resolve()
        if not str(resolved_file).startswith(str(resolved_base)):
             print(f"Error: Attempt to access file outside allowed directory: {file_path}")
             raise HTTPException(status_code=403, detail="Access forbidden")
    except Exception as resolve_err:
         print(f"Error resolving file path: {resolve_err}")
         raise HTTPException(status_code=500, detail="Internal server error")

    return FileResponse(path=str(file_path), filename=filename, media_type='application/pdf')

# --- NEW: Delete Document Endpoint --- 
@app.delete("/api/documents/{session_id}", status_code=200)
async def delete_document_endpoint(session_id: str, client: weaviate.Client = Depends(get_weaviate_client_dependency)):
    print(f"--- Received request to delete session: {session_id} ---")
    # TODO: Add user authentication check - ensure user owns this session_id
    
    errors = []
    # filename_to_delete = "Unknown"
    # doc_metadata = None

    # --- TEMPORARILY SKIPPED: Metadata Fetching & File Deletion (Requires Auth) --- 
    # # 1. Get Document Filename from MongoDB (needed for file deletion)
    # try:
    #     print(f"  [Delete] Fetching document metadata from MongoDB for session {session_id}...")
    #     # This needs user_id which we don't have securely yet.
    #     # For now, we skip fetching metadata and deleting the file.
    #     # Replace with get_document_by_session_id or similar if added later.
    #     # all_user_docs = mongo_handler.get_user_documents(user_id_from_auth)
    #     # doc_metadata = next((doc for doc in all_user_docs if doc.get('session_id') == session_id), None)
    #     # if doc_metadata:
    #     #     filename_to_delete = doc_metadata.get('filename', 'Unknown')
    #     #     print(f"  [Delete] Found filename: {filename_to_delete}")
    #     # else:
    #     #     print(f"  [Delete] No document metadata found in MongoDB for session {session_id}.")
    # except Exception as mongo_meta_err:
    #     error_msg = f"Error fetching metadata from MongoDB: {mongo_meta_err}"
    #     print(f"  [Delete] {error_msg}")
    #     errors.append(error_msg)
    filename_to_delete = "Unknown" # Keep this as Unknown since we skipped fetch
    print("  [Delete] WARNING: Skipping metadata fetch and file deletion due to missing authentication.")
    # ----------------------------------------------------------------------------

    # 2. Delete from Weaviate (Tenant)
    if not Config.USE_LOCAL_VECTOR_STORE:
        if not client:
             error_msg = "Weaviate client not available, cannot delete tenant."
             print(f"  [Delete] {error_msg}")
             errors.append(error_msg)
        else:
            try:
                collection_name = COLLECTION_NAME
                if client.collections.exists(collection_name):
                    collection = client.collections.get(collection_name)
                    if collection.tenants.exists(session_id):
                        print(f"  [Delete] Deleting Weaviate tenant: {session_id} from collection {collection_name}...")
                        collection.tenants.remove([session_id])
                        print(f"  [Delete] Weaviate tenant {session_id} deleted.")
                    else:
                         print(f"  [Delete] Weaviate tenant {session_id} not found in collection {collection_name}. Skipping.")
                else:
                     print(f"  [Delete] Weaviate collection {collection_name} not found. Skipping tenant deletion.")
            except Exception as weaviate_err:
                error_msg = f"Error deleting Weaviate tenant {session_id}: {weaviate_err}"
                print(f"  [Delete] {error_msg}")
                errors.append(error_msg)
    else:
        print("  [Delete] Local mode - Skipping Weaviate tenant deletion.")
        # TODO: Add logic here if using local FAISS per session - delete the FAISS index directory/files

    # 3. Delete from MongoDB (Metadata, History, Insights)
    try:
        print(f"  [Delete] Deleting MongoDB entries for session {session_id}...")
        # Use the newly added function
        delete_result = await mongo_handler.delete_all_session_data(session_id) 
        print(f"  [Delete] MongoDB deletion result: {delete_result}")
        # Optionally check counts in delete_result if needed
    except Exception as mongo_err:
        error_msg = f"Error deleting MongoDB data for session {session_id}: {mongo_err}"
        print(f"  [Delete] {error_msg}")
        errors.append(error_msg)

    # 4. Delete Uploaded File (Temporarily Skipped)
    # if filename_to_delete != "Unknown":
    #     try:
    #         file_dir = Config.Path.DOCUMENTS_DIR / session_id
    #         print(f"  [Delete] Attempting to delete file directory: {file_dir}...")
    #         if file_dir.exists() and file_dir.is_dir():
    #              shutil.rmtree(file_dir)
    #              print(f"  [Delete] Successfully deleted directory: {file_dir}")
    #         else:
    #              print(f"  [Delete] File directory not found or not a directory: {file_dir}. Skipping file deletion.")
    #     except Exception as file_err:
    #         error_msg = f"Error deleting directory for session {session_id}: {file_err}"
    #         print(f"  [Delete] {error_msg}")
    #         errors.append(error_msg)
    # else:
    #     print(f"  [Delete] Filename unknown, skipping file/directory deletion for session {session_id}.")
    print(f"  [Delete] WARNING: Skipping file/directory deletion for session {session_id}.")

    # 5. Return Response
    if errors:
        print(f"--- Deletion for session {session_id} completed with errors: {len(errors)} ---")
        raise HTTPException(status_code=500, detail=f"Deletion partially failed for session {session_id}. Errors: {'; '.join(errors)}")
    else:
        print(f"--- Successfully deleted DB data for session: {session_id} (File system deletion skipped) ---")
        return {"message": f"Successfully deleted document database entries for session {session_id}. File system deletion skipped."}

# --- Root Endpoint --- 
@app.get("/")
def read_root():
    return {"message": "Welcome to the DocRAG API"}

# --- Main Execution (for running directly) --- 
# if __name__ == "__main__":
#     print("Starting FastAPI server...")
#     uvicorn.run(
#         "api:app", # Changed from app:app if api.py is the entry point
#         host=Config.Network.HOST,
#         port=Config.Network.PORT,
#         reload=Config.Network.RELOAD, # Use reload config
#         log_level=Config.Logging.LEVEL.lower(), # Use log level config
#     )
#     print("FastAPI server stopped.")
