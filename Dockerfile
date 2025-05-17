# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set environment variables for Python to prevent it from writing .pyc files to disc and to run in unbuffered mode
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies that might be required by 'unstructured' or other libraries.
# Example: libreoffice for .doc/.docx, tesseract for OCR. Add as needed.
# RUN apt-get update && apt-get install -y libreoffice tesseract-ocr poppler-utils && rm -rf /var/lib/apt/lists/*

# In your Dockerfile
COPY backend/requirements.lock.txt .
RUN pip install --no-cache-dir -r requirements.lock.txt

# Copy the entire backend directory into the container
COPY backend/ ./backend/

# Expose the port the app runs on
EXPOSE 8000

# Define the command to run your application
# This assumes your FastAPI application instance is named 'app' in 'backend/api.py'
CMD ["uvicorn", "backend.api:app", "--host", "0.0.0.0", "--port", "8000"] 