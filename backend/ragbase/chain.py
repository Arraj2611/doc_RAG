import re
from operator import itemgetter
from typing import List
from pathlib import Path
import traceback

from langchain.schema.runnable import RunnablePassthrough, RunnableParallel
from langchain_core.documents import Document
from langchain_core.language_models import BaseLanguageModel
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import Runnable
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.tracers.stdout import ConsoleCallbackHandler
from langchain_core.vectorstores import VectorStoreRetriever
from langchain_core.runnables import RunnableLambda
from langchain_core.retrievers import BaseRetriever
from langchain_community.chat_message_histories import ChatMessageHistory
import weaviate
from weaviate.classes.query import MetadataQuery, Filter

from ragbase.config import Config

# --- Define store at module level --- 
store = {}

SYSTEM_PROMPT="""
Utilize the provided contextual information to respond to the user question.
If the answer is not found within the context, state answer cannot be found.
Prioritize concise responses (max of 3 sentences) and use a list where applicable.
The contextual information is organized with the most relevant source appearing first.
Each source is separated by a horizontal rule (---).

Context:
{context}

Use markdown formatting where appropriate.
"""

def remove_links(text: str) -> str:
    url_pattern = r"https?://\S+|www\.\S+"
    return re.sub(url_pattern, "", text)

def format_docs(documents: List[Document]) -> str:
    """Formats retrieved documents (text and images) into a context string for the LLM."""
    formatted_context = []
    print(f"\n--- DEBUG format_docs: Received {len(documents)} documents to format ---")
    if not documents:
        print("DEBUG format_docs: No documents received.")
        return "No relevant context found."

    for i, doc in enumerate(documents):
        print(f"--- Document #{i+1} ---")
        print(f"  Metadata: {doc.metadata}")
        content = doc.page_content if doc.page_content else "[NO CONTENT]"
        print(f"  Content Preview (first 200 chars):\n    {content[:200]}...")
        print(f"---------------------")
        
        source = doc.metadata.get("source", "Unknown source")
        try:
            source_name = Path(source).name
        except Exception:
            source_name = str(source)

        doc_type = doc.metadata.get("doc_type")

        context_piece = ""
        if doc_type == "image":
            context_piece = f"[Context from image: {source_name}]"
        elif doc_type == "text":
            page_num = doc.metadata.get("page")
            page_info = f", page {page_num + 1}" if page_num is not None else ""
            content = doc.page_content
            if not content or not content.strip():
                print(f"WARNING format_docs: Doc {i+1} (text) has empty page_content. Source: {source_name}{page_info}")
                content = "[Content missing or empty]"
            else:
                content = remove_links(content)
            context_piece = f"[Context from text document: {source_name}{page_info}]\n{content}"
        else:
            content = doc.page_content
            if not content or not content.strip():
                print(f"WARNING format_docs: Doc {i+1} (unknown/missing type) has empty page_content. Source: {source_name}")
                content = "[Content missing or empty]"
            else:
                content = remove_links(content)
            context_piece = f"[Context from: {source_name}]\n{content}"

        formatted_context.append(context_piece)
        if i < len(documents) - 1:
            formatted_context.append("---")

    full_context = "\n".join(formatted_context).strip()
    print(f"\n--- DEBUG format_docs: Final Context String --- ")
    print(f"Length: {len(full_context)}")
    print(f"Preview (first 500 chars):\n{full_context[:500]}...")
    print("--- End Final Context ---")
    return full_context if full_context else "No relevant context found."

def get_session_history(session_id: str) -> ChatMessageHistory:
    """Retrieves chat history for a session, creating it if necessary."""
    if session_id not in store:
        print(f"DEBUG get_session_history: Creating new history for session: {session_id}")
        store[session_id] = ChatMessageHistory()
    else:
        print(f"DEBUG get_session_history: Retrieving existing history for session: {session_id}")
    return store[session_id]

# --- Weaviate Direct Retrieval Function --- 
def retrieve_context_weaviate(input_dict: dict, client: weaviate.Client) -> List[Document]:
    """Retrieves docs from Weaviate using nearText and converts to Document objects."""
    query = input_dict["question"]
    k = Config.Retriever.SEARCH_K
    collection_name = Config.Database.WEAVIATE_INDEX_NAME
    text_key = Config.Database.WEAVIATE_TEXT_KEY
    attributes = ["source", "page", "doc_type", "element_index"] # Define attributes
    
    print(f"--- DEBUG retrieve_context_weaviate: Querying '{collection_name}' using nearText. Query: '{query[:50]}...' K={k}")
    if not client:
        print("ERROR retrieve_context_weaviate: Weaviate client is None!")
        return []
    try:
        collection = client.collections.get(collection_name)
        
        # --- TEMPORARY DEBUG: Check if specific source exists --- 
        if "sushant_report" in query.lower(): # Check if query mentions the report
            try:
                test_source = "sushant_report.docx"
                print(f"--- DEBUG retrieve_context_weaviate: Testing filter for source='{test_source}' ---")
                filter_response = collection.query.fetch_objects(
                    filters=Filter.by_property("source").equal(test_source),
                    limit=5
                )
                if filter_response.objects:
                    print(f"--- DEBUG retrieve_context_weaviate: Found {len(filter_response.objects)} objects via filter for '{test_source}' ---")
                    # Optional: Print content of first filtered object
                    # print(f"    First object content: {filter_response.objects[0].properties.get(text_key, '')[:100]}...")
                else:
                    print(f"--- DEBUG retrieve_context_weaviate: Found NO objects via filter for '{test_source}' ---")
            except Exception as filter_e:
                print(f"--- DEBUG retrieve_context_weaviate: Error during filter test: {filter_e} ---")
        # --- END TEMPORARY DEBUG ---
                
        response = collection.query.near_text(
            query=query,
            limit=k,
            return_metadata=MetadataQuery(distance=True)
        )
        docs = []
        if response.objects:
            print(f"--- DEBUG retrieve_context_weaviate: Received {len(response.objects)} results via nearText.")
            for i, obj in enumerate(response.objects):
                metadata = {key: obj.properties.get(key) for key in attributes if key in obj.properties}
                if obj.metadata and obj.metadata.distance is not None:
                    metadata["distance"] = obj.metadata.distance
                content = obj.properties.get(text_key, "")
                docs.append(Document(page_content=content, metadata=metadata))
                # Debug print source of each nearText result
                print(f"    nearText Result #{i+1}: Source='{metadata.get('source')}', Distance={metadata.get('distance'):.4f}") 
        else:
            print("--- DEBUG retrieve_context_weaviate: Received 0 results via nearText.")
        return docs
    except Exception as e:
        print(f"ERROR in retrieve_context_weaviate: {e}")
        traceback.print_exc() # Print full traceback for errors here
        return []

def create_chain(llm: BaseLanguageModel, retriever: BaseRetriever | None, client: weaviate.Client | None) -> Runnable:
    """Creates the RAG chain, using either FAISS retriever or direct Weaviate call."""
    print("--- Entering create_chain --- ")
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{question}")
        ]
    )
    print("DEBUG create_chain: Prompt created.")

    # --- Define document retrieval step conditionally --- 
    if Config.USE_LOCAL_VECTOR_STORE:
        if retriever is None:
             raise ValueError("FAISS retriever is required for local mode but not provided.")
        print("Using FAISS retriever for context retrieval.")
        # Use the provided FAISS retriever object
        retrieve_docs_step = retriever.with_config({"run_name": "faiss_retriever"})
    else:
        if client is None:
             raise ValueError("Weaviate client is required for remote mode but not provided.")
        print("Using direct Weaviate call for context retrieval.")
        # Use a lambda with the client to call our new function
        retrieve_docs_step = RunnableLambda(lambda x: retrieve_context_weaviate(x, client=client), name="weaviate_retriever")
    
    # --- Core RAG Chain Structure --- 
    core_rag_chain = (
        # Step 1
        RunnableParallel(
            {
                "docs": retrieve_docs_step,
                "question": itemgetter("question"), 
                "chat_history": itemgetter("chat_history")
            }
        )
        # Step 2
        | RunnablePassthrough.assign(
            context=lambda x: format_docs(x["docs"]), 
            source_documents=itemgetter("docs") 
        ).with_config({"run_name": "context_formatter"})
        # Step 3
        | RunnableParallel(
            {
                "source_documents": itemgetter("source_documents"), 
                "answer": (
                    prompt.with_config({"run_name": "prompt_formatter"})
                    | RunnableLambda(lambda prompt_obj: print(f"--- DEBUG create_chain: Final Prompt Sent to LLM ---\n{prompt_obj}\n--- End Final Prompt ---") or prompt_obj, name="DebugPrompt")
                    | llm.with_config({"run_name": "llm_call"})
                    | RunnableLambda(lambda llm_output: print(f"--- DEBUG create_chain: LLM Output Received ---\n{llm_output}\n--- End LLM Output ---") or llm_output, name="DebugLLMOutput")
                )
            }
        )
    ).with_config({"run_name": "core_rag_chain"})
    print(f"DEBUG create_chain: Core RAG chain created: {type(core_rag_chain)}")

    print("DEBUG create_chain: Wrapping chain with history...")
    # Wrap the core chain with history management
    chain_with_message_history = RunnableWithMessageHistory(
        core_rag_chain, 
        get_session_history, 
        input_messages_key="question",
        history_messages_key="chat_history",
        output_messages_key="answer" # LLM output is in the 'answer' key
    ).with_config({"run_name":"chain_with_message_history"})
    print(f"DEBUG create_chain: Chain with history created: {type(chain_with_message_history)}")

    return chain_with_message_history

