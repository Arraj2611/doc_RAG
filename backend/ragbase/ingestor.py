from pathlib import Path
from typing import List
import mimetypes
import traceback
import shutil

from langchain_community.document_loaders import UnstructuredPDFLoader
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter

from ragbase.model import create_embeddings
from ragbase.config import Config
from PIL import Image

mimetypes.add_type("image/png", ".png")
mimetypes.add_type("image/jpeg", ".jpg")
mimetypes.add_type("image/jpeg", ".jpeg")

class Ingestor:
    def __init__(self):
        self.embedder: Embeddings = create_embeddings()
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100,
            length_function=len,
            is_separator_regex=False,
        )

    def ingest(self, doc_paths: List[Path]) -> bool:
        text_docs: List[Document] = []
        image_docs: List[Document] = []
        image_pils: List[Image.Image] = []

        print(f"Starting ingestion for {len(doc_paths)} file(s)...")
        for doc_path in doc_paths:
            if not doc_path.is_file():
                print(f"Warning: Path '{doc_path}' is not a file. Skipping.")
                continue
            try:
                mime_type, _ = mimetypes.guess_type(doc_path)
                # Commenting out processing message for cleaner logs during success
                # print(f"Processing '{doc_path.name}', detected type: {mime_type}")

                if mime_type == "application/pdf":
                    print(f"Processing PDF '{doc_path.name}' with UnstructuredPDFLoader...")
                    loader = UnstructuredPDFLoader(str(doc_path), mode="elements")
                    loaded_elements = loader.load()
                    if not loaded_elements:
                        print(f"Warning: No content loaded from PDF '{doc_path.name}' using Unstructured. Skipping.")
                        continue
                    
                    elem_idx = 0
                    for element in loaded_elements:
                        if element.page_content and element.page_content.strip():
                            page_text = element.page_content
                            page_number = element.metadata.get("page_number", None)
                            source_info = str(doc_path)
                            
                            metadata = {
                                "source": source_info,
                                "doc_type": "text" 
                            }
                            if page_number is not None:
                                metadata["page"] = page_number - 1
                            else:
                                metadata["element_index"] = elem_idx

                            split_chunks = self.text_splitter.create_documents(
                                [page_text],
                                metadatas=[metadata]
                            )
                            text_docs.extend(split_chunks)
                            elem_idx += 1
                        else:
                            print(f"Warning: Element from '{doc_path.name}' has empty content. Skipping element.")

                elif mime_type and mime_type.startswith("image/"):
                    try:
                        img = Image.open(doc_path)
                        img.load()
                        image_pils.append(img.copy())
                        image_docs.append(
                            Document(
                                page_content=f"[Image file: {doc_path.name}]",
                                metadata={"source": str(doc_path), "doc_type": "image"}
                            )
                        )
                        img.close()
                    except Exception as img_err:
                        print(f"Error opening or loading image '{doc_path.name}': {img_err}. Skipping image.")

                # else:
                    # print(f"Warning: Unsupported file type '{mime_type}' for '{doc_path.name}'. Skipping.")

            except Exception as e:
                print(f"Error processing file {doc_path}: {e}")
                traceback.print_exc()

        if not text_docs and not image_docs:
            print("No processable documents (text chunks or images) found.")
            return True # Success, nothing needed to be ingested

        all_docs = text_docs + image_docs
        if not all_docs:
             print("No documents to index.")
             return True

        print(f"Creating FAISS index from {len(all_docs)} documents...")
        try:
            faiss_index = FAISS.from_documents(all_docs, self.embedder)
            
            index_path = Config.Path.FAISS_INDEX_PATH
            print(f"Saving FAISS index to: {index_path}")
            index_path.parent.mkdir(parents=True, exist_ok=True)
            if index_path.exists():
                 shutil.rmtree(index_path)
            faiss_index.save_local(folder_path=str(index_path))
            print("FAISS index saved successfully.")
            return True
        except Exception as e:
            print(f"Error creating or saving FAISS index: {e}")
            traceback.print_exc()
            return False
