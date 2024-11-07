from pathlib import Path
from typing import List

from langchain_community.document_loaders import PyPDFium2Loader
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
from langchain_core.vectorstores import VectorStore
from langchain_experimental.text_splitter import SemanticChunker
from langchain_qdrant import Qdrant
from langchain_text_splitters import RecursiveCharacterTextSplitter

from ragbase.config import Config


class Ingestor:
    def __init__(self):
        self.embeddings = FastEmbedEmbeddings(model_name=Config.Model.EMBEDDINGS)
        self.semantic_splitter = SemanticChunker(
            self.embeddings, breakpoint_threshold_amount="interquartile"
        )
        self.recursive_splitter = RecursiveCharacterTextSplitter(
            chunk_size=2048,
            chunk_overlap=128,
            add_start_index=True,
        )
    
    def ingest(self, doc_paths: List[Path]) -> VectorStore:
        documents = []
        for doc_path in doc_paths:
            loaded_docs = PyPDFium2Loader(doc_path).load()
            document_text = "\n".join([doc.page_content for doc in loaded_docs])

            if not document_text.strip():
                print(f"Warning: The document at {doc_path} is empty or only contains whitespace.")
                continue

            try:
                # Generate embeddings
                embeddings = self.embeddings.embed_documents([document_text])
                if embeddings is None or len(embeddings) == 0:
                    print(f"Error: Failed to generate embeddings for the document at {doc_path}.")
                    continue

                # Create semantic documents
                semantic_docs = self.semantic_splitter.create_documents([document_text])
                if not semantic_docs:
                    print(f"No semantic documents were created for the text: {document_text[:100]}...")
                    continue

                # Split the documents
                split_docs = self.recursive_splitter.split_documents(semantic_docs)
                documents.extend(split_docs)

            except Exception as e:
                print(f"An error occurred while processing {doc_path}: {e}")
        
        if not documents:
            print("No documents to store in Qdrant. Exiting...")
            return None  # or raise an exception, or handle it according to your logic
        
        return Qdrant.from_documents(
            documents=documents,
            embedding=self.embeddings,
            path=Config.Path.DATABASE_DIR,
            collection_name=Config.Database.DOCUMENTS_COLLECTION,
        )
