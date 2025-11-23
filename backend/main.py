# main.py - Multi-user version with authentication
import os
import json
import uvicorn
import aiofiles
import logging
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from sqlalchemy.orm import selectinload
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(module)s - %(message)s'
)
logger = logging.getLogger(__name__)

# from vad_processor import vad_processor # <-- DISABLED to prevent 403/502 crash
from transcription_service import transcriber
from llm_synthesizer import extractor, process_extraction_result
# from calendar_client import calendar_poster  # <-- DISABLED
calendar_poster = None                         # <-- DISABLED
from database import (
    init_db, save_pipeline_results, get_user_meetings, get_meeting_by_job_id,
    get_user_presets, create_user_preset, update_user_preset, delete_user_preset,
    mark_meeting_synced, update_user_name, get_db_session,
    User, Meeting, Event
)
from auth import (
    get_current_user, authenticate_with_google, refresh_access_token
)
# All 'live_recording' imports have been removed.

# Initialize database
try:
    init_db()
except Exception as e:
    logger.error("FATAL: Could not initialize database.", exc_info=True)

# Initialize FastAPI
app = FastAPI(
    title="Meeting Analysis Pipeline",
    version="2.0.0",
    description="End-to-end pipeline for batch audio processing"
)

# Configure CORS - Allow frontend requests
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "")

# Build allowed origins list
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
]

# Add production frontend URL if set
if FRONTEND_URL and FRONTEND_URL not in allowed_origins:
    allowed_origins.append(FRONTEND_URL)

# Add additional origins from environment variable (comma-separated)
if ALLOWED_ORIGINS:
    additional_origins = [origin.strip() for origin in ALLOWED_ORIGINS.split(",")]
    allowed_origins.extend(additional_origins)

logger.info(f"🌐 CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# ========================================
# QUERY RESULT PROCESSING
# ========================================

import re
from datetime import datetime, timedelta

def parse_query_result_for_events(user_input_result: dict) -> dict:
    """
    Parse user query result to extract dates, money, and other structured data.
    Returns a dict with:
      - dated_events: list of events with dates
      - notes: list of notes (budget or general)
    """
    result = {
        "dated_events": [],
        "notes": []
    }

    if not user_input_result:
        return result

    content = user_input_result.get("content") or user_input_result.get("description", "")
    if not content:
        return result

    logger.info("🔍 Parsing query result for structured data...")

    # Extract dates
    date_patterns = [
        r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',  # MM/DD/YYYY or DD-MM-YYYY
        r'(\d{4}[/-]\d{1,2}[/-]\d{1,2})',     # YYYY-MM-DD
        r'(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:,?\s+(\d{4}))?',  # Month DD, YYYY
        r'(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:,?\s+(\d{4}))?',  # DD Month YYYY
    ]

    found_dates = []
    for pattern in date_patterns:
        matches = re.finditer(pattern, content, re.IGNORECASE)
        for match in matches:
            date_str = match.group(0)
            try:
                # Try to parse the date
                parsed_date = None
                try:
                    parsed_date = datetime.strptime(date_str, '%m/%d/%Y')
                except:
                    try:
                        parsed_date = datetime.strptime(date_str, '%Y-%m-%d')
                    except:
                        try:
                            parsed_date = datetime.strptime(date_str, '%d-%m-%Y')
                        except:
                            try:
                                parsed_date = datetime.strptime(date_str, '%B %d, %Y')
                            except:
                                try:
                                    parsed_date = datetime.strptime(date_str, '%b %d, %Y')
                                except:
                                    pass

                if parsed_date:
                    # Extract context around the date (for event title)
                    start_pos = max(0, match.start() - 50)
                    end_pos = min(len(content), match.end() + 50)
                    context = content[start_pos:end_pos].strip()

                    # Try to get a meaningful title from the context
                    sentences = re.split(r'[.!?]', context)
                    title = sentences[0].strip() if sentences else "Query Result Event"
                    if len(title) > 100:
                        title = title[:97] + "..."

                    found_dates.append({
                        "date": parsed_date.strftime('%Y-%m-%d'),
                        "title": title,
                        "context": context
                    })
                    logger.info(f"   📅 Found date: {date_str} → {parsed_date.strftime('%Y-%m-%d')}")
            except Exception as e:
                logger.warning(f"   Failed to parse date: {date_str} - {e}")

    # Check for money/budget mentions
    money_patterns = [
        r'\$\s*\d+(?:,\d{3})*(?:\.\d{2})?',  # $1,000.00
        r'\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:dollars?|USD|usd)',  # 1000 dollars
        r'(?:budget|cost|expense|price|fund(?:ing)?|spend(?:ing)?|allocat(?:e|ion))',  # budget keywords
    ]

    has_money = False
    for pattern in money_patterns:
        if re.search(pattern, content, re.IGNORECASE):
            has_money = True
            logger.info(f"   💰 Detected money/budget mention")
            break

    # Create events from dates
    for date_info in found_dates:
        result["dated_events"].append({
            "title": date_info["title"],
            "date": date_info["date"],
            "description": f"From query: {date_info['context']}",
            "synced": False,
            "urgency": "no",
            "completed": False
        })

    # Create note based on content
    if has_money:
        result["notes"].append({
            "category": "BUDGET",
            "title": "Budget Information (Additional Analysis)",
            "description": content,
            "urgency": "no",
            "completed": False
        })
        logger.info("   📝 Created BUDGET note from query")
    else:
        result["notes"].append({
            "category": "GENERAL",
            "title": "Additional Analysis",
            "description": content,
            "urgency": "no",
            "completed": False
        })
        logger.info("   📝 Created GENERAL note from query")

    logger.info(f"   ✓ Extracted {len(result['dated_events'])} events and {len(result['notes'])} notes from query")
    return result

# ========================================
# PROGRESS TRACKING SYSTEM
# ========================================

# In-memory job status tracker
job_statuses: Dict[str, Dict] = {}

def init_job_status(job_id: str, config: Dict):
    """Initialize job status tracking"""
    job_statuses[job_id] = {
        "status": "processing",
        "overall_progress": 0,
        "config": config,
        "stages": {
            "vad": {"status": "pending", "progress": 0, "time": None, "error": None},
            "enhancement": {"status": "pending", "progress": 0, "time": None, "error": None},
            "transcription": {"status": "pending", "progress": 0, "time": None, "error": None},
            "diarization": {"status": "pending", "progress": 0, "time": None, "error": None},
            "extraction": {"status": "pending", "progress": 0, "time": None, "error": None},
            "calendar": {"status": "pending", "progress": 0, "time": None, "error": None},
        },
        "result": None,
        "error": None
    }

def update_stage(job_id: str, stage: str, status: str, progress: int = 0, time: float = None, error: str = None):
    """Update a specific stage's status"""
    if job_id in job_statuses:
        job_statuses[job_id]["stages"][stage] = {
            "status": status,
            "progress": progress,
            "time": time,
            "error": error
        }
        # Recalculate overall progress
        calculate_overall_progress(job_id)
        logger.info(f"Job {job_id}: {stage} -> {status} ({progress}%)")

def calculate_overall_progress(job_id: str):
    """Calculate overall progress based on stage weights"""
    stage_weights = {
        "vad": 5,
        "enhancement": 5,
        "transcription": 40,
        "diarization": 30,
        "extraction": 15,
        "calendar": 5
    }
    
    total_progress = 0
    if job_id not in job_statuses:
        return
        
    stages = job_statuses[job_id]["stages"]
    
    for stage, weight in stage_weights.items():
        if stages.get(stage, {}).get("status") == "complete":
            total_progress += weight
        elif stages.get(stage, {}).get("status") == "in_progress":
            total_progress += weight * (stages.get(stage, {}).get("progress", 0) / 100)
    
    job_statuses[job_id]["overall_progress"] = min(100, int(total_progress))

def mark_job_complete(job_id: str, result: Dict):
    """Mark job as complete with final result"""
    if job_id in job_statuses:
        job_statuses[job_id]["status"] = "completed"
        job_statuses[job_id]["overall_progress"] = 100
        job_statuses[job_id]["result"] = result

def mark_job_failed(job_id: str, error: str):
    """Mark job as failed"""
    if job_id in job_statuses:
        job_statuses[job_id]["status"] = "failed"
        job_statuses[job_id]["error"] = error

# ========================================
# PYDANTIC MODELS
# ========================================

class ProcessingConfig(BaseModel):
    """User configuration for processing"""
    role: Optional[str] = "Custom"
    output_fields: Dict[str, bool] = {
        "transcript": True,
        "summary_english": True,
        "summary_arabic": True,
        "action_items": True,
        "deadlines": True,
        "calendar_sync": True,
        "budget_notes": True,
        "decisions": True,
        "general_notes": True
    }
    user_input: Optional[str] = None
    custom_field_only: Optional[bool] = False

class PipelineResponse(BaseModel):
    job_id: str
    status: str
    diarized_transcript: str
    summarized_chunks: List[str]
    merged_summary: str
    final_summary: Dict
    events: List[Dict]
    notes: List[Dict]
    calendar_event_links: Optional[List[str]] = None
    user_requested_data: Optional[Dict] = None

class JobStatusResponse(BaseModel):
    """Real-time job status"""
    job_id: str
    status: str  # processing, completed, failed
    overall_progress: int
    stages: Dict
    error: Optional[str] = None

# ========================================
# MAIN PROCESSING ENDPOINT
# ========================================

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/", include_in_schema=False)
async def root():
    """
    Redirect root to the API docs.
    """
    return {"message": "API is ALIVE AND WATCHING!"}

# ========================================
# AUTHENTICATION ENDPOINTS
# ========================================

class GoogleAuthRequest(BaseModel):
    """Google OAuth token from frontend"""
    token: str

class RefreshTokenRequest(BaseModel):
    """Refresh token request"""
    refresh_token: str

@app.post("/api/auth/google", tags=["Authentication"])
async def google_auth(auth_request: GoogleAuthRequest):
    """
    Authenticate with Google OAuth token.
    Frontend sends Google ID token, backend verifies and returns JWT tokens.
    """
    try:
        result = await authenticate_with_google(auth_request.token)
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Google auth failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/refresh", tags=["Authentication"])
async def refresh_token(refresh_request: RefreshTokenRequest):
    """
    Refresh access token using refresh token.
    """
    try:
        result = await refresh_access_token(refresh_request.refresh_token)
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Token refresh failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/me", tags=["Authentication"])
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information.
    Requires valid JWT token in Authorization header.
    """
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "picture": current_user.picture,
        "calendar_connected": current_user.calendar_connected,
    }

class UpdateProfileRequest(BaseModel):
    """Request to update user profile"""
    name: str

@app.patch("/api/auth/profile", tags=["Authentication"])
async def update_profile(
    profile_data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Update user profile (currently supports name update).
    Requires valid JWT token in Authorization header.
    """
    updated_user = update_user_name(current_user.id, profile_data.name)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")

    return updated_user

class EmailRegisterRequest(BaseModel):
    """Email/password registration request"""
    email: str
    password: str
    name: Optional[str] = None

class EmailLoginRequest(BaseModel):
    """Email/password login request"""
    email: str
    password: str

class GitHubAuthRequest(BaseModel):
    """GitHub OAuth code from frontend"""
    code: str

class ForgotPasswordRequest(BaseModel):
    """Request password reset email"""
    email: str

class ResetPasswordRequest(BaseModel):
    """Reset password with token"""
    token: str
    new_password: str

class VerifyEmailRequest(BaseModel):
    """Verify email with token"""
    token: str

class ResendVerificationRequest(BaseModel):
    """Resend email verification"""
    email: str

@app.post("/api/auth/register", tags=["Authentication"])
async def register_email(register_request: EmailRegisterRequest):
    """
    Register with email and password.
    Password must be at least 8 characters and no more than 128 characters.
    Uses Argon2 for secure password hashing (industry best practice 2025).
    """
    from auth import register_with_email
    try:
        result = await register_with_email(
            email=register_request.email,
            password=register_request.password,
            name=register_request.name
        )
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Email registration failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Registration failed. Please try again.")

@app.post("/api/auth/login", tags=["Authentication"])
async def login_email(login_request: EmailLoginRequest):
    """
    Login with email and password.
    Returns JWT tokens on successful authentication.
    """
    from auth import login_with_email
    try:
        result = await login_with_email(
            email=login_request.email,
            password=login_request.password
        )
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Email login failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/github/url", tags=["Authentication"])
async def get_github_auth_url():
    """
    Get GitHub OAuth authorization URL.
    Frontend redirects user to this URL for authentication.
    """
    from auth import get_github_oauth_url
    import secrets
    try:
        state = secrets.token_urlsafe(32)
        auth_url = await get_github_oauth_url(state)
        return {"authorization_url": auth_url, "state": state}
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Failed to generate GitHub auth URL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/github", tags=["Authentication"])
async def github_auth(auth_request: GitHubAuthRequest):
    """
    Authenticate with GitHub OAuth code.
    Frontend sends code after user authorizes, backend exchanges for user info and returns JWT tokens.
    """
    from auth import authenticate_with_github
    try:
        result = await authenticate_with_github(auth_request.code)
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"GitHub auth failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/forgot-password", tags=["Authentication"])
async def forgot_password(request: ForgotPasswordRequest):
    """
    Request password reset. Generates a reset token and sends email to user.
    """
    from database import create_password_reset_token
    from email_service import send_password_reset_email, EMAIL_ENABLED

    try:
        # Generate reset token
        reset_token = create_password_reset_token(request.email)

        if reset_token:
            logger.info(f"Password reset requested for {request.email}")

            # Send password reset email
            if EMAIL_ENABLED:
                email_sent = send_password_reset_email(request.email, reset_token)
                if email_sent:
                    logger.info(f"✓ Password reset email sent to {request.email}")
                    return {
                        "message": "If an account exists with this email, you will receive a password reset link."
                    }
                else:
                    logger.warning(f"Failed to send password reset email to {request.email}")
                    # Still return success for security, but log the failure
                    return {
                        "message": "If an account exists with this email, you will receive a password reset link."
                    }
            else:
                # Development mode: return the reset URL for testing
                reset_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token={reset_token}"
                logger.info(f"📧 DEV MODE: Password reset URL for {request.email}: {reset_url}")
                return {
                    "message": "If an account exists with this email, you will receive a password reset link.",
                    "reset_url": reset_url  # Only in development mode
                }
        else:
            # Still return success message for security (don't reveal if email doesn't exist)
            return {
                "message": "If an account exists with this email, you will receive a password reset link."
            }
    except Exception as e:
        logger.error(f"Forgot password failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process password reset request")

@app.post("/api/auth/reset-password", tags=["Authentication"])
async def reset_password(request: ResetPasswordRequest):
    """
    Reset password using valid token.
    """
    from database import verify_reset_token, reset_password_with_token
    from argon2 import PasswordHasher
    from argon2.exceptions import Argon2Error

    try:
        # Validate password length
        if len(request.new_password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
        if len(request.new_password) > 128:
            raise HTTPException(status_code=400, detail="Password is too long. Maximum is 128 characters.")

        # Verify token is valid
        email = verify_reset_token(request.token)
        if not email:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")

        # Hash new password
        ph = PasswordHasher()
        password_hash = ph.hash(request.new_password)

        # Reset password
        success = reset_password_with_token(request.token, password_hash)

        if success:
            logger.info(f"Password reset successfully for {email}")
            return {"message": "Password reset successfully. You can now sign in with your new password."}
        else:
            raise HTTPException(status_code=400, detail="Failed to reset password. Token may be invalid or expired.")

    except HTTPException as e:
        raise e
    except Argon2Error as e:
        logger.error(f"Password hashing failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process password reset")
    except Exception as e:
        logger.error(f"Password reset failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to reset password")

@app.post("/api/auth/verify-email", tags=["Authentication"])
async def verify_email(request: VerifyEmailRequest):
    """
    Verify user's email with token.
    """
    from database import verify_email_with_token
    try:
        success = verify_email_with_token(request.token)

        if success:
            logger.info(f"Email verified successfully with token")
            return {
                "message": "Email verified successfully! You can now use all features.",
                "verified": True
            }
        else:
            raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Email verification failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to verify email")

@app.post("/api/auth/resend-verification", tags=["Authentication"])
async def resend_verification(request: ResendVerificationRequest):
    """
    Resend email verification link.
    """
    from database import resend_verification_token, get_user_by_email
    from email_service import send_verification_email, EMAIL_ENABLED

    try:
        result = resend_verification_token(request.email)

        if result == "already_verified":
            return {
                "message": "This email is already verified."
            }
        elif result:
            logger.info(f"Resending verification email to {request.email}")

            # Send verification email
            if EMAIL_ENABLED:
                user = get_user_by_email(request.email)
                user_name = user.get('name') if user else None
                email_sent = send_verification_email(request.email, result, user_name)

                if email_sent:
                    logger.info(f"✓ Verification email sent to {request.email}")
                    return {
                        "message": "Verification email sent. Please check your inbox."
                    }
                else:
                    logger.warning(f"Failed to send verification email to {request.email}")
                    return {
                        "message": "Verification email sent. Please check your inbox."
                    }
            else:
                # Development mode: return the verification URL for testing
                verification_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/verify-email?token={result}"
                logger.info(f"📧 DEV MODE: Verification URL for {request.email}: {verification_url}")
                return {
                    "message": "Verification email sent. Please check your inbox.",
                    "verification_url": verification_url  # Only in development mode
                }
        else:
            # Don't reveal if email exists for security
            return {
                "message": "If an account exists with this email, a verification link has been sent."
            }

    except Exception as e:
        logger.error(f"Resend verification failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to resend verification email")

@app.post("/api/process-audio", response_model=Dict, tags=["Main Pipeline"])
async def process_audio(
    file: UploadFile = File(...),
    config: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """
    Processes uploaded audio with user configuration.
    Returns job_id immediately, processing happens in background.
    Requires authentication.
    """
    import asyncio

    # Parse config
    processing_config = ProcessingConfig()  # Start with defaults

    if config:
        try:
            user_config = json.loads(config)
            processing_config = ProcessingConfig(**user_config)
            logger.info(f"   Parsed config: {processing_config.dict()}")
        except Exception as e:
            logger.warning(f"   Failed to parse config: {e}, using defaults")
    else:
        logger.info("   No config provided, using defaults")

    # Create user-scoped job_id
    job_id = f"user{current_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    logger.info(f"🚀 Starting pipeline job: {job_id} for user {current_user.email}")
    
    upload_path = os.path.join(UPLOAD_DIR, job_id)
    
    # Initialize job tracking
    init_job_status(job_id, processing_config.dict())
    
    # Save file
    try:
        async with aiofiles.open(upload_path, 'wb') as f:
            await f.write(await file.read())
        logger.info(f"   ✓ File saved: {upload_path}")
    except Exception as e:
        mark_job_failed(job_id, f"File save failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
    # Start background processing
    asyncio.create_task(process_audio_background(job_id, upload_path, processing_config, current_user.id))

    # Return job_id immediately with explicit headers to prevent IDM interference
    return JSONResponse(
        content={
            "job_id": job_id,
            "status": "processing",
            "message": "Processing started. Use /api/job/{job_id}/status to track progress."
        },
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff"
        }
    )

async def process_audio_background(job_id: str, upload_path: str, config: ProcessingConfig, user_id: int):
    """Background task that processes audio and updates status"""
    from time import time as current_time

    # Track overall processing time
    pipeline_start_time = current_time()
    audio_duration_seconds = None

    # Get audio duration from file
    try:
        from mutagen import File as MutagenFile
        audio_file = MutagenFile(upload_path)
        if audio_file and audio_file.info:
            audio_duration_seconds = int(audio_file.info.length)
            logger.info(f"   ✓ Audio duration: {audio_duration_seconds} seconds ({audio_duration_seconds / 60:.1f} minutes)")
    except Exception as e:
        logger.warning(f"   ⚠️ Could not extract audio duration: {e}")

    try:
        # --- VAD STEP BYPASSED ---
        logger.info(f"Job {job_id}: Bypassing local VAD.")
        update_stage(job_id, "vad", "complete", 100, 0.0)
        update_stage(job_id, "enhancement", "complete", 100, 0.0)
        # --- END BYPASS ---
        
        # Stage 3: Transcription
        update_stage(job_id, "transcription", "in_progress", 30)
        if transcriber is None:
            raise Exception("Transcriber not configured. Check .env and dependencies.")
        
        start_time = current_time()
        
        # --- MODIFIED CALL ---
        # We call 'transcribe_file' and pass the path, not the tensor
        segments = await transcriber.transcribe_file(upload_path)
        # --- END MODIFICATION ---

        transcription_time = current_time() - start_time
        
        if not segments:
            diarized_transcript_text = "Transcription failed or no speech found."
        else:
            diarized_transcript_text = "\n\n".join([seg.to_text() for seg in segments])
        
        update_stage(job_id, "transcription", "complete", 100, transcription_time)
        
        # Stage 4: Diarization (Done by AssemblyAI)
        update_stage(job_id, "diarization", "complete", 100, 0)
        
        # Stage 5: Extraction
        update_stage(job_id, "extraction", "in_progress", 40)
        start_time = current_time()
        
        if extractor is None:
            raise Exception("Extractor not configured. Check .env and dependencies.")
            
        text_for_extraction = diarized_transcript_text

        user_input  = config.user_input

        # Convert config to dict for extractor
        config_dict = {
            'output_fields': config.output_fields
        }

        extracted_data = await asyncio.to_thread(
            extractor.extract_events,
            text_for_extraction,
            user_input,
            config_dict
            )

        # Post-process extraction: sort events by date and format dates
        extracted_data = process_extraction_result(extracted_data)

        extraction_time = current_time() - start_time

        # Handle both old and new field names for backward compatibility
        summary_object = extracted_data.get("key_takeaways") or extracted_data.get("final_summary", {})
        dated_events = extracted_data.get("dated_events", [])
        notes_for_db = extracted_data.get("notes", [])
        user_input_result = extracted_data.get("user_requested_data")
        if config.custom_field_only:
            logger.info("🎯 Custom-field-only mode: Processing query result for structured data")
            summary_object = {
                "english": "Custom-field-only mode: Standard summary skipped",
                "arabic": "Custom-field-only mode: Standard summary skipped"
            }
            # Parse query result to extract dates, money, and other info
            parsed_query_data = parse_query_result_for_events(user_input_result)
            dated_events = parsed_query_data.get("dated_events", [])
            notes_for_db = parsed_query_data.get("notes", [])
            logger.info(f"   ✓ From query: {len(dated_events)} events, {len(notes_for_db)} notes")

        update_stage(job_id, "extraction", "complete", 100, extraction_time)

        # Stage 6: Database + Calendar
        update_stage(job_id, "calendar", "in_progress", 50)

        # Save to database
        try:
            all_extracted_items = {
                "dated_events": dated_events,
                "notes": notes_for_db
            }

            # Calculate total processing time
            total_processing_time = int(current_time() - pipeline_start_time)
            logger.info(f"   ✓ Total processing time: {total_processing_time} seconds ({total_processing_time / 60:.1f} minutes)")

            await asyncio.to_thread(
                save_pipeline_results,
                job_id=job_id,
                user_id=user_id,
                raw_transcript=diarized_transcript_text,
                final_summary=summary_object,  # Just the summary, not events
                extracted_events=all_extracted_items,  # Events saved separately in Event table
                user_input=user_input,
                user_input_result=user_input_result,
                audio_duration=audio_duration_seconds,
                processing_time=total_processing_time
            )
        except Exception as e:
            logger.error(f"Database save failed: {e}", exc_info=True)

        # Automatic calendar sync if enabled
        calendar_event_links = []
        calendar_sync_enabled = config.output_fields.get("calendar_sync", False)

        logger.info(f"📋 Calendar sync config check:")
        logger.info(f"   - config.output_fields = {config.output_fields}")
        logger.info(f"   - calendar_sync_enabled = {calendar_sync_enabled}")
        logger.info(f"   - dated_events_count = {len(dated_events)}")
        if dated_events:
            logger.info(f"   - dated_events sample: {dated_events[0] if dated_events else 'None'}")
        else:
            logger.warning(f"   ⚠️  No dated events extracted from meeting!")

        if calendar_sync_enabled and dated_events:
            logger.info(f"🗓️  Automatic calendar sync enabled for job {job_id}")
            try:
                # Get user with calendar tokens from database
                from database import get_db_session

                # Add a small delay to ensure database commit is complete
                import time
                time.sleep(0.5)

                with get_db_session() as db:
                    user = db.query(User).filter(User.id == user_id).first()

                    if not user:
                        logger.error(f"❌ User {user_id} not found for calendar sync")
                    elif not user.calendar_connected:
                        logger.warning(f"⚠️  Calendar sync enabled but user calendar not connected. Please connect calendar in Settings.")
                    else:
                        logger.info(f"✓ User has calendar connected, syncing {len(dated_events)} events")

                        # Create calendar client with user's OAuth tokens
                        calendar_client = GoogleCalendarOAuth(
                            access_token=user.calendar_access_token,
                            refresh_token=user.calendar_refresh_token,
                            token_expiry=user.calendar_token_expiry
                        )

                        # Create calendar events
                        logger.info(f"📤 Sending {len(dated_events)} events to Google Calendar...")
                        calendar_event_links = calendar_client.create_events_from_extraction(
                            {"dated_events": dated_events}
                        )
                        logger.info(f"✓ Received {len(calendar_event_links)} event links from Google Calendar")

                        # Mark individual events as synced in database
                        meeting = db.query(Meeting).filter(
                            Meeting.job_id == job_id,
                            Meeting.user_id == user_id
                        ).first()

                        if meeting:
                            synced_count = 0
                            for i, event in enumerate(meeting.events):
                                if event.event_type == "dated_events":
                                    event_data = json.loads(event.event_data)
                                    event_data['synced'] = True
                                    event_data['calendar_link'] = calendar_event_links[i] if i < len(calendar_event_links) else None
                                    event.event_data = json.dumps(event_data)
                                    synced_count += 1
                            db.commit()
                            logger.info(f"✓ Marked {synced_count} events as synced in database")
                        else:
                            logger.error(f"❌ Meeting {job_id} not found in database after save!")

                        # Update tokens if they were refreshed
                        updated_tokens = calendar_client.get_updated_tokens()
                        if updated_tokens:
                            update_user_calendar_tokens(
                                user_id=user_id,
                                access_token=updated_tokens['access_token'],
                                refresh_token=updated_tokens['refresh_token'],
                                expiry=updated_tokens['expiry']
                            )
                            logger.info("✓ Updated user calendar tokens")

                        # Mark meeting as synced
                        mark_meeting_synced(job_id, user_id)

                        logger.info(f"✅ Successfully created {len(calendar_event_links)} calendar events!")

            except Exception as e:
                # Don't fail the entire job if calendar sync fails
                logger.error(f"❌ Calendar sync failed (job will still complete): {e}", exc_info=True)
                logger.error(f"   Error type: {type(e).__name__}")
                logger.error(f"   Error details: {str(e)}")
                calendar_event_links = []
        elif not calendar_sync_enabled:
            logger.info(f"ℹ️  Calendar sync checkbox not enabled in config")
        elif not dated_events:
            logger.info(f"ℹ️  No dated events to sync to calendar")

        update_stage(job_id, "calendar", "complete", 100, 1.0)
        
        # Mark job complete
        result = PipelineResponse(
            job_id=job_id,
            status="completed",
            diarized_transcript=diarized_transcript_text,
            summarized_chunks=[],
            merged_summary="Summarization bypassed",
            final_summary=summary_object,
            events=dated_events,
            notes=notes_for_db,
            calendar_event_links=calendar_event_links,
            user_requested_data=user_input_result
        )
        
        mark_job_complete(job_id, result.dict())
        logger.info(f"✅ Job {job_id} completed successfully")
        
    except Exception as e:
        error_msg = f"Pipeline failed: {str(e)}"
        logger.error(f"❌ Job {job_id} failed: {error_msg}", exc_info=True)
        mark_job_failed(job_id, error_msg)
        
        # Mark current stage as failed
        if job_id in job_statuses:
            for stage_name, stage_data in job_statuses[job_id]["stages"].items():
                if stage_data["status"] == "in_progress":
                    update_stage(job_id, stage_name, "failed", 0, None, error_msg)
                    break
    
    finally:
        # Cleanup
        if os.path.exists(upload_path):
            try:
                os.remove(upload_path)
                logger.info(f"   🧹 Cleaned up: {upload_path}")
            except Exception as e:
                logger.warning(f"   ⚠️ Failed to clean up {upload_path}: {e}")

# ========================================
# STATUS ENDPOINT (FOR POLLING)
# ========================================

@app.get("/api/job/{job_id}/status", response_model=JobStatusResponse, tags=["Status"])
async def get_job_status(job_id: str, current_user: User = Depends(get_current_user)):
    """
    Get current status of a processing job.
    Frontend polls this endpoint every 2 seconds.
    Verifies user ownership.
    """
    # Verify job belongs to user
    if not job_id.startswith(f"user{current_user.id}_"):
        raise HTTPException(status_code=403, detail="Access denied")

    if job_id not in job_statuses:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    status_data = job_statuses[job_id]

    return JobStatusResponse(
        job_id=job_id,
        status=status_data["status"],
        overall_progress=status_data["overall_progress"],
        stages=status_data["stages"],
        error=status_data.get("error")
    )

@app.get("/api/job/{job_id}/result", response_model=PipelineResponse, tags=["Status"])
async def get_job_result(job_id: str, current_user: User = Depends(get_current_user)):
    """
    Get final result of a completed job.
    Only returns data when status is 'completed'.
    Verifies user ownership.
    """
    # Verify job belongs to user
    if not job_id.startswith(f"user{current_user.id}_"):
        raise HTTPException(status_code=403, detail="Access denied")

    if job_id not in job_statuses:
        raise HTTPException(
            status_code=404,
            detail=f"Job {job_id} not found"
            )

    status_data = job_statuses[job_id]
    
    if status_data["status"] != "completed":
        raise HTTPException(
            status_code=400, 
            detail=f"Job is still {status_data['status']}. Check /api/job/{job_id}/status"
        )
    
    if "user_requested_data" not in status_data["result"]:
        status_data["result"]["user_requested_data"] = None
    
    return PipelineResponse(**status_data["result"])

# ========================================
# MEETING HISTORY ENDPOINTS
# ========================================

class MeetingListResponse(BaseModel):
    """Response for meeting list"""
    meetings: List[Dict]
    total: int

@app.get("/api/meetings", response_model=MeetingListResponse, tags=["Meetings"])
async def get_meetings(
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """
    Get all meetings for the current user.
    Returns paginated list sorted by creation date (newest first).
    """
    meetings = get_user_meetings(current_user.id, limit, offset)

    meetings_list = []
    for meeting in meetings:
        # Parse JSON fields
        final_summary = json.loads(meeting.final_summary) if meeting.final_summary else {}
        user_input_result = json.loads(meeting.user_input_result) if meeting.user_input_result else None

        # Parse events from Event table
        events_list = []
        if meeting.events:
            for event in meeting.events:
                event_data = json.loads(event.event_data)
                events_list.append({
                    "id": event.id,
                    "meeting_id": meeting.id,
                    "event_type": event.event_type,
                    "event_data": event_data
                })

        # Create summary preview for history page
        summary_preview = final_summary.get("english", "")[:200] if final_summary.get("english") else ""

        meetings_list.append({
            "job_id": meeting.job_id,
            "created_at": meeting.created_at.isoformat(),
            "final_summary": final_summary,
            "user_input": meeting.user_input,
            "user_input_result": user_input_result,
            "calendar_synced": meeting.calendar_synced if hasattr(meeting, 'calendar_synced') else False,
            "events": events_list,  # Include events array
            "summary_preview": summary_preview,  # For history page
            "event_count": len(events_list),  # For history page
            "has_custom_query": meeting.user_input is not None,  # For history page
        })

    return MeetingListResponse(
        meetings=meetings_list,
        total=len(meetings_list)
    )

@app.get("/api/meetings/{job_id}", tags=["Meetings"])
async def get_meeting_details(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get full details of a specific meeting.
    Verifies user ownership.
    """
    meeting = get_meeting_by_job_id(job_id, current_user.id)

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Parse JSON fields
    final_summary = json.loads(meeting.final_summary) if meeting.final_summary else {}
    user_input_result = json.loads(meeting.user_input_result) if meeting.user_input_result else None

    # Parse events - include event IDs for completion toggling
    events_by_type = {"dated_events": [], "notes": []}
    for event in meeting.events:
        event_data = json.loads(event.event_data)
        # Include event ID and completion status with the data
        event_with_id = {
            "id": event.id,
            **event_data
        }
        events_by_type[event.event_type].append(event_with_id)

    return {
        "job_id": meeting.job_id,
        "created_at": meeting.created_at.isoformat(),
        "raw_transcript": meeting.raw_transcript,
        "final_summary": final_summary,
        "dated_events": events_by_type["dated_events"],
        "notes": events_by_type["notes"],
        "user_input": meeting.user_input,
        "user_input_result": user_input_result,
        "calendar_synced": meeting.calendar_synced if hasattr(meeting, 'calendar_synced') else False,
    }

@app.delete("/api/meetings/{job_id}", tags=["Meetings"])
async def delete_meeting(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete a meeting.
    Verifies user ownership.
    """
    from database import get_db_session, Meeting

    with get_db_session() as db:
        meeting = db.query(Meeting).filter(
            Meeting.job_id == job_id,
            Meeting.user_id == current_user.id
        ).first()

        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")

        db.delete(meeting)
        db.commit()

    return {"message": "Meeting deleted successfully"}

# ========================================
# MANUAL NOTE CREATION ENDPOINTS
# ========================================

class CreateNoteRequest(BaseModel):
    """Request to create a manual note"""
    title: str
    description: str
    category: str  # BUDGET, DECISION, or GENERAL

@app.post("/api/meetings/{job_id}/notes", tags=["Meetings"])
async def create_manual_note(
    job_id: str,
    note_request: CreateNoteRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Create a manual note for a meeting.
    Verifies user ownership of the meeting.
    """
    from database import get_db_session, Meeting, Event

    # Validate category
    valid_categories = ["BUDGET", "DECISION", "GENERAL"]
    if note_request.category.upper() not in valid_categories:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}"
        )

    with get_db_session() as db:
        # Verify meeting exists and belongs to user
        meeting = db.query(Meeting).filter(
            Meeting.job_id == job_id,
            Meeting.user_id == current_user.id
        ).first()

        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")

        # Create note data
        note_data = {
            "category": note_request.category.upper(),
            "title": note_request.title,
            "description": note_request.description,
            "manual": True,  # Flag to indicate this is a manually created note
        }

        # Save to Event table
        new_event = Event(
            meeting_id=meeting.id,
            event_type="notes",
            event_data=json.dumps(note_data)
        )
        db.add(new_event)
        db.commit()
        db.refresh(new_event)

        logger.info(f"✓ Created manual note for meeting {job_id}: {note_request.title}")

        return {
            "message": "Note created successfully",
            "note": {
                "id": new_event.id,
                "meeting_id": meeting.id,
                "event_type": "notes",
                "event_data": note_data
            }
        }

# ========================================
# TASK COMPLETION ENDPOINTS
# ========================================

class ToggleTaskRequest(BaseModel):
    """Request to toggle task completion status"""
    completed: bool

@app.patch("/api/events/{event_id}/toggle-complete", tags=["Meetings"])
async def toggle_task_completion(
    event_id: int,
    request: ToggleTaskRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Toggle task/event completion status.
    Updates the 'completed' field in event_data JSON.
    """
    from database import get_db_session, Meeting, Event

    with get_db_session() as db:
        # Get event and verify ownership through meeting
        event = db.query(Event).filter(Event.id == event_id).first()

        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        # Verify user owns the meeting
        meeting = db.query(Meeting).filter(
            Meeting.id == event.meeting_id,
            Meeting.user_id == current_user.id
        ).first()

        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found or access denied")

        # Update completion status in event_data JSON
        event_data = json.loads(event.event_data)
        event_data['completed'] = request.completed
        event.event_data = json.dumps(event_data)

        db.commit()

        logger.info(f"✓ Updated event {event_id} completion status to {request.completed}")

        return {
            "message": "Task completion status updated",
            "event_id": event_id,
            "completed": request.completed
        }

@app.delete("/api/events/{event_id}", tags=["Meetings"])
async def delete_event(
    event_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Delete an event/task.
    """
    from database import get_db_session, Meeting, Event

    with get_db_session() as db:
        # Get event and verify ownership through meeting
        event = db.query(Event).filter(Event.id == event_id).first()

        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        # Verify user owns the meeting
        meeting = db.query(Meeting).filter(
            Meeting.id == event.meeting_id,
            Meeting.user_id == current_user.id
        ).first()

        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found or access denied")

        # Delete the event
        db.delete(event)
        db.commit()

        logger.info(f"✓ Deleted event {event_id}")

        return {
            "message": "Event deleted successfully",
            "event_id": event_id
        }

@app.delete("/api/notes/{note_id}", tags=["Meetings"])
async def delete_note(
    note_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Delete a note.
    """
    from database import get_db_session, Meeting, Event

    with get_db_session() as db:
        # Get note and verify ownership through meeting
        note = db.query(Event).filter(
            Event.id == note_id,
            Event.event_type == 'notes'
        ).first()

        if not note:
            raise HTTPException(status_code=404, detail="Note not found")

        # Verify user owns the meeting
        meeting = db.query(Meeting).filter(
            Meeting.id == note.meeting_id,
            Meeting.user_id == current_user.id
        ).first()

        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found or access denied")

        # Delete the note
        db.delete(note)
        db.commit()

        logger.info(f"✓ Deleted note {note_id}")

        return {
            "message": "Note deleted successfully",
            "note_id": note_id
        }

# ========================================
# DEBUG ENDPOINT (Temporary - for checking duration data)
# ========================================

@app.get("/api/debug/meetings", tags=["Debug"])
async def debug_meetings(current_user: User = Depends(get_current_user)):
    """
    Debug endpoint to check meeting duration data.
    Shows audio_duration and processing_time for all meetings.
    """
    with get_db_session() as db:
        meetings = db.query(Meeting).filter(
            Meeting.user_id == current_user.id
        ).all()

        debug_data = []
        for m in meetings:
            debug_data.append({
                "job_id": m.job_id,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "audio_duration": m.audio_duration,
                "processing_time": m.processing_time,
                "has_duration": m.audio_duration is not None,
                "has_processing_time": m.processing_time is not None,
            })

        return {
            "total_meetings": len(meetings),
            "meetings": debug_data,
            "summary": {
                "with_audio_duration": sum(1 for m in meetings if m.audio_duration is not None),
                "with_processing_time": sum(1 for m in meetings if m.processing_time is not None),
            }
        }

# ========================================
# ANALYTICS ENDPOINT
# ========================================

@app.get("/api/analytics", tags=["Analytics"])
async def get_analytics(
    current_user: User = Depends(get_current_user)
):
    """
    Get analytics data for the current user.
    Returns meeting statistics, event counts, and other metrics.
    """
    with get_db_session() as db:
        # Get all meetings for user
        meetings = db.query(Meeting).filter(
            Meeting.user_id == current_user.id
        ).options(selectinload(Meeting.events)).all()

        total_meetings = len(meetings)

        # Calculate total events (dated_events only)
        total_events = 0
        total_notes = 0
        for meeting in meetings:
            for event in meeting.events:
                if event.event_type == "dated_events":
                    total_events += 1
                elif event.event_type == "notes":
                    total_notes += 1

        # Calculate duration statistics (only for meetings with duration data)
        meetings_with_duration = [m for m in meetings if m.audio_duration is not None and m.audio_duration > 0]
        avg_duration = 0
        total_audio_duration = 0
        if meetings_with_duration:
            total_audio_duration = sum(m.audio_duration for m in meetings_with_duration)
            avg_duration = total_audio_duration / len(meetings_with_duration)

        # Calculate average processing time
        meetings_with_processing_time = [m for m in meetings if m.processing_time is not None]
        avg_processing_time = 0
        if meetings_with_processing_time:
            avg_processing_time = sum(m.processing_time for m in meetings_with_processing_time) / len(meetings_with_processing_time)

        # Get meetings by date (last 30 days)
        from datetime import datetime, timedelta, timezone
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        recent_meetings = [m for m in meetings if m.created_at >= thirty_days_ago]

        # Calendar sync stats
        calendar_synced_count = sum(1 for m in meetings if m.calendar_synced)

        # Get user creation date for account age
        account_created_at = current_user.created_at.isoformat() if current_user.created_at else None

        return {
            "total_meetings": total_meetings,
            "total_events": total_events,
            "total_notes": total_notes,
            "avg_duration_seconds": int(avg_duration),
            "total_audio_duration_seconds": int(total_audio_duration),
            "meetings_with_audio_duration": len(meetings_with_duration),
            "avg_processing_time_seconds": int(avg_processing_time),
            "meetings_last_30_days": len(recent_meetings),
            "calendar_synced_meetings": calendar_synced_count,
            "calendar_connected": current_user.calendar_connected,
            "account_created_at": account_created_at,
            "meetings_by_month": get_meetings_by_month(meetings),
        }

def get_meetings_by_month(meetings):
    """Group meetings by month for charts"""
    from collections import defaultdict
    from datetime import datetime

    monthly_counts = defaultdict(int)
    for meeting in meetings:
        if meeting.created_at:
            month_key = meeting.created_at.strftime('%Y-%m')
            monthly_counts[month_key] += 1

    # Return last 12 months
    result = []
    from datetime import datetime, timedelta
    for i in range(11, -1, -1):
        date = datetime.now() - timedelta(days=i*30)
        month_key = date.strftime('%Y-%m')
        result.append({
            "month": month_key,
            "count": monthly_counts.get(month_key, 0)
        })

    return result

# ========================================
# GOOGLE CALENDAR OAUTH ENDPOINTS
# ========================================

from google_auth_oauthlib.flow import Flow
from database import update_user_calendar_tokens
from calendar_client import GoogleCalendarOAuth

# Google Calendar OAuth Configuration
# Include OpenID scopes to prevent "Scope has changed" error
GOOGLE_CALENDAR_SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
]

@app.get("/api/calendar/auth-url", tags=["Calendar"])
async def get_calendar_auth_url(current_user: User = Depends(get_current_user)):
    """
    Get Google Calendar OAuth authorization URL.
    User should be redirected to this URL to grant calendar access.
    """
    try:
        # Create OAuth flow (supports both /signin and /settings redirects)
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                    "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [f"{FRONTEND_URL}/signin", f"{FRONTEND_URL}/settings"],
                }
            },
            scopes=GOOGLE_CALENDAR_SCOPES,
            redirect_uri=f"{FRONTEND_URL}/signin"
        )

        # Generate authorization URL
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'  # Force consent to get refresh token
        )

        return {
            "authorization_url": authorization_url,
            "state": state
        }

    except Exception as e:
        logger.error(f"Failed to generate auth URL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

class CalendarCallbackRequest(BaseModel):
    """Calendar OAuth callback data"""
    code: str
    state: str

@app.post("/api/calendar/callback", tags=["Calendar"])
async def calendar_oauth_callback(
    callback_data: CalendarCallbackRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Handle Google Calendar OAuth callback.
    Exchange authorization code for tokens and store them.
    """
    try:
        # Check if calendar is already connected (handles race condition from parallel requests)
        if current_user.calendar_connected and current_user.calendar_access_token:
            logger.info(f"✓ Calendar already connected for user {current_user.email}, skipping token exchange")
            return {
                "message": "Calendar already connected",
                "calendar_connected": True
            }

        # Create OAuth flow (supports both /signin and /settings redirects)
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                    "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [f"{FRONTEND_URL}/signin", f"{FRONTEND_URL}/settings"],
                }
            },
            scopes=GOOGLE_CALENDAR_SCOPES,
            redirect_uri=f"{FRONTEND_URL}/signin"
        )

        # Exchange code for tokens
        flow.fetch_token(code=callback_data.code)

        # Get credentials
        credentials = flow.credentials

        # Store tokens in database
        update_user_calendar_tokens(
            user_id=current_user.id,
            access_token=credentials.token,
            refresh_token=credentials.refresh_token,
            expiry=credentials.expiry
        )

        logger.info(f"✓ Calendar connected for user {current_user.email}")

        return {
            "message": "Calendar connected successfully",
            "calendar_connected": True
        }

    except Exception as e:
        error_str = str(e)

        # Handle invalid_grant error (code already used or expired)
        if "invalid_grant" in error_str.lower():
            # Check if calendar was recently connected successfully
            # Refresh current_user from database to get latest state
            from database import get_user_by_id
            refreshed_user = get_user_by_id(current_user.id)

            if refreshed_user and refreshed_user.calendar_connected:
                logger.info(f"✓ Calendar already connected for user {current_user.email} (code was already used)")
                return {
                    "message": "Calendar already connected",
                    "calendar_connected": True
                }
            else:
                logger.error(f"Calendar OAuth callback failed with invalid_grant: {e}")
                raise HTTPException(
                    status_code=400,
                    detail="The authorization code has expired or been used. Please try connecting your calendar again."
                )

        logger.error(f"Calendar OAuth callback failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/calendar/disconnect", tags=["Calendar"])
async def disconnect_calendar(current_user: User = Depends(get_current_user)):
    """
    Disconnect user's Google Calendar.
    Removes stored OAuth tokens.
    """
    try:
        from database import get_db_session

        with get_db_session() as db:
            user = db.query(User).filter(User.id == current_user.id).first()
            if user:
                user.calendar_access_token = None
                user.calendar_refresh_token = None
                user.calendar_token_expiry = None
                user.calendar_connected = False
                db.commit()

        return {"message": "Calendar disconnected successfully"}

    except Exception as e:
        logger.error(f"Failed to disconnect calendar: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/meetings/{job_id}/sync-calendar", tags=["Calendar"])
async def sync_meeting_to_calendar(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Sync meeting events to user's Google Calendar.
    Requires calendar to be connected.
    """
    if not current_user.calendar_connected:
        raise HTTPException(
            status_code=400,
            detail="Calendar not connected. Please connect your calendar first."
        )

    # Get meeting from database
    meeting = get_meeting_by_job_id(job_id, current_user.id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    try:
        # Create calendar client with user's OAuth tokens
        calendar_client = GoogleCalendarOAuth(
            access_token=current_user.calendar_access_token,
            refresh_token=current_user.calendar_refresh_token,
            token_expiry=current_user.calendar_token_expiry
        )

        # Parse events from database - only sync unsynced events
        dated_events = []
        event_records = []  # Keep track of Event records
        for event in meeting.events:
            if event.event_type == "dated_events":
                event_data = json.loads(event.event_data)
                # Only sync if not already synced
                if not event_data.get('synced', False):
                    dated_events.append(event_data)
                    event_records.append(event)

        if not dated_events:
            return {
                "message": "All events are already synced to calendar",
                "event_links": [],
                "synced": True,
                "already_synced": True
            }

        # Create calendar events
        event_links = calendar_client.create_events_from_extraction(
            {"dated_events": dated_events}
        )

        # Mark individual events as synced in database
        from database import get_db_session
        with get_db_session() as db:
            for i, event in enumerate(event_records):
                event_data = json.loads(event.event_data)
                event_data['synced'] = True
                event_data['calendar_link'] = event_links[i] if i < len(event_links) else None
                event.event_data = json.dumps(event_data)
            db.commit()

        # Update tokens if they were refreshed
        updated_tokens = calendar_client.get_updated_tokens()
        update_user_calendar_tokens(
            user_id=current_user.id,
            access_token=updated_tokens["access_token"],
            refresh_token=updated_tokens["refresh_token"],
            expiry=updated_tokens["expiry"]
        )

        # Mark meeting as synced (for backward compatibility)
        mark_meeting_synced(job_id, current_user.id)

        return {
            "message": f"Successfully synced {len(event_links)} events to calendar",
            "event_links": event_links,
            "synced": True
        }

    except Exception as e:
        logger.error(f"Calendar sync failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ========================================
# USER PRESETS ENDPOINTS
# ========================================

class PresetCreateRequest(BaseModel):
    """Request to create a preset"""
    name: str
    config: Dict
    is_default: bool = False

class PresetUpdateRequest(BaseModel):
    """Request to update a preset"""
    name: Optional[str] = None
    config: Optional[Dict] = None
    is_default: Optional[bool] = None

@app.get("/api/presets", tags=["Presets"])
async def get_presets(current_user: User = Depends(get_current_user)):
    """
    Get all presets for the current user.
    """
    presets = get_user_presets(current_user.id)

    presets_list = []
    for preset in presets:
        presets_list.append({
            "id": preset.id,
            "name": preset.name,
            "config": json.loads(preset.config),
            "is_default": preset.is_default,
            "created_at": preset.created_at.isoformat(),
        })

    return {"presets": presets_list}

@app.post("/api/presets", tags=["Presets"])
async def create_preset(
    preset_data: PresetCreateRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Create a new preset for the current user.
    """
    preset = create_user_preset(
        user_id=current_user.id,
        name=preset_data.name,
        config=preset_data.config,
        is_default=preset_data.is_default
    )

    return {
        "id": preset.id,
        "name": preset.name,
        "config": json.loads(preset.config),
        "is_default": preset.is_default,
        "created_at": preset.created_at.isoformat(),
    }

@app.put("/api/presets/{preset_id}", tags=["Presets"])
async def update_preset(
    preset_id: int,
    preset_data: PresetUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Update a preset.
    Verifies user ownership.
    """
    preset = update_user_preset(
        preset_id=preset_id,
        user_id=current_user.id,
        name=preset_data.name,
        config=preset_data.config,
        is_default=preset_data.is_default
    )

    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")

    return {
        "id": preset.id,
        "name": preset.name,
        "config": json.loads(preset.config),
        "is_default": preset.is_default,
        "created_at": preset.created_at.isoformat(),
    }

@app.delete("/api/presets/{preset_id}", tags=["Presets"])
async def delete_preset(
    preset_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Delete a preset.
    Verifies user ownership.
    """
    success = delete_user_preset(preset_id, current_user.id)

    if not success:
        raise HTTPException(status_code=404, detail="Preset not found")

    return {"message": "Preset deleted successfully"}

# ========================================
# LIVE RECORDING ENDPOINTS (REMOVED)
# ========================================

if __name__ == "__main__":
    if not os.getenv("GROQ_API_KEY") and not os.getenv("ASSEMBLYAI_API_KEY"):
        logger.warning("CRITICAL: No primary API keys (GROQ, ASSEMBLYAI) found in .env.")
    if not os.getenv("GEMINI_API_KEY") and not os.getenv("QWEN_GGUF_MODEL_PATH"):
         logger.warning("CRITICAL: No primary LLM providers (GEMINI, QWEN) configured in .env.")
    
    port = int(os.getenv("PORT", 8000))
    host = "0.0.0.0" if os.getenv("PORT") else "127.0.0.1"
    
    logger.info(f"Starting Uvicorn server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)