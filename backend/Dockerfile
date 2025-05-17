# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set environment variables for Python to prevent it from writing .pyc files to disc and to run in unbuffered mode
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies required by OpenCV (a dependency of unstructured for PDF processing)
RUN apt-get update && apt-get install -y libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# In your Dockerfile
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire backend directory into the container
COPY . ./backend/

# Expose the port the app runs on
EXPOSE 8000

# Define the command to run your application
# This assumes your FastAPI application instance is named 'app' in 'backend/api.py'
CMD ["uvicorn", "backend.api:app", "--host", "0.0.0.0", "--port", "8000"] 