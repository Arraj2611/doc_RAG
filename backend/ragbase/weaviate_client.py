"""
Weaviate client utilities for the docRAG API.
This module handles client setup, schema creation, and cleanup.
"""
import weaviate
import traceback
import logging
from weaviate.classes.init import Auth
from weaviate.classes.config import Property, DataType, Configure, Reconfigure
from typing import Optional

from .config import Config

logger = logging.getLogger(__name__)

async def setup_weaviate_client() -> Optional[weaviate.Client]:
    """
    Initialize and configure the Weaviate client.
    
    Returns:
        weaviate.Client or None: Configured client or None on failure
    """
    logger.info("Initializing Weaviate client at application startup (Remote Mode)...")
    
    if not Config.Database.WEAVIATE_URL or not Config.Database.WEAVIATE_API_KEY:
        logger.error("ERROR: WEAVIATE_URL and WEAVIATE_API_KEY must be set for Weaviate mode.")
        return None
    
    try:
        # Create Weaviate client with v4 API
        client = weaviate.connect_to_wcs(
            cluster_url=Config.Database.WEAVIATE_URL,
            auth_credentials=Auth.api_key(Config.Database.WEAVIATE_API_KEY),
        )
        logger.info("Weaviate client connected and ready.")
        
        # Schema setup
        collection_name = Config.Database.WEAVIATE_INDEX_NAME
        text_key = Config.Database.WEAVIATE_TEXT_KEY
        
        # Check if collection exists
        if not client.collections.exists(collection_name):
            logger.info(f"Weaviate collection '{collection_name}' not found. Creating with Multi-Tenancy enabled...")
            
            # Create collection with v4 API
            client.collections.create(
                name=collection_name,
                description="Stores document chunks for RAG (Multi-Tenant)",
                properties=[
                    Property(name=text_key, data_type=DataType.TEXT, description="Content chunk"),
                    Property(name="source", data_type=DataType.TEXT, description="Document source filename"),
                    Property(name="page", data_type=DataType.INT, description="Page number"),
                    Property(name="doc_type", data_type=DataType.TEXT, description="Document type"),
                    Property(name="element_index", data_type=DataType.INT, description="Index of element on page"),
                    Property(name="doc_hash", data_type=DataType.TEXT, description="Hash of the original document"),
                ],
                vectorizer_config=Configure.Vectorizer.none(),
                multi_tenancy_config=Configure.multi_tenancy(
                    enabled=True,
                    auto_tenant_creation=True
                )
            )
            logger.info(f"Weaviate collection '{collection_name}' created successfully.")
        else:
            logger.info(f"Weaviate collection '{collection_name}' already exists.")
            # Check if multi-tenancy is enabled
            try:
                collection = client.collections.get(collection_name)
                config = collection.config.get()
                
                if not config.multi_tenancy_config.enabled:
                    logger.info(f"Multi-tenancy is not enabled on collection '{collection_name}'. Manual intervention needed.")
                elif not config.multi_tenancy_config.auto_tenant_creation:
                    logger.info(f"Enabling auto-tenant creation on collection '{collection_name}'...")
                    collection.config.update(
                        multi_tenancy_config=Reconfigure.multi_tenancy(auto_tenant_creation=True)
                    )
                    logger.info(f"Auto-tenant creation enabled.")
            except Exception as e:
                logger.error(f"Error checking collection config: {e}")
        
        return client
    except Exception as e:
        logger.error(f"Error during Weaviate connection: {e}")
        traceback.print_exc()
        return None

async def close_weaviate_client(client: Optional[weaviate.Client]) -> None:
    """
    Close the Weaviate client connection.
    
    Args:
        client: The Weaviate client to close
    """
    if client and hasattr(client, 'close'):
        logger.info("Closing Weaviate client connection...")
        client.close()
        logger.info("Weaviate client closed.")
    else:
        logger.info("No Weaviate client to close.") 