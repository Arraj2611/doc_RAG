import streamlit as st
import asyncio
import os # Added for path joining, potentially
from pathlib import Path # Added for type hint if needed
import traceback # Import traceback

from dotenv import load_dotenv
from langchain_core.vectorstores import VectorStoreRetriever # Add this import
# from qdrant_client import QdrantClient # Re-import QdrantClient

from ragbase.chain import ask_question, create_chain
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

# --- Revert ask_chain to handle streaming --- 
async def ask_chain(question: str, chain):
    print("\n--- Entering ask_chain (app.py - Restored streaming) ---") # Updated print
    full_response = ""
    if not chain:
         st.error("RAG Chain is not available. Cannot process question.")
         print("DEBUG ask_chain: Chain object is None.")
         return

    assistant = st.chat_message("assistant", avatar="🤖")
    with assistant:
        message_placeholder = st.empty()
        try:
            message_placeholder.status("Thinking...", state="running")
            documents = []
            source_documents_processed = False

            print("DEBUG ask_chain: Starting to iterate ask_question events (expecting streams)...") # Updated print
            async for event in ask_question(chain, question, session_id="session-id--42"):
                print(f"DEBUG ask_chain: Received event of type: {type(event)}")
                if isinstance(event, str): # Handle streaming content chunks
                    full_response += event
                    message_placeholder.markdown(full_response + "▌")
                    print(f"DEBUG ask_chain: Appended chunk, response length: {len(full_response)}")
                elif isinstance(event, list) and not source_documents_processed: # Handle documents list
                     documents = event # Assign directly
                     source_documents_processed = True
                     print(f"DEBUG ask_chain: Received {len(documents)} documents.")
                     if documents:
                         print(f"DEBUG ask_chain: First doc metadata keys: {list(documents[0].metadata.keys()) if documents[0].metadata else 'None'}")
                elif isinstance(event, dict):
                     print(f"DEBUG ask_chain: Received unexpected dict event (ignoring): {event}")
                     pass
                else:
                    print(f"WARNING ask_chain: Received unexpected event type: {type(event)}")

            print("DEBUG ask_chain: Finished iterating ask_question events.")

            # --- Restore final markdown update --- 
            message_placeholder.markdown(full_response) # Final response without cursor
            # --- End restore --- 

            # --- Restore source display ---
            if documents:
                print(f"DEBUG ask_chain: Displaying {len(documents)} sources.")
                st.markdown("---")
                st.subheader("Sources:")
                cols = st.columns(len(documents) if len(documents) <= 3 else 3)
                for i, doc in enumerate(documents):
                     print(f"DEBUG ask_chain: Processing source #{i+1}, metadata: {doc.metadata}")
                     with cols[i % len(cols)]:
                         with st.expander(f"Source #{i+1}", expanded=False):
                            doc_type = doc.metadata.get("doc_type", "unknown")
                            source = doc.metadata.get("source", "N/A")
                            source_name = Path(source).name if source != "N/A" else "N/A"

                            if doc_type == "image":
                                try:
                                    if source != "N/A" and Path(source).is_file():
                                        st.image(source, caption=f"Source: {source_name}")
                                    else:
                                        st.warning(f"Could not load image source: {source}")
                                        st.write(f"Content: {doc.page_content}")
                                except Exception as e:
                                    st.error(f"Error displaying image {source}: {e}")
                            elif doc_type == "text":
                                st.write(doc.page_content)
                                page = doc.metadata.get("page", None)
                                page_info = f", Page: {page+1}" if page is not None else ""
                                st.caption(f"Source: {source_name}{page_info}")
                            else:
                                st.write(doc.page_content)
                                st.caption(f"Source: {source_name}")
            else:
                print("DEBUG ask_chain: No documents received to display as sources.")
            # --- End restore source display --- 

        except Exception as e:
             print(f"ERROR ask_chain: An error occurred: {e}")
             traceback.print_exc()
             st.error(f"An error occurred while processing the question: {e}")
             message_placeholder.markdown("Sorry, I encountered an error.")
             full_response = "[Error]"

    # Append response if no error
    if full_response != "[Error]" and full_response.strip() != "[No response received]": # Adjusted condition
         st.session_state.messages.append({'role': 'assistant', 'content': full_response})
    elif full_response == "[No response received]":
          st.error("Processing finished but no response was generated.")

    print("--- Exiting ask_chain (app.py - Restored streaming) ---") # Updated print

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
    # Display chat input widget
    if prompt := st.chat_input("Ask your question here"):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user", avatar="👨"):
            st.markdown(prompt)
        if chain:
            print(f"DEBUG show_chat_input: Chain object type: {type(chain)}.")
            # --- Add prints around asyncio.run ---
            print("DEBUG show_chat_input: BEFORE calling asyncio.run(ask_chain)...")
            try:
                asyncio.run(ask_chain(prompt, chain))
                print("DEBUG show_chat_input: AFTER calling asyncio.run(ask_chain) (Completed).")
            except Exception as e:
                 print(f"ERROR show_chat_input: Exception during asyncio.run(ask_chain): {e}")
                 import traceback
                 traceback.print_exc()
                 # Display error in UI as well if asyncio.run fails critically
                 st.error(f"Critical error executing request: {e}")
            # --- End prints ---
        else:
            print("DEBUG show_chat_input: Chain object is None. Cannot call ask_chain.")
            st.error("RAG Chain not initialized. Please upload documents.")


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