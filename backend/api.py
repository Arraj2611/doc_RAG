"""
Main FastAPI application for the docRAG API.
This module handles API routes, lifespan management (DB/client connections), and startup.
"""
import logging
import uvicorn
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --- Logging Configuration --- 
# Configure logging early, before other imports if possible
log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
log_level = getattr(logging, log_level_str, logging.INFO)

logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
# Silence overly verbose libraries
logging.getLogger("uvicorn.error").propagate = False
logging.getLogger("uvicorn.access").propagate = False
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)
logger.info(f"Logging configured with level: {log_level_str}")
# --- End Logging Configuration --- 

# Import routes AFTER logging is configured
from routes.auth import router as auth_router
from routes.documents import router as documents_router
from routes.chat import router as chat_router
from routes.preferences import router as preferences_router

# Import config and lifespan functions
from ragbase.config import Config
from ragbase.weaviate_client import setup_weaviate_client, close_weaviate_client
from db import init_mongodb, close_mongodb # Import DB init/close

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application lifespan events:
    - Initialize MongoDB connection.
    - Initialize Weaviate client (if not in local mode).
    - Clean up connections on shutdown.
    """
    logger.info("Application startup: Initializing resources...")
    
    # --- Initialize MongoDB --- 
    try:
        mongo_client = await init_mongodb()
        # Storing client in app.state might be useful if needed directly
        # app.state.mongo_client = mongo_client 
        logger.info("MongoDB connection initialized successfully.")
    except Exception as mongo_err:
        logger.critical(f"CRITICAL: Failed to initialize MongoDB: {mongo_err}", exc_info=True)
        # Decide whether to exit application or continue with limited functionality
        raise RuntimeError("MongoDB initialization failed") from mongo_err

    # --- Initialize Weaviate client (if needed) --- 
    app.state.weaviate_client = None # Ensure attribute exists
    if not Config.USE_LOCAL_VECTOR_STORE:
        logger.info("Remote mode: Initializing Weaviate client...")
        try:
            app.state.weaviate_client = await setup_weaviate_client()
            if app.state.weaviate_client:
                 logger.info("Weaviate client initialized and stored in app.state.")
            else:
                 # setup_weaviate_client logs errors internally, but we add a critical log here
                 logger.critical("CRITICAL: Weaviate client initialization returned None! Remote vector store functionality will fail.")
                 # Optionally raise error to prevent startup with failed essential component
                 # raise RuntimeError("Failed to initialize Weaviate client")
        except Exception as wv_err:
            logger.critical(f"CRITICAL: Unhandled exception during Weaviate client setup: {wv_err}", exc_info=True)
            # Optionally raise error
            # raise RuntimeError("Weaviate client initialization failed") from wv_err
    else:
        logger.info("Local mode: Skipping Weaviate client initialization.")
            
    # --- Application is ready to run --- 
    logger.info("Resource initialization complete. Application starting.")
    yield 
    # Application runs here until shutdown signal
    
    # --- Cleanup on shutdown --- 
    logger.info("Application shutdown sequence initiated...")
    # Shutdown Weaviate Client
    weaviate_client_to_close = getattr(app.state, 'weaviate_client', None)
    if weaviate_client_to_close:
        logger.info("Closing Weaviate client connection...")
        await close_weaviate_client(weaviate_client_to_close)
    else:
        logger.info("No active Weaviate client in app state to close.")
        
    # Shutdown MongoDB Connection
    logger.info("Closing MongoDB connection...")
    await close_mongodb()
    logger.info("Resource cleanup complete. Application shutdown finished.")

# Initialize FastAPI app with lifespan manager
app = FastAPI(
    title="docRAG API",
    description="API for interacting with the RAG document chatbot",
    version="0.1.0",
    lifespan=lifespan
)

# CORS configuration
# Read allowed origins from env var, defaulting to typical local dev ports
allowed_origins_str = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5000")
try:
    origins = [origin.strip() for origin in allowed_origins_str.split(',') if origin.strip()]
    if not origins:
        raise ValueError("Parsed CORS_ALLOWED_ORIGINS is empty.")
except Exception as e:
    logger.warning(f"Failed to parse CORS_ALLOWED_ORIGINS ('{allowed_origins_str}'): {e}. Defaulting to permissive local setup.")
    # Fallback to a permissive default for local dev if parsing fails
    origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5000"]

logger.info(f"Configuring CORS middleware for origins: {origins}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    # Consider restricting headers more in production
    allow_headers=["Content-Type", "Authorization", "X-Session-ID", "*"], 
    expose_headers=["Content-Type", "Authorization", "Content-Length"],
    max_age=3600 # Cache preflight requests for 1 hour
)

# Include API routers
app.include_router(auth_router, prefix="/api", tags=["Authentication"])
app.include_router(documents_router, prefix="/api/documents", tags=["Documents"])
app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])
app.include_router(preferences_router, prefix="/api/preferences", tags=["Preferences"])

@app.get("/", tags=["Status"])
async def read_root():
    """Root endpoint for basic API status check."""
    return {"status": "docRAG API is running"}

if __name__ == "__main__":
    # Load host and port from environment or use defaults
    api_host = os.getenv("API_HOST", "127.0.0.1")
    api_port = int(os.getenv("API_PORT", 8000))
    # Enable reload only if APP_MODE is explicitly set to 'development'
    reload_flag = Config.APP_MODE.lower() == "development"
    
    log_level_str = os.getenv("LOG_LEVEL", "info").lower()
    
    logger.info(f"Starting Uvicorn server on http://{api_host}:{api_port}")
    logger.info(f"Application Mode: {Config.APP_MODE} (Reload={reload_flag})" )
    logger.info(f"Vector Store Mode: {'Local FAISS' if Config.USE_LOCAL_VECTOR_STORE else 'Remote Weaviate'}")
    logger.info(f"LLM Provider: {Config.MODEL_PROVIDER}")

    uvicorn.run(
        "api:app", 
        host=api_host, 
        port=api_port, 
        reload=reload_flag,
        log_level=log_level_str # Pass uvicorn's log level string
    )
