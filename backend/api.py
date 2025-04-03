from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import shutil
from pathlib import Path
import traceback
import asyncio
from typing import List, Dict, Optional, Any
from contextlib import asynccontextmanager
import weaviate
from weaviate.classes.init import Auth
from weaviate.classes.config import Property, DataType, Configure, Reconfigure
from weaviate.classes.query import Filter
from weaviate.collections.classes.tenants import Tenant
from langchain_core.runnables import Runnable
import json
from fastapi.responses import StreamingResponse

# Assuming your ragbase modules are importable from here
# (Adjust imports if your structure differs or run from workspace root)
from ragbase.config import Config
from ragbase.model import create_llm
from ragbase.retriever import create_retriever
from ragbase.chain import create_chain
from ragbase.ingestor import Ingestor

# --- Global Variables --- 
# Weaviate client might be None if using local store
weaviate_client: weaviate.Client | None = None 
chain_instance: Runnable | None = None # Single global chain instance

@asynccontextmanager
async def lifespan(app: FastAPI):
    global weaviate_client
    if not Config.USE_LOCAL_VECTOR_STORE:
        # --- Weaviate Client Lifespan Management (Conditional) ---
        print("Initializing Weaviate client at application startup (Remote Mode)...")
        if not Config.Database.WEAVIATE_URL or not Config.Database.WEAVIATE_API_KEY:
            print("ERROR: WEAVIATE_URL and WEAVIATE_API_KEY must be set for Weaviate mode.")
            app.state.weaviate_client = None # Keep state consistent
        else:
            try:
                weaviate_client = weaviate.connect_to_weaviate_cloud(
                    cluster_url=Config.Database.WEAVIATE_URL,
                    auth_credentials=Auth.api_key(Config.Database.WEAVIATE_API_KEY),
                )
                weaviate_client.is_ready()
                print("Weaviate client connected and ready.")
                app.state.weaviate_client = weaviate_client
                # --- Schema Check (Weaviate only) --- 
                collection_name = Config.Database.WEAVIATE_INDEX_NAME
                if not weaviate_client.collections.exists(collection_name):
                    print(f"Weaviate collection '{collection_name}' not found. Creating with text2vec-weaviate...")
                    weaviate_client.collections.create(
                        name=collection_name,
                        description="Stores document chunks for RAG",
                        vectorizer_config=[
                            Configure.NamedVectors.text2vec_weaviate(
                                name="default",
                                source_properties=[Config.Database.WEAVIATE_TEXT_KEY],
                                model=Config.Model.WEAVIATE_EMBEDDING_MODEL
                            )
                        ],
                        properties=[
                            Property(name=Config.Database.WEAVIATE_TEXT_KEY, data_type=DataType.TEXT),
                            Property(name="source", data_type=DataType.TEXT),
                            Property(name="page", data_type=DataType.INT),
                            Property(name="doc_type", data_type=DataType.TEXT),
                            Property(name="element_index", data_type=DataType.INT),
                            Property(name="file_hash", data_type=DataType.TEXT),
                        ],
                    )
                    print(f"Weaviate collection '{collection_name}' created successfully.")
                else:
                    print(f"Weaviate collection '{collection_name}' already exists.")
                # --- End Schema Check --- 
            except Exception as e:
                print(f"ERROR during Weaviate connection or schema creation: {e}")
                traceback.print_exc()
                app.state.weaviate_client = None
    else:
        print("Running in LOCAL vector store mode (FAISS/Ollama). Weaviate client not initialized.")
        app.state.weaviate_client = None # Ensure state is None
            
    yield # Application runs here
    
    # Shutdown: Close Weaviate Client if it was created
    if weaviate_client is not None and hasattr(weaviate_client, 'close'):
        print("Closing Weaviate client...")
        weaviate_client.close()
        print("Weaviate client closed.")
        app.state.weaviate_client = None

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

# Modify get_rag_chain to accept client (if needed) or get from app.state
def get_rag_chain(client: weaviate.Client | None) -> Runnable | None: # Client is optional
    """Initializes or retrieves the global RAG chain using the appropriate retriever."""
    global chain_instance
    if chain_instance is None:
        print(f"Creating new global RAG chain (Mode: {'Local' if Config.USE_LOCAL_VECTOR_STORE else 'Remote'})...")
        llm = create_llm()
        # Pass client to create_retriever (it expects it, even if it returns None in Weaviate mode)
        retriever = create_retriever(llm=llm, client=client) 
        # Pass client to create_chain
        chain_instance = create_chain(llm=llm, retriever=retriever, client=client)
        print(f"Global RAG chain created.")
    else:
        print(f"Using cached global RAG chain.")
        
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
async def process_documents(request: Request):
    # Get client from state (might be None)
    client: weaviate.Client | None = request.app.state.weaviate_client
    print(f"Processing documents (Mode: {'Local' if Config.USE_LOCAL_VECTOR_STORE else 'Remote'})...")

    upload_dir = Path(Config.Path.DOCUMENTS_DIR)
    uploaded_files_paths = [p for p in upload_dir.iterdir() if p.is_file()]

    if not uploaded_files_paths:
        raise HTTPException(status_code=400, detail="No files found to process.")

    try:
        # Initialize Ingestor, passing client only if not local
        ingestor = Ingestor(client=None if Config.USE_LOCAL_VECTOR_STORE else client)
        success = ingestor.ingest(doc_paths=uploaded_files_paths)
        
        if success:
            processed_filenames = [p.name for p in uploaded_files_paths] # Get filenames for response
            # Optionally clear the tmp dir after successful ingestion
            print(f"Cleaning up {len(uploaded_files_paths)} processed files from {upload_dir}...")
            for p in uploaded_files_paths: 
                try:
                    p.unlink()
                    print(f"Cleaned up: {p.name}")
                except Exception as e:
                    print(f"Warning: Could not delete temp file {p.name}: {e}")
            # Re-initialize the global chain (pass client which might be None)
            get_rag_chain(client)
            return {"message": f"Documents processed and ingested successfully.", "processed_files": processed_filenames}
        else:
            raise HTTPException(status_code=500, detail=f"Failed to ingest documents. Check logs.")
    except Exception as e:
        # Log the exception for debugging
        print(f"ERROR during ingestion: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An error occurred during document processing: {e}")

@app.post("/api/chat")
async def chat_endpoint(request: Request, chat_req: ChatRequest):
    """Endpoint to handle chat questions with streaming and sources."""
    client: weaviate.Client | None = request.app.state.weaviate_client 
    session_id = chat_req.session_id 
    query = chat_req.query
    
    print(f"Chat request for session '{session_id}': Query='{query}' (Streaming)")

    if not Config.USE_LOCAL_VECTOR_STORE and not client:
        raise HTTPException(status_code=503, detail="Weaviate client not available.")

    try:
        current_chain = get_rag_chain(client=client)

        if current_chain is None:
             raise HTTPException(status_code=503, detail="Chat service not ready. Chain not initialized.")

        # Revert to using astream_events for streaming
        response_stream = current_chain.astream_events(
            {"question": query}, 
            config={"configurable": {"session_id": session_id}},
            version="v1" # Use v1 event stream for structured events
        )
        
        # Restore the async generator to process events
        async def generate_events():
            final_answer = ""
            source_documents = [] 
            try:
                async for event in response_stream: 
                    kind = event["event"]
                    name = event.get("name", "") # Get the name of the runnable
                    
                    # Stream answer chunks from the LLM
                    if kind == "on_chat_model_stream":
                        content = event.get("data", {}).get("chunk", {}).content
                        if content:
                            yield f"data: {json.dumps({'type': 'answer_chunk', 'content': content})}\n\n"
                            final_answer += content
                    
                    # Capture source documents when the core RAG chain finishes
                    elif kind == "on_chain_end" and name == "core_rag_chain": 
                        # Extract from the final output of the core chain
                        output = event.get("data", {}).get("output", {})
                        if isinstance(output, dict):
                            docs = output.get("source_documents", [])
                            if docs and not source_documents: # Capture only once
                                source_documents = docs
                                source_data_to_send = [
                                    {
                                        "content": doc.page_content, 
                                        "metadata": doc.metadata
                                    } for doc in source_documents
                                ]
                                print(f"DEBUG generate_events: Captured {len(source_documents)} sources from core_rag_chain output.")
                                yield f"data: {json.dumps({'type': 'sources', 'content': source_data_to_send})}\n\n"
            finally:
                # Send final answer and end stream
                print(f"DEBUG generate_events: Final Answer: {final_answer}")
                yield f"data: {json.dumps({'type': 'final_answer', 'content': final_answer})}\n\n"
                yield f"data: {json.dumps({'type': 'end', 'content': 'Stream finished'})}\n\n"

        return StreamingResponse(generate_events(), media_type="text/event-stream")

    except Exception as e:
        print(f"Error during chat processing for session '{session_id}': {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An error occurred: {e}")

# --- Run Server (for local development) ---
if __name__ == "__main__":
    # Ensure only necessary directories exist
    Config.Path.DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)

    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
    # Use reload=True for development, remove for production
    # Note: For production, use a proper ASGI server like Gunicorn with Uvicorn workers
