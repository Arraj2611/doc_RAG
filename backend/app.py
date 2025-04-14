import streamlit as st
import asyncio
import os
from pathlib import Path
import traceback

from dotenv import load_dotenv
from langchain_core.vectorstores import VectorStoreRetriever
from langchain_core.documents import Document

from ragbase.chain import create_chain
from ragbase.config import Config
from ragbase.ingestor import Ingestor
from ragbase.model import create_llm
from ragbase.retriever import create_retriever
from ragbase.uploader import upload_files

load_dotenv()

# --- Caching ---
@st.cache_resource
def get_llm():
    """Initialize and cache the LLM."""
    print("Initializing LLM...")
    return create_llm()
# --- End Caching ---

def display_sidebar_previews():
    """Display uploaded files in the sidebar."""
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
    """
    Builds the QA chain after processing uploaded files.
    
    Args:
        _files_to_process: The files to process
        
    Returns:
        The created chain or None on failure
    """
    st.info("Processing uploaded files...")
    file_paths = upload_files(_files_to_process)
    if not file_paths:
        st.error("File upload step failed or returned no paths.")
        return None

    st.info(f"Starting ingestion & FAISS index creation for {len(file_paths)} file(s)...")
    # Create Ingestor instance - no client needed
    from ragbase.config import Config
    # Ensure USE_LOCAL_VECTOR_STORE is True to avoid Weaviate client requirement
    if not Config.USE_LOCAL_VECTOR_STORE:
        print("WARNING: Setting USE_LOCAL_VECTOR_STORE to True for Streamlit app")
        Config.USE_LOCAL_VECTOR_STORE = True
        
    ingestor = Ingestor()
    ingestion_successful = ingestor.ingest(file_paths)

    if not ingestion_successful:
        st.error("Data ingestion / FAISS index creation failed. Check logs.")
        return None # Indicate failure

    st.info("Ingestion successful. Getting LLM and Loading FAISS Retriever...")
    llm = get_llm()
    # Create retriever directly - no client needed
    try:
        retriever = create_retriever(llm)
    except Exception as e:
        st.error(f"Failed to load FAISS retriever: {e}")
        print(f"ERROR build_qa_chain: Failed to load FAISS retriever: {e}")
        traceback.print_exc()
        return None
    
    if retriever is None: 
         st.error("Failed to create retriever after successful ingestion.")
         return None
    
    st.success("RAG Chain Ready (using FAISS)!")
    return create_chain(llm, retriever)

def show_upload_and_process():
    """
    Handles file upload and triggers chain building.
    
    Returns:
        True if successful, False otherwise
    """
    st.header("Multimodal RAG Base")
    st.subheader("Chat with your documents and images")
    uploaded_files = st.file_uploader(
        label="Upload PDF or Image files",
        type=["pdf", "png", "jpg", "jpeg"],
        accept_multiple_files=True,
        key="file_uploader"
    )

    if uploaded_files:
        st.session_state.uploaded_files_list = uploaded_files
        if st.button("Process Uploaded Files", key="process_button"):
             with st.spinner("Creating FAISS index.... Please wait."):
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
    """Display chat messages from history."""
    if "messages" in st.session_state:
        for message in st.session_state.messages:
            role = message["role"]
            avatar = "🤖" if role == 'assistant' else "👨"
            with st.chat_message(role, avatar=avatar):
                st.markdown(message["content"])

def show_chat_input(chain):
    """
    Displays chat input, handles streaming invocation, and shows sources.
    
    Args:
        chain: The RAG chain to use
    """
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
                
                # Iterate over the stream
                for chunk_index, chunk in enumerate(chain.stream(
                    {"question": prompt},
                    config={"configurable": {"session_id": session_id}}
                )):
                    # Debug
                    print(f"--- DEBUG Chunk #{chunk_index} --- Type: {type(chunk)}")
                    if isinstance(chunk, dict):
                        print(f"Keys: {list(chunk.keys())}")
                    else:
                        print(f"Content: {chunk}")
                    print("-------------------------")

                    # Extract Content Chunks
                    content_chunk = None
                    if isinstance(chunk, dict):
                        answer_part = chunk.get("answer")
                        if answer_part and hasattr(answer_part, 'content'):
                            content_chunk = answer_part.content
                    
                    if content_chunk:
                        full_response += content_chunk
                        message_placeholder.markdown(full_response + "▌")
                        
                    # Extract Source Documents
                    if isinstance(chunk, dict):
                         potential_sources = chunk.get("source_documents") 
                         if isinstance(potential_sources, list) and all(isinstance(doc, Document) for doc in potential_sources):
                            if not sources: 
                                sources = potential_sources
                                print(f"DEBUG show_chat_input: Captured {len(sources)} sources")
                
                # Final Display & History Update
                message_placeholder.markdown(full_response)
                if full_response:
                     st.session_state.messages.append({'role': 'assistant', 'content': full_response})
                else:
                    message_placeholder.error("Sorry, I couldn't generate a response.")

                # Display Sources
                if sources:
                    print(f"DEBUG show_chat_input: Displaying {len(sources)} sources.")
                    st.markdown("---")
                    st.subheader("Sources:")
                    cols = st.columns(len(sources) if len(sources) <= 3 else 3)
                    for i, doc in enumerate(sources):
                        with cols[i % 3]:
                            st.markdown(f"**Source {i+1}:**")
                            st.markdown(f"`{doc.metadata.get('source', 'unknown')}`")
                            if doc.page_content:
                                with st.expander("View Content"):
                                    st.markdown(doc.page_content)
                            
            except Exception as e:
                print(f"ERROR streaming response: {e}")
                traceback.print_exc()
                message_placeholder.error(f"Error: {str(e)}")

def main():
    """Main application function."""
    # Initialize session state for messages if not already done
    if "messages" not in st.session_state:
        st.session_state.messages = []
    
    # Try to display file previews in sidebar (if any files are uploaded)
    display_sidebar_previews()
    
    # If we don't have a chain yet, show the upload and process UI
    if "rag_chain" not in st.session_state:
        has_processed = show_upload_and_process()
        # If still don't have a chain after that, show info messages
        if not has_processed and "rag_chain" not in st.session_state:
            # Show welcome message only if no messages in history
            if not st.session_state.messages:
                st.markdown("## Welcome to the Document RAG Bot")
                st.markdown("Upload files to start chatting with your documents.")
    else:
        # We have a chain, show the chat UI
        show_message_history()
        show_chat_input(st.session_state.rag_chain)

if __name__ == "__main__":
    main()    