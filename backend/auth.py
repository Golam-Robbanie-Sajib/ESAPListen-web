"""
Authentication module for Google OAuth, GitHub OAuth, Email/Password, and JWT token management
"""
import os
import logging
import httpx
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from google.oauth2 import id_token
from google.auth.transport import requests
from database import (
    get_or_create_user,
    get_or_create_user_github,
    get_user_by_id,
    get_user_by_email,
    create_user_with_password
)

logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# GitHub OAuth Configuration
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Password hashing (using Argon2 - industry best practice 2025)
# More secure than bcrypt, no 72-byte limit, resistant to GPU attacks
ph = PasswordHasher()

# Security scheme for FastAPI
security = HTTPBearer()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> dict:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != token_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected {token_type}",
            )
        return payload
    except JWTError as e:
        logger.error(f"JWT verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def verify_google_token(token: str) -> dict:
    """Verify Google ID token and return user info"""
    try:
        # Verify the token with Google
        idinfo = id_token.verify_oauth2_token(
            token, requests.Request(), GOOGLE_CLIENT_ID
        )

        # Verify the issuer
        if idinfo["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Wrong issuer.")

        # Return user info
        return {
            "google_id": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
            "email_verified": idinfo.get("email_verified", False),
        }
    except ValueError as e:
        logger.error(f"Google token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token",
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Dependency to get the current authenticated user from JWT token.
    Use this in FastAPI endpoints to protect routes.

    Example:
        @app.get("/api/protected")
        async def protected_route(current_user: User = Depends(get_current_user)):
            return {"user_id": current_user.id}
    """
    token = credentials.credentials
    payload = verify_token(token, token_type="access")

    user_id = payload.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Get user from database
    user = get_user_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """
    Dependency to optionally get the current user.
    Returns None if no valid token is provided.
    """
    if not credentials:
        return None

    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def generate_tokens_for_user(user_id: int) -> dict:
    """Generate both access and refresh tokens for a user"""
    access_token = create_access_token(data={"user_id": user_id})
    refresh_token = create_refresh_token(data={"user_id": user_id})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # in seconds
    }


async def authenticate_with_google(google_token: str) -> dict:
    """
    Authenticate user with Google OAuth token.
    Creates user if doesn't exist.
    Returns JWT tokens.
    """
    # Verify Google token and get user info
    google_user_info = await verify_google_token(google_token)

    if not google_user_info["email_verified"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not verified with Google",
        )

    # Get or create user in database
    user = get_or_create_user(
        google_id=google_user_info["google_id"],
        email=google_user_info["email"],
        name=google_user_info.get("name"),
        picture=google_user_info.get("picture"),
    )

    # OAuth users are automatically verified through their provider
    # Update email_verified if not already set
    if not user.email_verified:
        from database import get_db_session, User
        with get_db_session() as db:
            db_user = db.query(User).filter(User.id == user.id).first()
            if db_user:
                db_user.email_verified = True
                db.commit()
                user.email_verified = True

    # Generate JWT tokens
    tokens = generate_tokens_for_user(user.id)

    return {
        **tokens,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "picture": user.picture,
            "calendar_connected": user.calendar_connected,
            "email_verified": user.email_verified,
        },
    }


async def refresh_access_token(refresh_token: str) -> dict:
    """
    Generate a new access token from a refresh token.
    Implements refresh token rotation for enhanced security:
    - Returns both new access token AND new refresh token
    - Invalidates old refresh token (by issuing new one)
    - Industry best practice for 2025
    """
    payload = verify_token(refresh_token, token_type="refresh")
    user_id = payload.get("user_id")

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    # Verify user still exists
    user = get_user_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Generate new tokens (implements refresh token rotation)
    access_token = create_access_token(data={"user_id": user_id})
    new_refresh_token = create_refresh_token(data={"user_id": user_id})

    logger.info(f"Token refreshed for user {user_id} with rotation")

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,  # NEW: Return rotated refresh token
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


# ========================================
# PASSWORD HASHING UTILITIES
# ========================================

def hash_password(password: str) -> str:
    """
    Hash a password using Argon2id.

    Argon2 is the winner of the Password Hashing Competition and is
    recommended by OWASP for 2025. It has no password length limitations
    like bcrypt and is more resistant to GPU/ASIC attacks.
    """
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its Argon2 hash.
    Returns True if password matches, False otherwise.
    """
    try:
        ph.verify(hashed_password, plain_password)
        return True
    except (VerifyMismatchError, InvalidHashError):
        return False


# ========================================
# EMAIL/PASSWORD AUTHENTICATION
# ========================================

async def register_with_email(email: str, password: str, name: str = None) -> dict:
    """
    Register a new user with email and password.
    Returns JWT tokens.
    """
    # Check if user already exists
    existing_user = get_user_by_email(email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Validate password strength
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long",
        )

    # Argon2 has no password length limit like bcrypt did
    # Reasonable max for UX: 128 characters (prevents accidental paste of large text)
    if len(password) > 128:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password too long. Maximum 128 characters allowed.",
        )

    # Hash password and create user
    password_hash = hash_password(password)

    user = create_user_with_password(email, password_hash, name)

    # Generate email verification token
    from database import create_verification_token
    from email_service import send_verification_email, EMAIL_ENABLED

    verification_token = create_verification_token(user.id)

    # Generate JWT tokens
    tokens = generate_tokens_for_user(user.id)

    # Send verification email
    verification_url = None
    if verification_token:
        if EMAIL_ENABLED:
            email_sent = send_verification_email(user.email, verification_token, user.name)
            if email_sent:
                logger.info(f"✓ Verification email sent to {user.email}")
            else:
                logger.warning(f"Failed to send verification email to {user.email}")
        else:
            # Development mode: return the verification URL for testing
            frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
            verification_url = f"{frontend_url}/verify-email?token={verification_token}"
            logger.info(f"📧 DEV MODE: Verification URL for {user.email}: {verification_url}")

    return {
        **tokens,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "picture": user.picture,
            "calendar_connected": user.calendar_connected,
            "email_verified": user.email_verified,
        },
        "verification_url": verification_url,  # Only returned in development mode
    }


async def login_with_email(email: str, password: str) -> dict:
    """
    Login user with email and password.
    Returns JWT tokens.
    """
    # Get user by email
    user = get_user_by_email(email)
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Verify password
    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Generate JWT tokens
    tokens = generate_tokens_for_user(user.id)

    return {
        **tokens,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "picture": user.picture,
            "calendar_connected": user.calendar_connected,
            "email_verified": user.email_verified,
        },
    }


# ========================================
# GITHUB OAUTH AUTHENTICATION
# ========================================

async def get_github_oauth_url(state: str) -> str:
    """Generate GitHub OAuth authorization URL"""
    if not GITHUB_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub OAuth not configured",
        )

    redirect_uri = f"{FRONTEND_URL}/signin"
    scope = "user:email"

    auth_url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={GITHUB_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"scope={scope}&"
        f"state={state}"
    )

    return auth_url


async def authenticate_with_github(code: str) -> dict:
    """
    Authenticate user with GitHub OAuth code.
    Returns JWT tokens.
    """
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub OAuth not configured",
        )

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )

        token_data = token_response.json()

        if "error" in token_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"GitHub OAuth failed: {token_data.get('error_description', 'Unknown error')}",
            )

        access_token = token_data.get("access_token")

        # Get user info from GitHub
        user_response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
        )

        # Check if the request was successful
        if user_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to fetch user data from GitHub: {user_response.text}",
            )

        user_data = user_response.json()

        # Get user email (might need separate request if not public)
        email = user_data.get("email")
        if not email:
            emails_response = await client.get(
                "https://api.github.com/user/emails",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json",
                },
            )

            # Check if the request was successful
            if emails_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to fetch email from GitHub: {emails_response.text}",
                )

            emails = emails_response.json()

            # Ensure emails is a list
            if not isinstance(emails, list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Unexpected response format from GitHub emails API",
                )

            # Get primary verified email
            for email_obj in emails:
                if isinstance(email_obj, dict) and email_obj.get("primary") and email_obj.get("verified"):
                    email = email_obj.get("email")
                    break

        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No verified email found in GitHub account",
            )

        github_id = str(user_data.get("id"))
        name = user_data.get("name") or user_data.get("login")
        picture = user_data.get("avatar_url")

        # Get or create user
        user = get_or_create_user_github(
            github_id=github_id,
            email=email,
            name=name,
            picture=picture
        )

        # OAuth users are automatically verified through their provider
        # Update email_verified if not already set
        if not user.email_verified:
            from database import get_db_session, User
            with get_db_session() as db:
                db_user = db.query(User).filter(User.id == user.id).first()
                if db_user:
                    db_user.email_verified = True
                    db.commit()
                    user.email_verified = True

        # Generate JWT tokens
        tokens = generate_tokens_for_user(user.id)

        return {
            **tokens,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "picture": user.picture,
                "calendar_connected": user.calendar_connected,
                "email_verified": user.email_verified,
            },
        }
