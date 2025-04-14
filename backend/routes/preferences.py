"""
User preferences API routes.
Handles getting and setting user-specific preferences like response style.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from models.chat import SystemPromptPreference # Keep model for request body
# Import DB functions needed
from db import get_user_by_id, update_user_preferences

# Configure logger
logger = logging.getLogger(__name__)

# Define router
router = APIRouter()

# Define available system prompts locally within this module
SYSTEM_PROMPTS = {
    "concise": "You are a helpful AI assistant. Provide brief, to-the-point responses focusing only on the most relevant information.",
    "balanced": "You are a helpful AI assistant. Provide balanced responses with moderate detail and clear explanations.",
    "detailed": "You are a helpful AI assistant. Provide comprehensive, in-depth responses with thorough explanations and supporting details.",
    "simple": "You are a helpful AI assistant. Explain concepts in simple terms as if speaking to someone with no technical background. Use analogies and examples.",
    "technical": "You are a helpful AI assistant. Provide technically precise responses with proper terminology, technical details, and references to academic concepts when appropriate."
}
DEFAULT_RESPONSE_STYLE = "balanced"

@router.post("/system-prompt")
async def update_system_prompt_preference(
    preference: SystemPromptPreference,
    user_info: dict = Depends(get_current_user)
):
    """
    Update the user's response style preference in the database.
    
    Args:
        preference: The system prompt preference (user_id, response_style)
        user_info: User information from JWT (contains authenticated user ID)
        
    Returns:
        Dict with update status.
    """
    authenticated_user_id = user_info.get("id") # Beanie User object has .id
    target_user_id = preference.user_id
    new_style = preference.response_style

    # --- Authorization Check --- 
    if authenticated_user_id != target_user_id:
        logger.warning(f"Auth mismatch: User '{authenticated_user_id}' trying to update prefs for '{target_user_id}'")
        raise HTTPException(status_code=403, detail="Not authorized to update preferences for this user")
    
    # --- Validation --- 
    if new_style not in SYSTEM_PROMPTS:
        valid_styles = ", ".join(SYSTEM_PROMPTS.keys())
        logger.warning(f"Invalid response style '{new_style}' requested by user '{target_user_id}'")
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid response style. Must be one of: {valid_styles}"
        )
    
    # --- Update Database --- 
    try:
        logger.info(f"Updating preferences for user '{target_user_id}' with style: '{new_style}'")
        updated_user = await update_user_preferences(target_user_id, {"response_style": new_style})
        
        if updated_user:
            logger.info(f"Successfully updated preferences for user {target_user_id}.")
            return {
                "message": "System prompt preference updated successfully",
                "user_id": target_user_id,
                "response_style": new_style
            }
        else:
            # This case implies user_id exists but update failed, or user not found
            logger.error(f"Failed to update preferences in DB for user {target_user_id} (User might not exist or DB error).")
            # Check if user exists to give better error
            user_exists = await get_user_by_id(target_user_id)
            if not user_exists:
                raise HTTPException(status_code=404, detail="User not found.")
            else:
                 raise HTTPException(status_code=500, detail="Failed to save preferences to database.")

    except Exception as e:
        logger.error(f"Unexpected error updating preferences for user {target_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

@router.get("/system-prompt/{user_id}")
async def get_system_prompt_preference(
    user_id: str,
    user_info: dict = Depends(get_current_user)
):
    """
    Get the current system prompt preference for a user from the database.
    
    Args:
        user_id: The user ID whose preference is requested.
        user_info: User information from JWT (for authorization).
        
    Returns:
        Dict with user ID, response style, and the actual system prompt text.
    """
    authenticated_user_id = user_info.get("id") # Beanie User object has .id
    target_user_id = user_id
    
    # --- Authorization Check --- 
    if authenticated_user_id != target_user_id:
        logger.warning(f"Auth mismatch: User '{authenticated_user_id}' trying to get prefs for '{target_user_id}'")
        raise HTTPException(status_code=403, detail="Not authorized to view preferences for this user")

    # --- Fetch User from DB --- 
    try:
        db_user = await get_user_by_id(target_user_id)
        if not db_user:
            logger.warning(f"User '{target_user_id}' not found when getting preferences.")
            raise HTTPException(status_code=404, detail="User not found.")
            
        # Get the preference from the user object, default if not set
        response_style = db_user.preferences.get("response_style", DEFAULT_RESPONSE_STYLE)
        
        # Ensure the stored style is still valid, fallback if not
        if response_style not in SYSTEM_PROMPTS:
            logger.warning(f"User '{target_user_id}' has invalid stored preference '{response_style}'. Defaulting.")
            response_style = DEFAULT_RESPONSE_STYLE
            
        system_prompt_text = SYSTEM_PROMPTS[response_style]
        
        logger.info(f"Retrieved preference for user '{target_user_id}': {response_style}")
        return {
            "user_id": target_user_id,
            "response_style": response_style,
            "system_prompt": system_prompt_text
        }
        
    except HTTPException:
        raise # Re-raise specific HTTP exceptions
    except Exception as e:
        logger.error(f"Unexpected error getting preferences for user {target_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}") 