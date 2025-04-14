from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Request, BackgroundTasks, Depends
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

# --- Relative Imports --- 
try:
    from ragbase.chain import create_chain, get_session_history 
    from ragbase import ingest
    from ragbase.config import Config 
    from ragbase.retriever import create_retriever
    from ragbase.model import create_llm
    from ragbase.ingestor import load_processed_hashes, Ingestor
except ImportError:
    from .ragbase.chain import create_chain, get_session_history 
    from .ragbase import ingest
    from .ragbase.config import Config 
    from .ragbase.retriever import create_retriever
    from .ragbase.model import create_llm
    from .ragbase.ingestor import load_processed_hashes, Ingestor
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
    # Use app.state for client
    app.state.weaviate_client = None 
    if not Config.USE_LOCAL_VECTOR_STORE:
        print("Initializing Weaviate client at application startup (Remote Mode)...")
        if not Config.Database.WEAVIATE_URL or not Config.Database.WEAVIATE_API_KEY:
            print("ERROR: WEAVIATE_URL and WEAVIATE_API_KEY must be set for Weaviate mode.")
        else:
            try:
                # --- Use Weaviate v4 client API ---
                client_instance = weaviate.connect_to_wcs(
                    cluster_url=Config.Database.WEAVIATE_URL,
                    auth_credentials=Auth.api_key(Config.Database.WEAVIATE_API_KEY),
                )
                print("Weaviate client connected and ready.")
                app.state.weaviate_client = client_instance
                # ---------------------------
                
                # --- Schema Check / Update logic using v4 API ---
                collection_name = Config.Database.WEAVIATE_INDEX_NAME
                text_key = Config.Database.WEAVIATE_TEXT_KEY
                
                # Check if collection exists
                if not client_instance.collections.exists(collection_name):
                    print(f"Weaviate collection '{collection_name}' not found. Creating with Multi-Tenancy enabled...")
                    
                    # Create collection with v4 API
                    client_instance.collections.create(
                        name=collection_name,
                        description="Stores document chunks for RAG (Multi-Tenant)",
                        properties=[
                            Property(name=text_key, data_type=DataType.TEXT, description="Content chunk"),
                            Property(name="source", data_type=DataType.TEXT, description="Document source filename"),
                            Property(name="page", data_type=DataType.INT, description="Page number"),
                            Property(name="doc_type", data_type=DataType.TEXT, description="Document type"),
                            Property(name="element_index", data_type=DataType.INT, description="Index of element on page"),
                            Property(name="doc_hash", data_type=DataType.TEXT, description="Hash of the original document"),
                        ],
                        vectorizer_config=Configure.Vectorizer.none(),
                        multi_tenancy_config=Configure.multi_tenancy(
                            enabled=True,
                            auto_tenant_creation=True
                        )
                    )
                    print(f"Weaviate collection '{collection_name}' created successfully.")
                else:
                    print(f"Weaviate collection '{collection_name}' already exists.")
                    # Check if multi-tenancy is enabled
                    try:
                        collection = client_instance.collections.get(collection_name)
                        config = collection.config.get()
                        
                        if not config.multi_tenancy_config.enabled:
                            print(f"Multi-tenancy is not enabled on existing collection '{collection_name}'. Manual intervention might be needed if data exists.")
                        elif not config.multi_tenancy_config.auto_tenant_creation:
                            print(f"Attempting to enable auto-tenant creation on existing MT collection '{collection_name}'...")
                            collection.config.update(
                                multi_tenancy_config=Reconfigure.multi_tenancy(auto_tenant_creation=True)
                            )
                            print(f"Auto-tenant creation enabled.")
                    except Exception as config_e:
                        print(f"ERROR checking config for collection '{collection_name}': {config_e}")
                # --- End Schema Check / Update ---
            except Exception as e:
                print(f"ERROR during Weaviate connection or schema creation: {e}")
                traceback.print_exc()
                app.state.weaviate_client = None # Ensure state is None on failure
    else:
        print("Running in LOCAL vector store mode. Weaviate client not initialized.")
        app.state.weaviate_client = None
            
    yield # Application runs here
    
    # Shutdown: Close Weaviate Client from app.state
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
async def upload_documents(files: list[UploadFile] = File(...)):
    """Endpoint to upload one or more documents."""
    print(f"Received {len(files)} file(s) for upload.")
    uploaded_paths = []
    temp_dir = Config.Path.DOCUMENTS_DIR
    temp_dir.mkdir(parents=True, exist_ok=True)
    processed_filenames = [] # Keep track of successfully saved files

    for file in files:
        try:
            # Validate file extension
            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in ALLOWED_EXTENSIONS:
                print(f"Skipping file with unsupported extension: {file.filename}")
                continue # Skip this file

            safe_filename = Path(file.filename).name
            file_path = temp_dir / safe_filename
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            uploaded_paths.append(file_path) # Store Path object
            processed_filenames.append(safe_filename)
            print(f"Saved uploaded file: {safe_filename}")
        except Exception as e:
            print(f"Error saving file {file.filename}: {e}")
            # Don't raise immediately, allow other files to process
        finally:
            await file.close()

    if not processed_filenames:
        raise HTTPException(status_code=400, detail="No valid files were successfully saved.")

    # Return list of saved filenames (or paths if needed by frontend)
    return {"message": "Files processed for upload.", "filenames_saved": processed_filenames}

@app.post("/api/process")
async def process_documents(request: ProcessRequest, client: weaviate.Client = Depends(get_weaviate_client())):
    """Endpoint to trigger processing of uploaded documents for a specific session."""
    session_id = request.session_id # Get session_id from request body

    print(f"Received request to process documents for session: {session_id}")

    # Get list of files in the temporary upload directory
    upload_dir = Config.Path.DOCUMENTS_DIR
    if not upload_dir.exists():
        return {"message": "No documents found to process."}

    uploaded_files = [f for f in upload_dir.iterdir() if f.is_file()]
    if not uploaded_files:
        return {"message": "No documents found in the upload directory."}

    processed_files_count = 0
    processed_chunks_count = 0
    errors = []

    # Load processed hashes
    processed_hashes = load_processed_hashes(Config.Path.PROCESSED_HASHES_FILE)

    # Create Ingestor instance 
    # If using local vector store, create it here (needs update for local session handling)
    # Otherwise, use the shared client passed via lifespan
    if Config.USE_LOCAL_VECTOR_STORE:
         # TODO: Update local vector store logic if needed to handle sessions
         errors.append("Local vector store session handling not implemented yet.")
         ingestor = Ingestor() # Placeholder
    elif client: 
         ingestor = Ingestor(client=client) # Use shared client
    else:
        raise HTTPException(status_code=503, detail="Weaviate client not available for processing.")

    try:
        result = ingest.process_files_for_session(
            session_id=session_id, 
            client=client
        )
        
        # Check result and return appropriate response
        failed_count = len(result.get("failed_files", []))
        processed_count = result.get("processed_count", 0)
        skipped_count = result.get("skipped_count", 0)

        # If collection creation failed (handled inside process_files_for_session raising exception) 
        # or if all attempts failed and nothing was skipped, return 500
        if failed_count > 0 and processed_count == 0 and skipped_count == 0:
             print(f"Processing failed significantly for session {session_id}. Result: {result}")
             # Use 500 for server-side processing failure
             return JSONResponse(status_code=500, content={"detail": result.get("message", "Processing failed for all files.")})
        
        # Otherwise return 200 OK with the summary message
        print(f"Processing finished for session {session_id}. Result: {result}")
        return {"message": result.get("message", "Processing completed.")}
        
    except Exception as e:
        # Catch unexpected errors during the process call itself (e.g., collection creation failure)
        print(f"!!!!!!!! UNEXPECTED ERROR during process_files_for_session call for {session_id}: {e} !!!!!!!!")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error during processing: {e}")

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
            
            # Get tenants for the collection (v4 API)
            if client.collections.exists(collection_name):
                collection = client.collections.get(collection_name)
                
                # Get all tenants and check if our tenant exists
                tenants = collection.tenants.get()
                
                # Check if tenant exists - handle both string and object formats
                tenant_exists = False
                for tenant in tenants:
                    # If tenant is an object with name attribute
                    if hasattr(tenant, 'name') and tenant.name == session_id:
                        tenant_exists = True
                        break
                    # If tenant is a string
                    elif isinstance(tenant, str) and tenant == session_id:
                        tenant_exists = True
                        break
                    # If tenant is a dict with name key
                    elif isinstance(tenant, dict) and tenant.get('name') == session_id:
                        tenant_exists = True
                        break
                
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
            traceback.print_exc()  # Add traceback for better debugging
            # Continue anyway, as the query might still work

    try:
        # Get the chain or initialize it if needed
        global chain_instance
        current_chain = get_rag_chain()

        # If using remote mode and chain not initialized, create it here with the client
        if current_chain is None and not Config.USE_LOCAL_VECTOR_STORE and client:
            llm = create_llm()
            chain_instance = create_chain(llm=llm, client=client)
            current_chain = chain_instance
            print("Chain initialized with Weaviate client in chat endpoint.")

        if current_chain is None:
            raise HTTPException(status_code=503, detail="Chat service not ready. Chain not initialized.")

        # Prepare input for the chain
        chain_input = {
            "question": query,
            "session_id": session_id
        }

        # Use astream_events for streaming
        response_stream = current_chain.astream_events(
            chain_input, # Pass input dict containing session_id
            # config={"configurable": {"session_id": session_id}}, # Config no longer needed for history
            version="v1" # Use v1 event stream for structured events
        )

        # Async generator to process events and update history
        async def generate_events_and_update_history():
            final_answer = ""
            source_documents = []
            user_message_added = False # Flag to ensure user message is added only once
            
            try:
                async for event in response_stream:
                    kind = event["event"]
                    name = event.get("name", "") # Get the name of the runnable
                    tags = event.get("tags", []) # Get tags if available
                    
                    # Add user message to history store the first time we get an event
                    if not user_message_added:
                         history = get_session_history(session_id)
                         history.add_user_message(query)
                         user_message_added = True
                         print(f"History DEBUG: Added user message for session {session_id}")

                    print(f"DEBUG: Event received - Kind: {kind}, Name: {name}, Tags: {tags}")
                    
                    # Capture answer chunks
                    if kind == "on_chain_stream" and name == "StrOutputParser":
                        chunk_data = event.get("data", {}).get("chunk")
                        if isinstance(chunk_data, str): # Check if chunk is a string (from StrOutputParser)
                           content = chunk_data
                           yield f"data: {json.dumps({'type': 'answer_chunk', 'content': content})}\n\n"
                           final_answer += content
                    
                    # Capture the final source documents at the end of the main chain
                    elif kind == "on_chain_end" and name == "RunnableParallel":
                         output = event.get("data", {}).get("output")
                         if isinstance(output, dict):
                             # Final answer might be here if not fully streamed
                             if not final_answer and isinstance(output.get("answer"), str):
                                 final_answer = output["answer"]
                                 # Send the full answer if streaming missed chunks
                                 yield f"data: {json.dumps({'type': 'answer_chunk', 'content': final_answer})}\n\n"
                             
                             # Extract source documents
                             raw_docs = output.get("source_documents", [])
                             if raw_docs:
                                 source_documents = [
                                     { "source": doc.metadata.get("source", "Unknown"), 
                                       "page_content": doc.page_content[:200] + "..." if doc.page_content else "", # Truncate preview
                                       "page": doc.metadata.get("page", "N/A")
                                     } 
                                     for doc in raw_docs if isinstance(doc, Document)
                                 ]
                                 print(f"DEBUG generate_events: Extracted {len(source_documents)} sources.")
                                 # Send sources immediately
                                 yield f"data: {json.dumps({'type': 'sources', 'content': source_documents})}\n\n"
                             else:
                                 print(f"DEBUG generate_events: No source documents found in output.")
            except Exception as e:
                print(f"Error processing event stream: {e}")
                traceback.print_exc()
                # Send error event
                yield f"data: {json.dumps({'type': 'error', 'content': f'Error: {str(e)}'})}\n\n"
            
            finally:
                # --- Manual History Update --- 
                if final_answer: # Only add if we got an answer
                    history = get_session_history(session_id)
                    if not history.messages or history.messages[-1].type != 'ai' or history.messages[-1].content != final_answer:
                       history.add_ai_message(final_answer)
                       print(f"History DEBUG: Added AI message for session {session_id}")
                    else:
                       print(f"History DEBUG: AI message likely already added for session {session_id}")
                # ----------------------------

                # Send final events (sources were sent earlier)
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
        # Send an error event over SSE if possible
        async def error_stream():
            error_message = f"An error occurred: {str(e)}"
            yield f"data: {json.dumps({'type': 'error', 'content': error_message})}\n\n"
            yield f"data: {json.dumps({'type': 'end', 'content': 'Stream finished due to error'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream", status_code=500)

# --- Revert uvicorn run call for direct script execution --- 
if __name__ == "__main__":
    # This allows running 'python backend/api.py' from the backend directory
    uvicorn.run("api:app", host="0.0.0.0", port=8088, reload=True)
