import re
from operator import itemgetter
from typing import List
from pathlib import Path
import traceback

from langchain.schema.runnable import RunnablePassthrough
from langchain_core.documents import Document
from langchain_core.language_models import BaseLanguageModel
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import Runnable
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.tracers.stdout import ConsoleCallbackHandler
from langchain_core.vectorstores import VectorStoreRetriever

from ragbase.config import Config
from ragbase.session_history import get_session_history

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

def create_chain(llm: BaseLanguageModel, retriever: VectorStoreRetriever) -> Runnable:
    print("--- Entering create_chain (Restored History) ---")
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            MessagesPlaceholder("chat_history"),
            ("human", "{question}")
        ]
    )
    print("DEBUG create_chain: Prompt created.")

    core_chain = (
        RunnablePassthrough.assign(
            context = itemgetter("question")
            | retriever.with_config({"run_name": "context_retriever"})
            | format_docs
        ).with_config({"run_name": "context_fetcher"})
        | prompt.with_config({"run_name": "prompt_formatter"})
        | llm.with_config({"run_name": "llm_call"})
    )
    print(f"DEBUG create_chain: Core chain created: {type(core_chain)}")

    print("DEBUG create_chain: Wrapping chain with history...")
    chain_with_history = RunnableWithMessageHistory(
        core_chain,
        get_session_history,
        input_messages_key='question',
        history_messages_key='chat_history',
    ).with_config({"run_name":"chain_with_history"})
    print(f"DEBUG create_chain: Chain with history created: {type(chain_with_history)}")
    return chain_with_history

async def ask_question(chain: Runnable, question: str, session_id: str):
    print("\n--- Entering ask_question (Filtering streams) ---")
    print(f"DEBUG: Received question: {question}")
    documents_to_yield = []
    try:
        async for event in chain.astream_events(
            {"question": question},
            config={
                "callbacks": [ConsoleCallbackHandler()] if Config.DEBUG else [],
                "configurable": {"session_id": session_id},
            },
            version="v2",
        ):
            event_type = event['event']
            event_name = event['name']
            event_data = event.get("data", {})
            event_tags = event.get("tags", [])

            print(f"DEBUG ask_question: Event='{event_type}', Name='{event_name}', Tags='{event_tags}', Data Keys='{list(event_data.keys())}'")

            if event_type == "on_retriever_end" and event_name == "context_retriever":
                output = event_data.get("output", {})
                if isinstance(output, dict) and "documents" in output:
                    documents_to_yield = output["documents"]
                    print(f"DEBUG ask_question: Captured {len(documents_to_yield)} documents from retriever.")
                elif isinstance(output, list):
                    documents_to_yield = output
                    print(f"DEBUG ask_question: Captured {len(documents_to_yield)} documents directly from retriever list.")
                else:
                    print(f"WARNING ask_question: Unexpected retriever output structure for documents: {type(output)}")
                yield documents_to_yield

            if event_type == "on_chat_model_stream" and event_name == "llm_call":
                chunk = event_data.get("chunk")
                if chunk and hasattr(chunk, 'content'):
                     content_chunk = chunk.content
                     if isinstance(content_chunk, str):
                         print(f"DEBUG ask_question: Yielding LLM content chunk: '{repr(content_chunk)}'")
                         yield content_chunk
                     else:
                         print(f"WARNING ask_question: LLM chunk content was not a string: {type(content_chunk)}")
                else:
                    print(f"WARNING ask_question: LLM chunk event missing chunk or content: {chunk}")
            elif event_type == "on_chain_stream" and event_name == "RunnableLambda" and "format_docs" in event_tags:
                print(f"DEBUG ask_question: Skipping yield for intermediate formatted context.")
            elif event_type == "on_chain_stream" and "core_chain" in event_tags:
                print(f"DEBUG ask_question: Skipping yield for other intermediate chain stream event: Name='{event_name}'")

        print(f"DEBUG ask_question: Finished streaming events. Total documents captured: {len(documents_to_yield)}")

    except Exception as e:
        print(f"ERROR ask_question: An error occurred during streaming: {e}")
        traceback.print_exc()
        yield "[Error during processing]"
    finally:
        print("--- Exiting ask_question (Filtering streams) ---")
