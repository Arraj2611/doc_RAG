from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Request, BackgroundTasks, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
import shutil
from pathlib import Path
import traceback
from langchain_core.callbacks import BaseCallbackHandler
from typing import Dict, Any, List
from uuid import UUID
from typing import List, Dict, Optional, Any, Annotated, AsyncGenerator, Set
from contextlib import asynccontextmanager
import weaviate
from weaviate.classes.init import Auth
from weaviate.collections.classes.tenants import Tenant
from langchain_core.runnables import Runnable, RunnableConfig
from langchain_core.documents import Document
import json
from fastapi.responses import StreamingResponse, FileResponse, RedirectResponse
from dotenv import load_dotenv
from datetime import datetime, timedelta
from passlib.context import CryptContext

# AWS SDK
import boto3
from botocore.exceptions import ClientError
import io # For BytesIO with upload_fileobj if needed, or directly passing file.file

from .ragbase.chain import create_chain, save_message_pair
from .ragbase import ingest
from .ragbase.config import Config 
from .ragbase.retriever import create_retriever
from .ragbase.model import create_llm
from .ragbase.ingest import COLLECTION_NAME
from .database import mongo_handler

load_dotenv()

# -----------------------------
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
    
    # 1. Clear tmp upload directory (Consider if this is still needed with OCI)
    # If Config.Path.DOCUMENTS_DIR is only a temporary staging, clearing might be okay.
    # If uploads go directly to OCI, this local directory might not be used for uploads anymore.
    upload_dir = Config.Path.DOCUMENTS_DIR # This is backend/database/documents
    # The original code clears this. If OCI is the primary store, 
    # clearing a local 'cache' or 'staging' on startup could still be valid.
    # However, if this path is *exclusively* for local-only (non-cloud) runs, 
    # then for cloud deployment this section might need conditional logic or removal.
    # For now, keeping the original logic, but be mindful of its role.
    if upload_dir.exists() and upload_dir.is_dir():
        print(f"Clearing existing local upload directory: {upload_dir}")
        try:
            shutil.rmtree(upload_dir)
            print("Local upload directory cleared.")
        except Exception as e:
            print(f"Warning: Could not clear local upload directory {upload_dir}: {e}")
    try:
        upload_dir.mkdir(parents=True, exist_ok=True) # Ensures it exists if used for temp purposes
        print(f"Ensured local upload directory exists: {upload_dir}")
    except Exception as e:
         print(f"Warning: Could not create local upload directory {upload_dir}: {e}")
         # In a cloud env, if this local path is critical and fails, it might be an issue.

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
    lifespan=lifespan
)

# CORS configuration
origins = [
    "http://localhost",
    "http://localhost:5173", # Default Vite port 
    "http://127.0.0.1:5173", # Default Vite port 
    "http://localhost:5000", # The actual frontend origin
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Use the updated list
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)


# --- NEW FUNCTION TO CREATE CHAIN --- 
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

# --- NEW Authentication Models ---
class UserBase(BaseModel):
    username: str = Field(..., min_length=3)
    email: EmailStr # Use EmailStr for validation

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserResponse(UserBase):
    id: str
    created_at: datetime
    
# --- END NEW Authentication Models ---

# --- Setup Password Hashing Context ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# ------------------------------------

# --- API Endpoints ---

# Define allowed extensions
ALLOWED_EXTENSIONS = { ".pdf", ".docx", ".txt", ".md", ".xlsx", ".csv"}

@app.post("/api/upload", status_code=200)
async def upload_documents(session_id: Annotated[str, Form()], files: Annotated[List[UploadFile], File()]) -> Dict:
    """Endpoint to upload one or more documents for a specific session.
    MODIFIED FOR AWS S3: Files will be uploaded to AWS S3.
    """
    print(f"UPLOAD: Received {len(files)} file(s) for upload in session: {session_id}")

    # --- AWS S3 Client Initialization ---
    try:
        # Boto3 will use credentials from environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN),
        # an IAM role (if running on EC2/ECS), or the AWS CLI configuration (~/.aws/credentials).
        s3_client = boto3.client('s3', region_name=Config.AWS.S3_REGION)
    except Exception as e:
        print(f"UPLOAD: ERROR initializing AWS S3 client: {e}")
        raise HTTPException(status_code=500, detail="Could not connect to Object Storage (S3).")
    # ----------------------------------

    s3_object_prefix = f"tenants/{session_id}/"
    print(f"UPLOAD: Target S3 prefix: {s3_object_prefix}")

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
        safe_filename = Path(file.filename).name
        s3_object_key = f"{s3_object_prefix}{safe_filename}"

        try:
            # --- AWS S3 UPLOAD LOGIC ---
            print(f"UPLOAD: Attempting to upload to S3: bucket='{Config.AWS.S3_BUCKET_NAME}', key='{s3_object_key}'")
            # FastAPI's UploadFile.file is a SpooledTemporaryFile, which is a file-like object.
            # We need to ensure the file pointer is at the beginning if it has been read before,
            # though for a new UploadFile, it should be.
            await file.seek(0) 
            s3_client.upload_fileobj(
                file.file, # Pass the file-like object
                Config.AWS.S3_BUCKET_NAME,
                s3_object_key
            )
            print(f"UPLOAD: Successfully uploaded to S3: {s3_object_key}")
            # --- END AWS S3 UPLOAD LOGIC ---
            
            processed_filenames.append(safe_filename)
            
        except ClientError as e:
            print(f"UPLOAD: ERROR (ClientError) processing file {file.filename} for S3 upload to {s3_object_key}: {e}")
            traceback.print_exc()
            # Optionally, collect failed filenames here if you want to report them
        except Exception as e:
            print(f"UPLOAD: ERROR (General) processing file {file.filename} for S3 upload to {s3_object_key}: {e}")
            traceback.print_exc()
        finally:
            if file and hasattr(file, 'close') and callable(file.close):
                try:
                    await file.close()
                except Exception as close_err:
                    print(f"Warning: Error closing file handle for {file.filename}: {close_err}")

    if allowed_count == 0:
        raise HTTPException(status_code=400, detail=f"No files with allowed extensions ({', '.join(ALLOWED_EXTENSIONS)}) were provided.")

    if not processed_filenames:
        raise HTTPException(status_code=500, detail="All valid files failed to upload to Object Storage (S3).")

    return {
        "message": f"{len(processed_filenames)} valid file(s) prepared for processing (uploaded to S3).", 
        "filenames_saved_to_s3": processed_filenames,
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
    return {
        "content_snippet": doc.page_content[:100] + ("..." if len(doc.page_content) > 100 else ""), # Example snippet
        "metadata": {
            "source": metadata.get('source', 'Unknown'),
            "page": metadata.get('page'),
        }
    }

# --- Simple Logging Callback Handler --- 
class LoggingCallbackHandler(BaseCallbackHandler):
    def __init__(self, name: str = "Unnamed Chain"):
        self.name = name
        self.event_count = 0
        
    def _log(self, event_name: str, run_id: UUID, **kwargs: Any) -> None:
        self.event_count += 1
        pass

    def on_chain_start(self, serialized: Dict[str, Any], inputs: Dict[str, Any], *, run_id: UUID, parent_run_id: UUID | None = None, tags: List[str] | None = None, metadata: Dict[str, Any] | None = None, **kwargs: Any) -> Any:
        self._log("on_chain_start", run_id, inputs=inputs, tags=tags, metadata=metadata)

    def on_chain_end(self, outputs: Dict[str, Any], *, run_id: UUID, parent_run_id: UUID | None = None, **kwargs: Any) -> Any:
        self._log("on_chain_end", run_id, outputs=outputs)

    # Add other on_... methods if you need more detailed logging (on_llm_start, etc.)

def log_event(event: Dict[str, Any], counter: int):
    """Helper function to log specific details from astream_events."""
    event_kind = event.get("event")
    runnable_name = event.get("name", "Unknown Runnable")

    if event_kind == "on_chat_model_stream":
        chunk_content = event.get("data", {}).get("chunk", None)
        if chunk_content:
            pass # Reduced verbosity
    elif event_kind == "on_chain_stream" and runnable_name == "RunnableParallel<answer,source_documents>":
        chunk = event.get("data", {}).get("chunk", {})
        if chunk.get("source_documents"):
             pass # Reduced verbosity
    pass # Keep overall logging quiet unless needed

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
@app.get("/api/files/{session_id}/{filename}") # Removed response_class=StreamingResponse, will be RedirectResponse
async def get_document_file(session_id: str, filename: str):
    if ".." in filename or "/" in filename or "\\\\": # Python auto-escapes backslashes in f-strings/strings
        raise HTTPException(status_code=400, detail="Invalid filename")
        
    # --- AWS S3 Client Initialization ---
    try:
        s3_client = boto3.client('s3', region_name=Config.AWS.S3_REGION, config=boto3.session.Config(signature_version='s3v4'))
    except Exception as e:
        print(f"GET_FILE: ERROR initializing AWS S3 client: {e}")
        raise HTTPException(status_code=500, detail="Could not connect to Object Storage (S3).")
    # -----------------------------------------------------

    s3_object_key = f"tenants/{session_id}/{filename}"
    
    # --- AWS S3 GET OBJECT LOGIC ---
    print(f"GET_FILE: Attempting to generate pre-signed URL for S3: bucket='{Config.AWS.S3_BUCKET_NAME}', key='{s3_object_key}'")
    try:
        # Generate a Pre-Signed URL
        presigned_url = s3_client.generate_presigned_url('get_object',
                                                         Params={'Bucket': Config.AWS.S3_BUCKET_NAME,
                                                                 'Key': s3_object_key},
                                                         ExpiresIn=300) # URL expires in 5 minutes (300 seconds)
        
        print(f"GET_FILE: Successfully generated pre-signed URL for {s3_object_key}")
        return RedirectResponse(url=presigned_url)
    
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        if error_code == 'NoSuchKey':
            print(f"GET_FILE: File not found in S3: {s3_object_key}")
            raise HTTPException(status_code=404, detail="File not found in Object Storage (S3)")
        elif error_code == '403 Forbidden' or e.response.get('ResponseMetadata', {}).get('HTTPStatusCode') == 403:
             print(f"GET_FILE: Forbidden to access S3 key {s3_object_key}. Check bucket/object permissions and presigning setup.")
             raise HTTPException(status_code=403, detail=f"Forbidden to access file from S3.")
        else:
            print(f"GET_FILE: S3 ClientError for {s3_object_key}: {e}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error retrieving file from S3: {e.response.get('Error', {}).get('Message', 'Unknown S3 error')}")
    except Exception as e:
        print(f"GET_FILE: Unexpected error for {s3_object_key}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error while fetching file from S3")
    # --- END AWS S3 GET OBJECT LOGIC ---

# --- NEW: Delete Document Endpoint --- 
@app.delete("/api/documents/{session_id}", status_code=200)
async def delete_document_endpoint(session_id: str, client: weaviate.Client = Depends(get_weaviate_client_dependency)):
    print(f"--- Received request to delete session: {session_id} ---")
    # TODO: Add user authentication check - ensure user owns this session_id
    
    errors = []
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

    print(f"  [Delete] WARNING: Skipping file/directory deletion for session {session_id}.")

    # 5. Return Response
    if errors:
        print(f"--- Deletion for session {session_id} completed with errors: {len(errors)} ---")
        raise HTTPException(status_code=500, detail=f"Deletion partially failed for session {session_id}. Errors: {'; '.join(errors)}")
    else:
        print(f"--- Successfully deleted DB data for session: {session_id} (File system deletion skipped) ---")
        return {"message": f"Successfully deleted document database entries for session {session_id}. File system deletion skipped."}

# --- NEW Authentication Endpoints ---

@app.post("/api/auth/register", response_model=UserResponse, status_code=201)
async def register_user(user_data: UserCreate):
    """Handles user registration."""
    print(f"--- Received request to register user: {user_data.username} ({user_data.email}) ---")
    
    
    existing_by_username = mongo_handler.get_user_by_username(user_data.username)
    if existing_by_username:
        print(f"  [Register] Error: Username '{user_data.username}' already taken.")
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Hash the password
    try:
        hashed_password = pwd_context.hash(user_data.password)
        print(f"  [Register] Password hashed successfully for {user_data.username}.")
    except Exception as hash_err:
        print(f"  [Register] Error hashing password for {user_data.username}: {hash_err}")
        raise HTTPException(status_code=500, detail="Error processing registration data")
        
    # Create user in DB
    creation_result = mongo_handler.create_user(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password
    )
    
    # Handle potential errors from DB creation
    if not creation_result:
        print(f"  [Register] Error: MongoDB handler returned None for {user_data.username}.")
        raise HTTPException(status_code=500, detail="User creation failed (internal error).")
        
    if "error" in creation_result:
        error_detail = creation_result["error"]
        print(f"  [Register] Error from MongoDB handler: {error_detail}")
        # Check if the error is one we expect (like duplicate email)
        if "already exists" in error_detail or "already registered" in error_detail:
             raise HTTPException(status_code=400, detail=error_detail)
        else:
             raise HTTPException(status_code=500, detail=f"User creation failed: {error_detail}")

    # Successfully created - creation_result contains the user dict (without password)
    print(f"--- User '{user_data.username}' registered successfully. ID: {creation_result.get('id')} ---")
    return UserResponse(**creation_result)

# --- END NEW Authentication Endpoints ---

# --- Root Endpoint --- 
@app.get("/")
def read_root():
    return {"message": "Welcome to the DocRAG API"}