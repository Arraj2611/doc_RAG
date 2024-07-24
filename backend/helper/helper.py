import fitz  # PyMuPDF for PDF processing
from langchain_community.embeddings import OllamaEmbeddings
import pickle
import sqlite3
import numpy as np

def extract_text_and_images_from_pdf(pdf_path):
    """
    Extracts text and images from a PDF file using PyMuPDF (fitz).
    
    Args:
    - pdf_path (str): Path to the PDF file.
    
    Returns:
    - tuple: Extracted text (str), list of extracted images (list of bytes).
    """
    text = ""
    images = []
    
    try:
        with fitz.open(pdf_path) as pdf_document:
            for page_num in range(len(pdf_document)):
                page = pdf_document.load_page(page_num)
                
                # Extract text
                text += page.get_text()
                
                # Extract images
                images_on_page = page.get_images(full=True)
                for img_info in images_on_page:
                    xref = img_info[0]
                    base_image = pdf_document.extract_image(xref)
                    image_bytes = base_image["image"]
                    images.append(image_bytes)
    
    except Exception as e:
        print(f"Error extracting text and images from PDF: {e}")
    
    return text, images

def generate_text_embeddings(text):
    """
    Generates embeddings for given text using OllamaEmbeddings.
    
    Args:
    - text (str): Text to embed.
    
    Returns:
    - numpy.ndarray: Embedding vector.
    """
    embedder = OllamaEmbeddings(model='mxbai-embed-large')
    text_embeddings = embedder.embed_query(text)
    return text_embeddings

def generate_image_embeddings(images):
    """
    Generates embeddings for images using pickle for serialization.
    
    Args:
    - images (list of bytes): List of images as byte arrays.
    
    Returns:
    - list of bytes: List of serialized image embeddings.
    """
    serialized_image_embeddings = []
    
    try:
        for img in images:
            serialized_image_embeddings.append(pickle.dumps(img))
    
    except Exception as e:
        print(f"Error generating image embeddings: {e}")
    
    return serialized_image_embeddings

def store_embeddings_in_database(pdf_path, text_embeddings, image_embeddings):
    """
    Stores PDF path, text embeddings, and image embeddings in an SQLite database.
    
    Args:
    - pdf_path (str): Path to the PDF file.
    - text_embeddings (numpy.ndarray): Text embeddings to store.
    - image_embeddings (list of bytes): List of serialized image embeddings to store.
    """
    try:
        # Convert embeddings to bytes before storing
        text_embedding_bytes = pickle.dumps(text_embeddings)
        
        # Connect to SQLite database
        conn = sqlite3.connect('pdf_embeddings.db')
        c = conn.cursor()
        
        # Create table if not exists
        c.execute('''CREATE TABLE IF NOT EXISTS embeddings
                     (pdf_path TEXT PRIMARY KEY, text_embedding BLOB, image_embeddings BLOB)''')
        
        # Insert PDF path, text embeddings, and image embeddings into database
        c.execute('INSERT OR REPLACE INTO embeddings VALUES (?, ?, ?)', 
                  (pdf_path, text_embedding_bytes, pickle.dumps(image_embeddings)))
        
        # Commit changes and close connection
        conn.commit()
        conn.close()
        
        print(f"Embeddings for {pdf_path} stored successfully.")
    
    except Exception as e:
        print(f"Error storing embeddings in database: {e}")

def process_pdf(pdf_path):
    """
    Processes a PDF file: extracts text and images, generates embeddings, and stores them in a database.
    
    Args:
    - pdf_path (str): Path to the PDF file.
    """
    try:
        # Extract text and images from PDF
        text, images = extract_text_and_images_from_pdf(pdf_path)
        
        # Debugging: Check extracted text and images
        print(f"Extracted Text Length: {len(text)}")
        print(f"Number of Extracted Images: {len(images)}")
        
        # Generate text embeddings
        text_embeddings = generate_text_embeddings(text)
        
        # Debugging: Check text embeddings
        print(f"Text Embeddings: {text_embeddings}")
        
        # Generate image embeddings
        image_embeddings = generate_image_embeddings(images)
        
        # Debugging: Check image embeddings
        print(f"Number of Image Embeddings: {len(image_embeddings)}")
        
        # Store embeddings in database if embeddings were successfully generated
        if text_embeddings is not None and image_embeddings:
            store_embeddings_in_database(pdf_path, text_embeddings, image_embeddings)
        else:
            print(f"Error processing PDF {pdf_path}: Unable to generate embeddings.")
    
    except Exception as e:
        print(f"Error processing PDF {pdf_path}: {e}")

