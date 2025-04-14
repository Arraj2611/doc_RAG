import streamlit as st
import asyncio
import os # Added for path joining, potentially
from pathlib import Path # Added for type hint if needed
import traceback # Import traceback
# import time # Remove time import

from dotenv import load_dotenv
from langchain_core.vectorstores import VectorStoreRetriever # Add this import
from langchain_core.documents import Document # Ensure Document is imported
# from qdrant_client import QdrantClient # Re-import QdrantClient

from ragbase.chain import create_chain # Keep create_chain
from ragbase.config import Config
from ragbase.ingestor import Ingestor
from ragbase.model import create_llm
from ragbase.retriever import create_retriever
from ragbase.uploader import upload_files # Assumes this saves files and returns List[Path]



load_dotenv()

# --- Caching --- 
# @st.cache_resource # Cache the Qdrant client resource again
# def get_qdrant_client() -> QdrantClient:
#    ...

@st.cache_resource # Cache the LLM
def get_llm():
    print("Initializing LLM...")
    return create_llm()

# --- End Caching ---


# Function to display uploaded files in the sidebar
def display_sidebar_previews():
    if 'uploaded_files_list' in st.session_state and st.session_state.uploaded_files_list:
        st.sidebar.header("Uploaded Files")
        for file in st.session_state.uploaded_files_list:
            with st.sidebar.container(): # Use container for better grouping
                st.sidebar.write(f"**{file.name}**")
                if file.type.startswith("image/"):
                    st.sidebar.image(file, width=150) # Slightly larger thumbnail
                # Optionally add PDF previews later if needed (more complex)
                st.sidebar.divider() # Add a visual separator


def build_qa_chain(_files_to_process):
    """Builds the QA chain after processing uploaded files."""
    st.info("Processing uploaded files...") # Give feedback
    file_paths = upload_files(_files_to_process)
    if not file_paths:
        st.error("File upload step failed or returned no paths.")
        return None

    st.info(f"Starting ingestion & FAISS index creation for {len(file_paths)} file(s)...") # Log change
    # Create Ingestor instance - no client needed
    from ragbase.config import Config
    # Ensure USE_LOCAL_VECTOR_STORE is True to avoid Weaviate client requirement
    if not Config.USE_LOCAL_VECTOR_STORE:
        print("WARNING: Setting USE_LOCAL_VECTOR_STORE to True for Streamlit app")
        Config.USE_LOCAL_VECTOR_STORE = True
        
    ingestor = Ingestor()
    ingestion_successful = ingestor.ingest(file_paths)

    if not ingestion_successful:
        st.error("Data ingestion / FAISS index creation failed. Check logs.") # Log change
        return None # Indicate failure

    st.info("Ingestion successful. Getting LLM and Loading FAISS Retriever...") # Log change
    llm = get_llm()
    # Create retriever directly - no client needed
    try:
        retriever = create_retriever(llm)
    except Exception as e:
        st.error(f"Failed to load FAISS retriever: {e}") # Log change
        print(f"ERROR build_qa_chain: Failed to load FAISS retriever: {e}")
        traceback.print_exc()
        return None
    
    if retriever is None: 
         st.error("Failed to create retriever after successful ingestion.")
         return None
    
    st.success("RAG Chain Ready (using FAISS)!") # Log change
    return create_chain(llm, retriever)

def show_upload_and_process():
    """Handles file upload and triggers chain building. Returns True if successful."""
    st.header("Multimodal RAG Base")
    st.subheader("Chat with your documents and images")
    uploaded_files = st.file_uploader(
        label="Upload PDF or Image files",
        type=["pdf", "png", "jpg", "jpeg"],
        accept_multiple_files=True,
        key="file_uploader" # Add a key to manage state
    )

    if uploaded_files:
        st.session_state.uploaded_files_list = uploaded_files
        if st.button("Process Uploaded Files", key="process_button"):
             with st.spinner("Creating FAISS index.... Please wait."): # Log change
                 # Call build_qa_chain without the client
                 chain_result = build_qa_chain(uploaded_files)
                 if chain_result:
                      st.session_state.rag_chain = chain_result
                      st.rerun() 
                 else:
                      st.error("Processing failed. Please check files or logs.")
             return False 
        else:
             return False 
    else:
        return False 


def show_message_history():
    # Display chat messages from history
    if "messages" in st.session_state:
        for message in st.session_state.messages:
            role = message["role"]
            avatar = "🤖" if role == 'assistant' else "👨"
            with st.chat_message(role, avatar=avatar):
                st.markdown(message["content"])

def show_chat_input(chain):
    """Displays chat input, handles streaming invocation, and shows sources."""
    if prompt := st.chat_input("Ask your question here"):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user", avatar="👨"):
            st.markdown(prompt)
            
        if not chain:
            print("DEBUG show_chat_input: Chain object is None. Cannot invoke.")
            st.error("RAG Chain not initialized. Please upload and process documents.")
            return

        print(f"DEBUG show_chat_input: Chain object type: {type(chain)}.")
        
        assistant = st.chat_message("assistant", avatar="🤖")
        with assistant:
            message_placeholder = st.empty()
            message_placeholder.status("Thinking...", state="running")
            full_response = ""
            sources = []
            try:
                session_id = "streamlit_session_1" 
                print(f"DEBUG show_chat_input: Streaming chain with question and config (session_id={session_id})...")
                
                # --- Iterate over the stream (LLM should stream now) --- 
                for chunk_index, chunk in enumerate(chain.stream(
                    {"question": prompt},
                    config={"configurable": {"session_id": session_id}}
                )):
                    # --- DEBUG --- 
                    print(f"--- DEBUG Chunk #{chunk_index} --- Type: {type(chunk)}")
                    if isinstance(chunk, dict):
                        print(f"Keys: {list(chunk.keys())}")
                    else:
                        print(f"Content: {chunk}")
                    print("-------------------------")
                    # --- END DEBUG --- 

                    # --- Extract Content Chunks (Reverted) --- 
                    # Expect AIMessageChunk in the "answer" field
                    content_chunk = None
                    if isinstance(chunk, dict):
                        answer_part = chunk.get("answer")
                        if answer_part and hasattr(answer_part, 'content'): # AIMessageChunk
                            content_chunk = answer_part.content
                    
                    if content_chunk:
                        full_response += content_chunk
                        message_placeholder.markdown(full_response + "▌")
                        
                    # --- Extract Source Documents --- 
                    if isinstance(chunk, dict):
                         potential_sources = chunk.get("source_documents") 
                         if isinstance(potential_sources, list) and all(isinstance(doc, Document) for doc in potential_sources):
                            if not sources: 
                                sources = potential_sources
                                print(f"DEBUG show_chat_input: Captured {len(sources)} sources from 'source_documents' key.")
                
                # --- Final Display & History Update --- 
                message_placeholder.markdown(full_response) # Display final complete answer
                if full_response:
                     st.session_state.messages.append({'role': 'assistant', 'content': full_response})
                else:
                    message_placeholder.error("Sorry, I couldn't generate a response.")

                # --- Display Sources (Restored) --- 
                if sources:
                    print(f"DEBUG show_chat_input: Displaying {len(sources)} sources.")
                    st.markdown("---")
                    st.subheader("Sources:")
                    cols = st.columns(len(sources) if len(sources) <= 3 else 3)
                    for i, doc in enumerate(sources):
                        print(f"DEBUG show_chat_input: Processing source #{i+1}, metadata: {doc.metadata}")
                        with cols[i % len(cols)]:
                            with st.expander(f"Source #{i+1}", expanded=False):
                                doc_type = doc.metadata.get("doc_type", "text")
                                source = doc.metadata.get("source", "N/A")
                                source_name = Path(source).name if source != "N/A" else "N/A"
                                if doc_type == "text":
                                    st.write(doc.page_content)
                                    page = doc.metadata.get("page", None)
                                    elem_idx = doc.metadata.get("element_index", None)
                                    page_info = f", Page: {page+1}" if page is not None else ""
                                    elem_info = f", Element: {elem_idx}" if elem_idx is not None else ""
                                    st.caption(f"Source: {source_name}{page_info}{elem_info}")
                                else:
                                    st.write(doc.page_content)
                                    st.caption(f"Source: {source_name}")
                else:
                    print("DEBUG show_chat_input: No sources captured from stream to display.")
                # --- End Display Sources --- 

            except Exception as e:
                 print(f"ERROR show_chat_input: Exception during chain processing: {e}") # Updated log
                 traceback.print_exc()
                 st.error(f"Critical error executing request: {e}")
                 message_placeholder.error("Sorry, I encountered an error.")


# --- Main App Logic ---
st.set_page_config(page_title="Chat-RAG Multimodal", page_icon="🤖", layout="wide") # Use wide layout

# Display Sidebar with previews if files are in session state
display_sidebar_previews()

# Initialize chat history if it doesn't exist
if "messages" not in st.session_state:
    st.session_state.messages = [
        {"role": "assistant", "content": "Hi! Upload your documents/images and click 'Process'"}
    ]

# Manage the main interaction flow
if 'rag_chain' not in st.session_state or st.session_state.rag_chain is None:
    # If chain isn't built, show the upload section
    files_processed_successfully = show_upload_and_process()
    if not files_processed_successfully:
         # Display existing messages even while waiting for processing
         show_message_history()
         # Optionally display a placeholder or reminder
         st.info("Upload files and click 'Process Uploaded Files' to begin.")
    # The show_upload_and_process function handles stopping or rerunning

else:
    # If chain is ready, display history and chat input
    show_message_history()
    show_chat_input(st.session_state.rag_chain)    