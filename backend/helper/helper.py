import fitz
from langchain.embeddings import LLaMAEmbedder
import numpy as np
import sqlite3

def extract_text_and_images_from_pdf(pdf_path):
    """
    Extracts text and images from a PDF file using PyMuPDF (fitz).
    
    Args:
    - pdf_path (str): Path to the PDF file.
    
    Returns:
    - tuple: Extracted text (str), list of extracted images (list of numpy.ndarray).
    """
    text = ""
    images = []
    
    with fitz.open(pdf_path) as pdf_document:
        for page_num in range(len(pdf_document)):
            page = pdf_document.load_page(page_num)
            
            # Extract text
            text += page.get_text()
            
            # Extract images (convert to numpy arrays)
            for img in page.get_pixmap().get_images(output='numpy'):
                images.append(img['image'])
    
    return text, images


def generate_embeddings(data):
    """
    Generates embeddings for given data using LLaMA model.
    
    Args:
    - data (str or list of numpy.ndarray): Text or images to embed.
    
    Returns:
    - numpy.ndarray: Embedding vector.
    """
    embedder = LLaMAEmbedder()
    embeddings = embedder.embed(data)
    return embeddings


def store_embeddings_in_database(pdf_path, text_embeddings, image_embeddings):
    """
    Stores PDF path, text embeddings, and image embeddings in an SQLite database.
    
    Args:
    - pdf_path (str): Path to the PDF file.
    - text_embeddings (numpy.ndarray): Text embeddings to store.
    - image_embeddings (list of numpy.ndarray): Image embeddings to store.
    """
    # Connect to SQLite database
    conn = sqlite3.connect('pdf_embeddings.db')
    c = conn.cursor()
    
    # Create table if not exists
    c.execute('''CREATE TABLE IF NOT EXISTS embeddings
                 (pdf_path TEXT PRIMARY KEY, text_embedding BLOB, image_embeddings BLOB)''')
    
    # Insert PDF path, text embeddings, and image embeddings into database
    c.execute('INSERT OR REPLACE INTO embeddings VALUES (?, ?, ?)', (pdf_path, text_embeddings, image_embeddings))
    
    # Commit changes and close connection
    conn.commit()
    conn.close()


def process_pdf(pdf_path):
    """
    Processes the pdf/doc to generate embeddings and store them in the database.

    Args:
    - pdf_path (str): Path to the PDF file.
    """
    # Extract text from PDF
    text, images = extract_text_and_images_from_pdf(pdf_path)
    
    # Generate embeddings
    text_embeddings = generate_embeddings(text)
    image_embeddings = generate_embeddings(images)

    # Store embeddings in database
    store_embeddings_in_database(pdf_path, text_embeddings, image_embeddings)
    
    print(f"Embeddings for {pdf_path} stored successfully.")

