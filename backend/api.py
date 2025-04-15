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
from langchain_core.runnables import Runnable
from langchain_core.documents import Document
import json
from fastapi.responses import StreamingResponse, JSONResponse
from dotenv import load_dotenv

# --- Load .env file explicitly if needed ---
# Usually FastAPI/Uvicorn handle this, but being explicit can help
load_dotenv()
# -----------------------------------------

# --- Relative Imports --- 
try:
    from ragbase.chain import create_chain, get_session_history 
    from ragbase import ingest
    from ragbase.config import Config 
    from ragbase.retriever import create_retriever
    from ragbase.model import create_llm
    from ragbase.ingestor import load_processed_hashes, Ingestor
    from ragbase.ingest import COLLECTION_NAME # Import the constant
except ImportError:
    from .ragbase.chain import create_chain, get_session_history 
    from .ragbase import ingest
    from .ragbase.config import Config 
    from .ragbase.retriever import create_retriever
    from .ragbase.model import create_llm
    from .ragbase.ingestor import load_processed_hashes, Ingestor
    from .ragbase.ingest import COLLECTION_NAME # Import the constant
# ------------------------

# --- Remove Global Variables --- 
# weaviate_client: weaviate.Client | None = None 
chain_instance: Runnable | None = None 

# --- Add the missing get_weaviate_client function ---
def get_weaviate_client():
    """Dependency to get the Weaviate client from app.state."""
    from fastapi import Request
    
    async def get_client(request: Request):
        return request.app.state.weaviate_client
        
    return get_client
# ----------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
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
            
    yield # Application runs here
    
    # Shutdown
    client_to_close = getattr(app.state, 'weaviate_client', None)
    if client_to_close and hasattr(client_to_close, 'close'):
        print("Closing Weaviate client connection...")
        client_to_close.close()
        print("Weaviate client closed.")
    else:
        print("No Weaviate client found in app.state to close.")

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

# --- Globals / Shared Resources --- 
# Remove app_state = {"chain": None} - chain will be managed via get_rag_chain

# --- Remove client parameter, pass client to create_chain --- 
def get_rag_chain() -> Runnable | None: 
    """Initializes or retrieves the global RAG chain."""
    global chain_instance
    if chain_instance is None:
        print(f"Creating new global RAG chain (Mode: {'Local' if Config.USE_LOCAL_VECTOR_STORE else 'Remote'})...")
        llm = create_llm() # Create LLM

        # Initialize retriever and create chain
        retriever = None
        if Config.USE_LOCAL_VECTOR_STORE:
            try:
                # Create local FAISS retriever
                retriever = create_retriever(llm)
                print("Local FAISS retriever created successfully.")
            except Exception as e:
                print(f"WARNING: Could not create local retriever: {e}")
                return None
            
            # Create chain with the local retriever
            try:
                chain_instance = create_chain(llm=llm, retriever=retriever)
                print("Chain instance created successfully with local retriever.")
                return chain_instance
            except Exception as e:
                print(f"ERROR: Failed to create chain with local retriever: {e}")
                return None
        else:
            # For Weaviate mode, we'll initialize the chain in the chat endpoint 
            # where we have access to the client from app.state
            print("Remote mode detected. Chain will be initialized in the chat endpoint.")
            return None
    else:
        # Return existing chain instance
        return chain_instance

# --- Pydantic Models for Request/Response ---
class ChatRequest(BaseModel):
    session_id: str
    query: str

class ChatResponse(BaseModel):
    answer: str
    sources: list = []

class ProcessResponse(BaseModel):
    message: str
    indexed_files: list[str]

class ProcessRequest(BaseModel):
    session_id: str # Add session_id field

# --- API Endpoints ---

# Define allowed extensions
ALLOWED_EXTENSIONS = { ".pdf", ".docx", ".txt", ".md", ".xlsx", ".csv"} # Add/remove as needed

@app.post("/api/upload", status_code=200)
async def upload_documents(session_id: str = Form(...), files: list[UploadFile] = File(...)):
    """Endpoint to upload one or more documents for a specific session."""
    print(f"Received {len(files)} file(s) for upload in session: {session_id}")
    
    # --- Create session-specific upload directory --- 
    session_upload_dir = Config.Path.DOCUMENTS_DIR / session_id
    session_upload_dir.mkdir(parents=True, exist_ok=True)
    print(f"Ensured upload directory exists: {session_upload_dir}")
    # -------------------------------------------

    processed_filenames = [] # Keep track of successfully saved files

    for file in files:
        try:
            # Validate file extension
            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in ALLOWED_EXTENSIONS:
                print(f"Skipping file with unsupported extension: {file.filename}")
                continue # Skip this file

            safe_filename = Path(file.filename).name
            # --- Save to session-specific directory --- 
            file_path = session_upload_dir / safe_filename
            # -------------------------------------------
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            # uploaded_paths.append(file_path) # Store Path object - less critical now
            processed_filenames.append(safe_filename)
            print(f"Saved uploaded file to {file_path}")
        except Exception as e:
            print(f"Error saving file {file.filename} to {session_upload_dir}: {e}")
            traceback.print_exc()
        finally:
            # Ensure file handle is closed even if error occurs
            if file and not file.file.closed:
                 await file.close()

    if not processed_filenames:
        raise HTTPException(status_code=400, detail="No valid files were successfully saved.")

    return {"message": "Files processed for upload.", "filenames_saved": processed_filenames}

@app.post("/api/process")
async def process_documents(request: ProcessRequest, client: weaviate.Client = Depends(get_weaviate_client())):
    """Endpoint to trigger processing of uploaded documents for a specific session."""
    session_id = request.session_id # Get session_id from request body

    print(f"Received request to process documents for session: {session_id}")
    
    # --- Add Debug Logs --- 
    print(f"DEBUG /api/process: Session ID = {session_id}")
    print(f"DEBUG /api/process: Weaviate client obtained = {client is not None}")
    if not client and not Config.USE_LOCAL_VECTOR_STORE:
        print("ERROR /api/process: Weaviate client is None in non-local mode!")
        # Raise explicit error if client is missing in Weaviate mode
        raise HTTPException(status_code=503, detail="Weaviate client not available for processing.")
    # ---------------------

    try:
        # --- Add Debug Log before call --- 
        print(f"DEBUG /api/process: About to call ingest.process_files_for_session for {session_id}")
        # ---------------------------------
        result = ingest.process_files_for_session(
            session_id=session_id, 
            client=client # Pass the potentially None client (ingest handles None check for Weaviate mode)
        )
        # --- Add Debug Log after call --- 
        print(f"DEBUG /api/process: Call to ingest.process_files_for_session completed for {session_id}")
        print(f"DEBUG /api/process: Result = {result}")
        # --------------------------------
        
        # Check result and return appropriate response
        failed_count = len(result.get("failed_files", []))
        processed_count = result.get("processed_count", 0)
        skipped_count = result.get("skipped_count", 0)

        if failed_count > 0 and processed_count == 0 and skipped_count == 0:
             print(f"Processing failed significantly for session {session_id}. Result: {result}")
             return JSONResponse(status_code=500, content={"detail": result.get("message", "Processing failed for all files.")})
        
        print(f"Processing finished for session {session_id}. Result: {result}")
        return {"message": result.get("message", "Processing completed.")}
        
    except Exception as e:
        print(f"!!!!!!!! UNEXPECTED ERROR in /api/process endpoint for {session_id}: {e} !!!!!!!!")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error during processing endpoint: {e}")

@app.post("/api/chat")
async def chat_endpoint(request: Request, chat_req: ChatRequest):
    """Endpoint to handle chat questions with streaming, sources, and manual history update."""
    client: weaviate.Client | None = request.app.state.weaviate_client
    session_id = chat_req.session_id
    query = chat_req.query # Renamed from 'message' previously

    print(f"Chat request for session '{session_id}': Query='{query}' (Streaming, Manual History)")

    if not Config.USE_LOCAL_VECTOR_STORE and not client:
        raise HTTPException(status_code=503, detail="Weaviate client not available.")

    # Ensure tenant exists for this session
    if not Config.USE_LOCAL_VECTOR_STORE and client:
        try:
            collection_name = Config.Database.WEAVIATE_INDEX_NAME
            print(f"Checking if tenant '{session_id}' exists in collection '{collection_name}'")
            if client.collections.exists(collection_name):
                collection = client.collections.get(collection_name)
                tenants = collection.tenants.get()
                tenant_exists = any(
                    (hasattr(t, 'name') and t.name == session_id) or 
                    (isinstance(t, str) and t == session_id) or 
                    (isinstance(t, dict) and t.get('name') == session_id)
                    for t in tenants
                )
                if not tenant_exists:
                    print(f"Creating tenant '{session_id}' in collection '{collection_name}'")
                    collection.tenants.create(Tenant(name=session_id))
                    print(f"Tenant '{session_id}' created successfully")
                else:
                    print(f"Tenant '{session_id}' already exists")
            else:
                print(f"Collection '{collection_name}' does not exist yet")
        except Exception as e:
            print(f"Error checking/creating tenant: {e}")
            traceback.print_exc()

    try:
        global chain_instance
        current_chain = get_rag_chain()

        if current_chain is None and not Config.USE_LOCAL_VECTOR_STORE and client:
            llm = create_llm()
            chain_instance = create_chain(llm=llm, client=client)
            current_chain = chain_instance
            print("Chain initialized with Weaviate client in chat endpoint.")

        if current_chain is None:
            raise HTTPException(status_code=503, detail="Chat service not ready. Chain not initialized.")

        chain_input = {"question": query, "session_id": session_id}
        response_stream = current_chain.astream_events(chain_input, version="v1")

        async def generate_events_and_update_history():
            final_answer = ""
            source_documents = []
            user_message_added = False
            stream_started = False # Track if we've started receiving answer chunks
            
            try:
                async for event in response_stream:
                    kind = event["event"]
                    name = event.get("name", "")
                    tags = event.get("tags", [])
                    data = event.get("data", {})
                    
                    if not user_message_added:
                         history = get_session_history(session_id)
                         history.add_user_message(query)
                         user_message_added = True
                         print(f"History DEBUG: Added user message for session {session_id}")

                    print(f"DEBUG: Event received - Kind: {kind}, Name: {name}, Tags: {tags}")
                    
                    # --- Listen to the Parser stream for final output chunks --- 
                    if kind == "on_parser_stream" and name == "StrOutputParser":
                        chunk = data.get("chunk")
                        # Ensure chunk is a non-empty string
                        if isinstance(chunk, str) and chunk:
                            stream_started = True # Mark that we received answer data
                            print(f"DEBUG: Yielding answer chunk: {chunk}") # Add log here
                            yield f"data: {json.dumps({'type': 'answer_chunk', 'content': chunk})}\n\n"
                            final_answer += chunk
                    # ---------------------------------------------------------

                    # --- Capture final output (sources) at the end of the parallel step --- 
                    elif kind == "on_chain_end" and name == "RunnableParallel":
                         output = data.get("output")
                         if isinstance(output, dict):
                             # Final answer check (backup, less likely needed now)
                             if not stream_started and isinstance(output.get("answer"), str):
                                 final_answer_backup = output["answer"]
                                 if final_answer_backup and not final_answer: # Use backup only if stream was empty
                                     final_answer = final_answer_backup
                                     print(f"DEBUG: Yielding final answer from end event: {final_answer}")
                                     yield f"data: {json.dumps({'type': 'answer_chunk', 'content': final_answer})}\n\n"
                             
                             # Extract source documents
                             raw_docs = output.get("source_documents", [])
                             if raw_docs:
                                 source_documents = [
                                     { "source": doc.metadata.get("source", "Unknown"), 
                                       "page_content": doc.page_content[:200] + "..." if doc.page_content else "",
                                       "page": doc.metadata.get("page", "N/A")
                                     } 
                                     for doc in raw_docs if isinstance(doc, Document)
                                 ]
                                 print(f"DEBUG generate_events: Extracted {len(source_documents)} sources.")
                                 yield f"data: {json.dumps({'type': 'sources', 'content': source_documents})}\n\n"
                             else:
                                 print(f"DEBUG generate_events: No source documents found in output.")
                    # --------------------------------------------------------------------
            
            except Exception as e:
                print(f"Error processing event stream: {e}")
                traceback.print_exc()
                yield f"data: {json.dumps({'type': 'error', 'content': f'Error: {str(e)}'})}\n\n"
            
            finally:
                # Manual History Update
                if final_answer:
                    history = get_session_history(session_id)
                    if not history.messages or history.messages[-1].type != 'ai' or history.messages[-1].content != final_answer:
                       history.add_ai_message(final_answer)
                       print(f"History DEBUG: Added AI message for session {session_id}")
                    else:
                       print(f"History DEBUG: AI message likely already added for session {session_id}")

                # Send final end event
                print(f"DEBUG generate_events: Final Answer: {final_answer[:100]}...")
                yield f"data: {json.dumps({'type': 'end', 'content': 'Stream finished'})}\n\n"

        return StreamingResponse(
            generate_events_and_update_history(), 
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
        )

    except Exception as e:
        print(f"Error during chat processing for session '{session_id}': {e}")
        traceback.print_exc()
        async def error_stream():
            error_message = f"An error occurred: {str(e)}"
            yield f"data: {json.dumps({'type': 'error', 'content': error_message})}\n\n"
            yield f"data: {json.dumps({'type': 'end', 'content': 'Stream finished due to error'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream", status_code=500)

# --- Revert uvicorn run call for direct script execution --- 
if __name__ == "__main__":
    # This allows running 'python backend/api.py' from the backend directory
    uvicorn.run("api:app", host="0.0.0.0", port=8088, reload=True)
