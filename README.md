# DocRAG: Intelligent Document Q&A Chatbot

**Ask questions about your documents and get intelligent, context-aware answers.**

DocRAG is a sophisticated Retrieval-Augmented Generation (RAG) application designed for interactive Q&A with your document library. Upload your files (PDFs, DOCX, Images), and DocRAG processes them, enabling you to chat directly about their content. It leverages state-of-the-art language models and vector databases to provide accurate, source-backed answers with a seamless user experience.

Built with a modern stack, it features a **React frontend** (`frontend/DocumentIntelligence/client/`), a **Python/FastAPI backend** (`backend/`) for core document processing, RAG, and data persistence, and a **Node.js/Express backend** (`frontend/DocumentIntelligence/server/`) acting as a Backend-for-Frontend (BFF) managing authentication and UI-specific interactions. A **Streamlit demo application** (`backend/app.py`) is also included.

---

## ✨ Features

* **📄 Multi-Format Document Upload:** Easily upload PDFs, DOCX, and common image formats (PNG, JPG).
* **🧠 Intelligent Processing:** Utilizes the `Unstructured` library for robust document and image parsing/chunking.
* **⚡ Flexible Vector Storage:** Supports **Weaviate Cloud** or local **FAISS** (configurable via `.env`) for efficient semantic search.
* **💬 Conversational Interface:** Engage in natural language conversations about your documents.
* **🧾 Source Tracking:** Displays the specific document chunks used to generate each answer, ensuring transparency.
* **💨 Real-time Responses:** Enjoy streaming responses directly from the Language Model (LLM).
* **🚀 Choice of LLMs:** Supports Ollama models and potentially Groq for high-speed inference (configurable via `.env`).
* **👤 User Management & Authentication:** Handled by the Node.js BFF.
* **📚 Chat History & Insights:** Stores and retrieves past conversations and user-generated insights via MongoDB (Python backend).
* **📊 Simple Demo UI:** Includes a standalone Streamlit application (`backend/app.py`) for quick testing and demonstration (defaults to local FAISS).

---

## 🏗️ Architecture

* **Frontend Client:** React (`frontend/DocumentIntelligence/client/`)
  * Routing: Wouter
  * Data Fetching/Caching: TanStack Query
  * State Management: React Context API
  * Styling: Tailwind CSS
* **Frontend Server (BFF):** Node.js / Express (`frontend/DocumentIntelligence/server/`)
  * Handles user authentication.
  * Serves the React client application.
  * Potentially proxies requests to the Python backend.
  * May manage some UI-related state (uses MongoDB with potential fallback).
* **Core Backend:** Python / FastAPI (`backend/`)
  * **RAG Logic:** LangChain (`backend/ragbase/`)
  * **API:** FastAPI (`backend/api.py`) exposing endpoints for upload, processing, chat, history, insights, etc.
  * **Vector Store:** Weaviate Cloud / FAISS (configurable)
  * **Database:** MongoDB (`backend/database/mongo_handler.py`) for chat history, document metadata, user insights, user registration data.
  * **LLM Integration:** Ollama / Groq (`backend/ragbase/model.py`)
  * **Document Processing:** `unstructured` (`backend/ragbase/ingest.py`, `backend/ragbase/ingestor.py`)
* **Demo UI:** Streamlit (`backend/app.py`)
  * Provides a self-contained interface for upload/process/chat.
  * Uses the same core RAG logic from `backend/ragbase/`.

---

## 🌳 Directory Structure

```text
.
├── backend/
│   ├── api.py             # FastAPI application entry point
│   ├── app.py             # Streamlit demo application entry point
│   │   └── mongo_handler.py # MongoDB interaction logic
│   ├── ragbase/           # Core RAG pipeline components
│   │   ├── chain.py       # Langchain RAG chain definition
│   │   ├── config.py      # Backend configuration
│   │   ├── ingest.py      # Document ingestion script/module
│   │   ├── ingestor.py    # Document parsing/chunking logic
│   │   ├── model.py       # LLM integration (Ollama, Groq)
│   │   ├── retriever.py   # Vector store retrieval logic (Weaviate/FAISS)
│   │   └── ...            # Other RAG utilities
│   ├── tmp/               # Temporary file storage (e.g., uploads)
│   ├── .env               # Backend environment variables (sensitive config)
│   ├── requirements.txt   # Python dependencies
│   └── ...
├── frontend/
│   └── DocumentIntelligence/
│       ├── client/          # React frontend application
│       │   ├── src/         # Client source code (components, pages, hooks, context)
│       │   ├── public/      # Static assets
│       │   ├── .env         # Frontend environment variables (API URLs)
│       │   ├── package.json # Client dependencies
│       │   └── vite.config.ts # Vite configuration for client
│       ├── server/          # Node.js Express BFF (Backend-for-Frontend)
│       │   ├── index.ts     # BFF entry point
│       │   ├── routes.ts    # BFF API routes
│       │   ├── database.ts  # BFF database connection (MongoDB)
│       │   ├── auth.ts      # BFF authentication logic
│       │   ├── .env         # BFF environment variables (DB connection, JWT secret)
│       │   └── package.json # BFF dependencies
│       ├── shared/          # Shared TypeScript types/schemas (potentially)
│       └── package.json     # Root frontend package.json (if using workspaces)
├── .gitignore             # Git ignore rules
├── LICENSE                # Project License
└── README.md              # This file
```

---

## 🚀 Getting Started

### Prerequisites

* Node.js and npm (or yarn)
* Python 3.9+ and pip
* Access to a MongoDB instance (required by both Python backend and Node.js BFF)
* **If using Weaviate:**
  * Access to a Weaviate Cloud instance or a local Weaviate deployment.
  * Weaviate URL and API Key.
* **If using Ollama:**
  * Locally running Ollama instance.
* **If using Groq:**
  * Groq API Key.

### Setup

1. **Clone the Repository:**

    ```bash
    git clone <your-repository-url>
    cd <your-repository-name>
    ```

2. **Configure Core Backend (Python/FastAPI):**
    * Navigate to the Python backend directory:

        ```bash
        cd backend
        ```

    * Create a virtual environment (recommended):

        ```bash
        python -m venv venv
        source venv/bin/activate # Linux/macOS
        # .\\venv\\Scripts\\activate # Windows
        ```

    * Install Python dependencies:

        ```bash
        pip install -r requirements.txt
        ```

    * Create a `.env` file in the `backend` directory by copying/renaming `.env.example` (if it exists) or creating it manually. Populate it with your credentials:

        ```dotenv
        # --- Vector Store Configuration ---
        # Set USE_LOCAL_VECTOR_STORE=True to use local FAISS, False for Weaviate
        USE_LOCAL_VECTOR_STORE=False

        # --- Weaviate (Required if USE_LOCAL_VECTOR_STORE=False) ---
        WEAVIATE_URL=your_weaviate_cloud_or_local_url
        WEAVIATE_API_KEY=your_weaviate_api_key # May not be needed for local unauthenticated instances

        # --- LLM Configuration ---
        # Set USE_OLLAMA=True to use Ollama, False for Groq
        USE_OLLAMA=True
        OLLAMA_MODEL=llama3 # Example Ollama model
        OLLAMA_BASE_URL=http://localhost:11434 # Adjust if needed

        # --- Groq (Required if USE_OLLAMA=False) ---
        GROQ_API_KEY=your_groq_api_key
        GROQ_MODEL_NAME=llama3-8b-8192 # Example Groq model

        # --- Database ---
        MONGO_URI=mongodb://localhost:27017/ # Your MongoDB connection string
        MONGO_DB_NAME=doc_rag_db # Your desired database name

        # --- FastAPI Server ---
        FASTAPI_HOST=0.0.0.0
        FASTAPI_PORT=8000
        ```

3. **Configure Frontend (Node.js BFF & React Client):**
    * Navigate to the frontend directory:

        ```bash
        # From project root:
        cd frontend/DocumentIntelligence
        ```

    * Install dependencies for both the server (BFF) and client:

        ```bash
        npm install # Installs dependencies for both server and client workspaces if configured correctly
        # or run separately:
        # cd server && npm install && cd ../client && npm install
        ```

    * Create a `.env` file in the `frontend/DocumentIntelligence/server` directory. Populate it with necessary variables (e.g., MongoDB connection, JWT secret):

        ```dotenv
        # Example for frontend/DocumentIntelligence/server/.env
        PORT=5000 # Port for the Express BFF server
        DATABASE_URL=mongodb://localhost:27017/ # MongoDB connection string for the BFF
        DB_NAME=doc_rag_frontend_db # Database name for the BFF
        JWT_SECRET=your_super_secret_jwt_key # Secret for JWT authentication
        # Add other variables needed by the BFF (e.g., API keys if it calls external services directly)
        ```

    * Create a `.env` file in the `frontend/DocumentIntelligence/client` directory. Populate it with the URLs needed to connect to the backend services:

        ```dotenv
        # Example for frontend/DocumentIntelligence/client/.env
        VITE_API_BASE_URL=http://localhost:5000/api # URL for the Node.js BFF API
        # If the client needs to call the Python API directly for some things (unlikely with BFF):
        # VITE_PYTHON_API_BASE_URL=http://localhost:8000/api
        ```

### Running the Application

You'll need to run the Python backend and the Node.js frontend server concurrently in separate terminals:

1. **Start the Core Backend (Python/FastAPI):**

    ```bash
    cd backend
    source venv/bin/activate # If using a venv
    uvicorn api:app --host $env:FASTAPI_HOST --port $env:FASTAPI_PORT --reload # PowerShell
    # Or: uvicorn api:app --host ${FASTAPI_HOST:-0.0.0.0} --port ${FASTAPI_PORT:-8000} --reload # Bash/Zsh
    ```

    *(Note: The server will run on the host/port specified in your `backend/.env` file, defaulting to 0.0.0.0:8000)*

2. **Start the Frontend (Node.js BFF & React Client via Vite):**

    ```bash
    cd frontend/DocumentIntelligence
    npm run dev # This command should ideally start both the Node.js server and the Vite dev server concurrently
    # If not, you might need separate commands defined in package.json or run them manually:
    # Terminal 1: cd server && npm run dev
    # Terminal 2: cd client && npm run dev
    ```

    *(Note: The Node.js BFF server will likely run on port 5000, and the React Vite dev server on port 5173 by default, as configured)*

Access the application through the URL provided by the React Vite development server (usually `http://localhost:5173`).

### Running the Streamlit Demo App

To run the standalone Streamlit demo (useful for quick tests, defaults to local FAISS):

1. Ensure you are in the `backend` directory with the virtual environment activated.
2. Make sure `USE_LOCAL_VECTOR_STORE=True` is set in `backend/.env` if you haven't ingested data into Weaviate.
3. Run the Streamlit app:

    ```bash
    cd backend
    source venv/bin/activate # If using a venv
    streamlit run app.py
    ```

---

## ✅ Project Status & Task List

(Scratch items indicate completed tasks - **Note:** This section might be outdated)

### Core RAG Backend (Python/FastAPI - `backend/`)

* [x] ~~Setup FastAPI server (`backend/api.py`).~~
* [x] ~~Implement document upload endpoint (`/api/upload`).~~
* [x] ~~Implement document processing logic using Unstructured (`backend/ragbase/ingestor.py`).~~
* [x] ~~Implement document ingestion trigger endpoint (`/api/process`).~~
* [x] ~~Integrate Weaviate as the vector store.~~
* [x] ~~Integrate FAISS as a local vector store option.~~
* [x] ~~Setup Weaviate client connection using API key and URL.~~
* [x] ~~Implement shared Weaviate client instance management (`lifespan` context manager).~~\
* [x] ~~Define RAG chain structure using LangChain (`backend/ragbase/chain.py`).~~
* [x] ~~Integrate Ollama LLM.~~\
* [x] ~~Integrate Groq LLM as an option.~~\
* [x] ~~Implement chat endpoint (`/api/chat`) with streaming.~~\
* [x] ~~Implement vector store retrieval (Weaviate/FAISS) in the chain.~~\
* [x] ~~Implement MongoDB for chat history, metadata, insights, user registration (`backend/database/mongo_handler.py`).~~\
* [x] ~~Implement endpoints for history, insights, documents, file serving.~~\
* [x] ~~Restore source document retrieval in API streaming response.~~\
* [x] ~~Add error handling for backend operations.~~\
* [x] ~~Create `backend/requirements.txt`.~~\
* [x] ~~Add basic user registration endpoint (`/api/auth/register`).~~

### User/History Backend (Node.js - `frontend/DocumentIntelligence/server/`)

* [x] ~~Setup Express server (`frontend/DocumentIntelligence/server/index.ts`).~~
* [x] ~~Integrate Vite for dev server and static file serving.~~
* [x] ~~Implement user registration/login endpoints.~~\
* [x] ~~Implement authentication (e.g., JWT).~~
* [ ] Implement endpoints to save/retrieve chat history per user (if not solely handled by Python backend).
* [x] ~~Define database connection (MongoDB with fallback).~~
* [x] ~~Add error handling and validation.~~\
* [x] ~~Configure `package.json` for dependencies.~~\

### Frontend (React - `frontend/DocumentIntelligence/client/`)

* [x] ~~Setup project structure (`frontend/DocumentIntelligence/client/src/`).~~
* [x] ~~Setup React with Vite and TypeScript.~~
* [x] ~~Implement routing using Wouter (`App.tsx`).~~
* [x] ~~Implement data fetching/caching with TanStack Query.~~
* [x] ~~Implement state management using Context API (`contexts/`).~~
* [x] ~~Implement user login/registration UI components (`pages/auth-page.tsx`).~~
* [x] ~~Implement file uploader component.~~\
* [x] ~~Connect file uploader to appropriate backend endpoint(s).~~
* [x] ~~Display document processing status.~~\
* [x] ~~Implement chat interface component (`components/chat/`).~~
* [x] ~~Connect chat interface to backend (`/api/chat`).~~
* [x] ~~Handle streaming responses from backend.~~\
* [x] ~~Display retrieved source documents.~~\
* [x] ~~Connect to Node.js backend for authentication.~~
* [x] ~~Style UI components using Tailwind CSS and Shadcn UI (`components/ui/`).~~
* [x] ~~Configure `package.json` for dependencies.~~\

### General

* [ ] Add comprehensive unit and integration tests for all components.
* [x] ~~Implement consistent logging across services.~~\
* [x] ~~Update documentation (README).~~
* [ ] Containerize the application (Docker/Docker Compose).
* [ ] Define deployment strategy.
