# Document RAG Application

This project implements a Retrieval-Augmented Generation (RAG) system allowing users to chat with uploaded documents and images. It comprises a Python backend using Streamlit and a custom RAG module, a Node.js/Express server, and a React frontend.

## Project Structure

- `backend/`: Contains the Python backend code.
  - `app.py`: The main Streamlit application file providing the UI for file upload and chat.
  - `ragbase/`: Core RAG logic, including ingestion, model interaction, retrieval (using FAISS), etc.
  - `.streamlit/`: Streamlit configuration.
  - `.env`: Environment variables for the backend (API keys, etc.).
- `frontend/`: Contains the frontend code.
  - `Rag_App/`
    - `client/`: The React frontend application (Vite-based).
    - `server/`: A Node.js/Express server (likely for authentication or auxiliary APIs).

## Setup and Running

### 1. Backend (Python/Streamlit RAG)

**Prerequisites:**
- Python 3.x
- Pip

**Setup:**

1. Navigate to the `backend` directory:

    ```bash
    cd backend
    ```

2. **Note:** A `requirements.txt` file is currently missing. You will need to manually install the required Python packages (e.g., `streamlit`, `langchain`, `python-dotenv`, `faiss-cpu` or `faiss-gpu`, `unstructured`, etc.) based on the imports in `app.py` and the `ragbase` module. Create a virtual environment first:

    ```bash
    python -m venv venv
    source venv/bin/activate # On Windows: venv\Scripts\activate
    # pip install <list_of_required_packages>
    ```

3. Create a `.env` file in the `backend` directory based on any required environment variables (e.g., API keys for language models). See `.env.example` if available, or check `ragbase/config.py`.

**Running:**

1. Ensure your virtual environment is activated.
2. Run the Streamlit application from the root `doc_RAG` directory:

    ```bash
    streamlit run backend/app.py
    ```

### 2. Node.js Server

**Prerequisites:**
- Node.js and npm

**Setup:**

1. Navigate to the server directory:

    ```bash
    cd frontend/Rag_App/server
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Create a `.env` file based on required environment variables (check `server.js` or `config/`).

**Running:**

1. Start the server (uses nodemon for development):

    ```bash
    npm run dev
    ```

    Alternatively, for production:

    ```bash
    npm start
    ```

### 3. Frontend (React Client)

**Prerequisites:**
- Node.js and npm

**Setup:**

1. Navigate to the client directory:

    ```bash
    cd frontend/Rag_App/client
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

**Running:**

1. Start the Vite development server:

    ```bash
    npm run dev
    ```

2. Open your browser to the URL provided (usually `http://localhost:5173`).

## Usage

1. Start the Python backend.
2. Start the Node.js server (if required by the client).
3. Start the React frontend.
4. Open the React app in your browser.
5. Use the Streamlit interface (likely accessed separately, e.g., `http://localhost:8501`) to upload documents/images and interact with the RAG system.
