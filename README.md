# DocRAG: Intelligent Document Q&A Chatbot

**Ask questions about your documents and get intelligent, context-aware answers.**

DocRAG is a sophisticated Retrieval-Augmented Generation (RAG) application designed for interactive Q&A with your document library. Upload your files (PDFs, DOCX, etc.), and DocRAG processes them, enabling you to chat directly about their content. It leverages state-of-the-art language models and vector databases to provide accurate, source-backed answers with a seamless user experience.

Built with a modern stack, it features a **React frontend**, a **Python/FastAPI backend** for core document processing and RAG, and a **Node.js backend** for user and chat history management.

---

## ✨ Features

* **📄 Multi-Format Document Upload:** Easily upload PDFs, DOCX, and potentially other formats.
* **🧠 Intelligent Processing:** Utilizes the `Unstructured` library for robust document parsing and chunking.
* **⚡ Efficient Vector Storage:** Leverages **Weaviate Cloud** with built-in embeddings for fast and scalable semantic search.
* **💬 Conversational Interface:** Engage in natural language conversations about your documents.
* **🧾 Source Tracking:** Displays the specific document chunks used to generate each answer, ensuring transparency.
* **💨 Real-time Responses:** Enjoy streaming responses directly from the Language Model (LLM).
* **🚀 (Optional) High-Speed LLM:** Potential for extremely fast inference via Groq.
* **👤 User Management:** (Via Node.js backend) Handles user profiles and authentication.
* **📚 Chat History:** (Via Node.js backend) Stores and retrieves past conversations.

---

## 🏗️ Architecture

* **Frontend:** React (`frontend/Rag_App/client/`)
* **RAG Backend:** Python / FastAPI (`backend/`)
  * **RAG Logic:** LangChain (`backend/ragbase/`)
  * **Vector Store:** Weaviate Cloud
  * **LLM:** Ollama / Groq (configurable via `.env`)
  * **Embedding Model:** Weaviate's built-in model (e.g., `text2vec-weaviate`)
* **User/History Backend:** Node.js / Express(?) (`frontend/Rag_App/server/`)

---

## 🚀 Getting Started

### Prerequisites

* Node.js and npm (or yarn)
* Python 3.x and pip
* Access to a Weaviate Cloud instance
* Groq API Key (if using Groq)
* (Optional) Locally running Ollama instance

### Setup

1. **Clone the Repository:**

    ```bash
    git clone <your-repository-url>
    cd <your-repository-name>
    ```

2. **Configure Python (RAG) Backend:**
    * Navigate to the Python backend directory:

        ```bash
        cd backend
        ```

    * Create a virtual environment (recommended):

        ```bash
        python -m venv venv
        source venv/bin/activate # Linux/macOS
        # .\venv\Scripts\activate # Windows
        ```

    * Install Python dependencies (assuming `requirements.txt` exists or will be created):

        ```bash
        pip install -r requirements.txt
        ```

    * Create a `.env` file in the `backend` directory with your credentials:

        ```dotenv
        WEAVIATE_URL=your_weaviate_cloud_url
        WEAVIATE_API_KEY=your_weaviate_api_key
        OLLAMA_BASE_URL=http://localhost:11434 # Adjust if needed, only used if Ollama is selected
        GROQ_API_KEY=your_groq_api_key # Only used if Groq is selected
        ```

    * **(Optional) Configure Weaviate:** Ensure your Weaviate instance is running and the collection specified in `backend/ragbase/config.py` is configured with the desired vectorizer (e.g., `text2vec-weaviate`).

3. **Configure Node.js (User/History) Backend:**
    * Navigate to the Node.js server directory:

        ```bash
        # From project root:
        cd frontend/Rag_App/server
        ```

    * Install Node.js dependencies:

        ```bash
        npm install
        # or: yarn install
        ```

    * Configure any necessary environment variables for this server (e.g., database connection strings) - *Update this based on the actual server setup*.

4. **Configure React Frontend:**
    * Navigate to the React client directory:

        ```bash
        # From project root:
        cd frontend/Rag_App/client
        ```

    * Install Node.js dependencies:

        ```bash
        npm install
        # or: yarn install
        ```

    * Configure any necessary environment variables for the client (e.g., API endpoint URLs) - *Update this based on the actual client setup*.

### Running the Application

You'll need to run all three components concurrently in separate terminals:

1. **Start the Python (RAG) Backend:**

    ```bash
    cd backend
    source venv/bin/activate # If using a venv
    python api.py
    ```

2. **Start the Node.js (User/History) Backend:**

    ```bash
    cd frontend/Rag_App/server
    npm start # Or the appropriate command for this server
    ```

3. **Start the React Frontend:**

    ```bash
    cd frontend/Rag_App/client
    npm start # Or: yarn start
    ```

Access the application through the URL provided by the React development server (usually `http://localhost:3000`).

---

## ✅ Project Status & Task List

*(Scratch items indicate completed tasks)*

### Core RAG Backend (Python/FastAPI - `backend/`)

* [x] ~~Setup FastAPI server (`backend/api.py`).~~
* [x] ~~Implement document upload endpoint (`/api/upload`).~~
* [x] ~~Implement document processing logic using Unstructured (`backend/ragbase/ingestor.py`).~~
* [x] ~~Implement document ingestion trigger endpoint (`/api/process`).~~
* [x] ~~Integrate Weaviate as the vector store.~~
* [x] ~~Setup Weaviate client connection using API key and URL.~~
* [x] ~~Implement shared Weaviate client instance management (`lifespan` context manager).~~
* [x] ~~Fix Weaviate `ResourceWarning` on reload.~~
* [x] ~~Define RAG chain structure using LangChain (`backend/ragbase/chain.py`).~~
* [x] ~~Integrate Ollama LLM.~~
* [x] ~~Integrate Groq LLM as an option.~~
* [x] ~~Implement chat endpoint (`/api/chat`) with streaming.~~
* [x] ~~Implement Weaviate `nearText` retrieval directly in the chain.~~
* [x] ~~Fix `TypeError` in `create_chain` call (missing client).~~
* [x] ~~Fix `NameError: 'store' is not defined` for chat history (temporary in-memory store).~~
* [x] ~~Update `ChatMessageHistory` import path.~~
* [x] ~~Restore source document retrieval in API streaming response.~~
* [ ] **Investigate and resolve Weaviate `nearText` retrieval relevance issue.**
* [ ] Refine prompt engineering (`SYSTEM_PROMPT`, context formatting).
* [ ] Add error handling for Weaviate connection/query failures.
* [ ] Create `backend/requirements.txt`.

### User/History Backend (Node.js - `frontend/Rag_App/server/`)

* [ ] Implement user registration/login endpoints.
* [ ] Implement authentication (e.g., JWT).
* [ ] Implement endpoints to save/retrieve chat history per user.
* [ ] Define database schema for users and chat history.
* [ ] Add error handling and validation.
* [ ] Create `package.json` (if not present) and list dependencies.

### Frontend (React - `frontend/Rag_App/client/`)

* [ ] Setup project structure (components, services, state management).
* [ ] Implement user login/registration UI components.
* [ ] Implement file uploader component.
* [ ] Connect file uploader to Python backend (`/api/upload`, `/api/process`).
* [ ] Display document processing status.
* [ ] Implement chat interface component.
* [ ] Connect chat interface to Python backend (`/api/chat`) for RAG Q&A.
* [ ] Handle streaming responses from Python backend.
* [ ] Display retrieved source documents.
* [ ] Connect chat interface to Node.js backend for saving/loading history.
* [ ] Implement state management (e.g., Context API, Redux, Zustand).
* [ ] Implement routing (e.g., React Router).
* [ ] Style UI components (e.g., CSS Modules, Tailwind CSS, MUI).
* [ ] Create `package.json` (if not present) and list dependencies.

### General

* [ ] Create root-level `requirements.txt` (if needed for shared tools).
* [ ] Add comprehensive unit and integration tests for all components.
* [ ] Implement consistent logging across all services.
* [ ] Finalize documentation.
* [ ] Containerize the application (Docker/Docker Compose).
* [ ] Define deployment strategy.
