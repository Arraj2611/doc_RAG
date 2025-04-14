"""
Authentication API routes.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException

from auth import (
    get_current_user, 
    UserCreate, 
    UserLogin, 
    UserResponse, 
    TokenResponse,
    register_user, 
    login_user
)

# Configure logger
logger = logging.getLogger(__name__)

# Define router
router = APIRouter()

@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    """
    Register a new user.
    
    Args:
        user_data: The user registration data
        
    Returns:
        Token response with access token and user info
    """
    try:
        return await register_user(user_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        raise HTTPException(status_code=500, detail=f"Error registering user: {str(e)}")

@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    """
    Login a user.
    
    Args:
        user_data: The user login data
        
    Returns:
        Token response with access token and user info
    """
    try:
        return await login_user(user_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error logging in user: {e}")
        raise HTTPException(status_code=500, detail=f"Error logging in user: {str(e)}")

@router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    """
    Get current user info.
    
    Args:
        user: The current user from JWT token
        
    Returns:
        User response with user info
    """
    try:
        return UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at
        )
    except Exception as e:
        logger.error(f"Error getting user info: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting user info: {str(e)}") 