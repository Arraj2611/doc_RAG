from fastapi import APIRouter, Depends, HTTPException
import logging
from typing import Dict, Any

from auth import (
    UserCreate,
    UserLogin,
    TokenResponse,
    register_user,
    login_user,
    get_current_user
)

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate) -> TokenResponse:
    """Register a new user."""
    try:
        return await register_user(user_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error during registration: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during registration")

@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin) -> TokenResponse:
    """Login a user."""
    try:
        return await login_user(user_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during login")

@router.get("/me", response_model=Dict[str, Any])
async def get_me(current_user: Any = Depends(get_current_user)):
    """Get the current user's information."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "display_name": current_user.display_name
    }
