# backend/ragbase/utils.py
import hashlib
import json
from pathlib import Path
from typing import Dict

# Need to handle potential circular import or ensure Config loads first
try:
    from .config import Config
    HASH_FILE_PATH = Path(Config.Path.PROCESSED_HASHES_FILE)
except ImportError:
    # Fallback or error handling if Config can't be imported directly
    # This might happen depending on how scripts are run.
    # A simpler approach might be to define the path directly if Config is complex.
    print("Warning: Could not import Config for HASH_FILE_PATH in utils. Assuming default path.")
    # Define a default path relative to this file or a known location
    # Adjust this default as necessary for your structure
    HASH_FILE_PATH = Path(__file__).parent.parent / "processed_hashes.json" 

def calculate_file_hash(file_path: Path) -> str:
    """Calculates the SHA256 hash of a file."""
    hasher = hashlib.sha256()
    try:
        with open(file_path, 'rb') as file:
            while True:
                chunk = file.read(4096) # Read in 4KB chunks
                if not chunk:
                    break
                hasher.update(chunk)
        return hasher.hexdigest()
    except IOError as e:
        print(f"Error reading file for hashing {file_path}: {e}")
        return "" # Return empty string or raise error on failure

def load_processed_hashes() -> Dict[str, str]:
    """Loads the dictionary of processed file hashes from the JSON file."""
    if HASH_FILE_PATH.exists():
        try:
            with open(HASH_FILE_PATH, 'r') as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
                else:
                    print(f"Warning: Hash file {HASH_FILE_PATH} does not contain a dictionary. Starting fresh.")
                    return {}
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load or parse hash file {HASH_FILE_PATH}. Starting fresh. Error: {e}")
            return {}
    return {}

def save_processed_hashes(hashes: Dict[str, str]):
    """Saves the dictionary of processed file hashes to the JSON file."""
    try:
        # Ensure the directory exists
        HASH_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(HASH_FILE_PATH, 'w') as f:
            json.dump(hashes, f, indent=4)
    except IOError as e:
        print(f"Error: Could not save hash file {HASH_FILE_PATH}. Error: {e}") 