import os
import logging
import json
import secrets
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import sessionmaker, relationship, declarative_base, selectinload
from sqlalchemy.sql import func
from contextlib import contextmanager
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# --- THE SWITCHING LOGIC ---
DATABASE_URL = os.getenv("DATABASE_URL")
IS_PRODUCTION = DATABASE_URL is not None

if IS_PRODUCTION:
    # Production: Use PostgreSQL from the environment variable
    logger.info("ENVIRONMENT: Production. Connecting to PostgreSQL...")
    engine = create_engine(DATABASE_URL)
else:
    # Local Development: Use a local SQLite file
    logger.info("ENVIRONMENT: Local. Using local SQLite database (meetings.db)...")
    DB_FILE = "meetings.db"
    engine = create_engine(f"sqlite:///{DB_FILE}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- ORM Models (These work for both SQLite and PostgreSQL thanks to SQLAlchemy) ---

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)

    # Authentication providers (at least one must be set)
    google_id = Column(String, unique=True, nullable=True, index=True)
    github_id = Column(String, unique=True, nullable=True, index=True)
    password_hash = Column(String, nullable=True)  # For email/password auth

    name = Column(String, nullable=True)
    picture = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Google Calendar OAuth tokens (encrypted in production)
    calendar_access_token = Column(Text, nullable=True)
    calendar_refresh_token = Column(Text, nullable=True)
    calendar_token_expiry = Column(DateTime(timezone=True), nullable=True)
    calendar_connected = Column(Boolean, default=False)

    # Password reset tokens
    reset_token = Column(String, nullable=True, index=True)
    reset_token_expiry = Column(DateTime(timezone=True), nullable=True)

    # Email verification
    email_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True, index=True)
    verification_token_expiry = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    meetings = relationship("Meeting", back_populates="user", cascade="all, delete-orphan")
    presets = relationship("UserPreset", back_populates="user", cascade="all, delete-orphan")

class UserPreset(Base):
    __tablename__ = "user_presets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)  # "My Sales Role", "HR Manager", etc.
    config = Column(Text, nullable=False)  # JSON string with role, output_fields, user_input
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="presets")

class Meeting(Base):
    __tablename__ = "meetings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    job_id = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    raw_transcript = Column(Text)
    final_summary = Column(Text) # Storing summary as JSON string

    user_input = Column(Text, nullable=True)
    user_input_result = Column(Text, nullable=True)
    calendar_synced = Column(Boolean, default=False)  # Track if meeting synced to calendar

    # Analytics fields
    audio_duration = Column(Integer, nullable=True)  # Duration in seconds
    processing_time = Column(Integer, nullable=True)  # Processing time in seconds

    # Relationships
    user = relationship("User", back_populates="meetings")
    events = relationship("Event", back_populates="meeting", cascade="all, delete-orphan")

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    event_type = Column(String, nullable=False)
    event_data = Column(Text, nullable=False) # Storing event data as JSON string
    
    meeting = relationship("Meeting", back_populates="events")

def init_db():
    db_type = "PostgreSQL" if IS_PRODUCTION else "SQLite"
    logger.info(f"🗄️ Initializing {db_type} database schema...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("   ✓ Database tables are ready.")
    except Exception as e:
        logger.error(f"❌ Failed to initialize database: {e}", exc_info=True)
        raise

@contextmanager
def get_db_session():
    """Provides a transactional scope around a series of operations."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def save_pipeline_results(
    job_id: str,
    user_id: int,
    raw_transcript: str,
    final_summary: dict,  # Expects a dict
    extracted_events: dict,
    user_input: str = None,
    user_input_result: dict = None,
    audio_duration: int = None,  # Duration in seconds
    processing_time: int = None  # Processing time in seconds
    ):
    db_type = "PostgreSQL" if IS_PRODUCTION else "SQLite"
    logger.info(f"🗄️ Saving results for job {job_id} (user {user_id}) to {db_type}...")

    with get_db_session() as db:
        try:
            existing_meeting = db.query(Meeting).filter(Meeting.job_id == job_id).first()
            if existing_meeting:
                logger.warning(f"   - Job ID {job_id} already exists. Skipping save.")
                return

            new_meeting = Meeting(
                job_id=job_id,
                user_id=user_id,
                raw_transcript=raw_transcript,
                final_summary=json.dumps(final_summary), # Dumps dict to JSON string
                user_input=user_input,
                user_input_result=json.dumps(user_input_result) if user_input_result else None,
                audio_duration=audio_duration,
                processing_time=processing_time
            )
            db.add(new_meeting)
            db.flush() 

            all_events = {
                "dated_events": extracted_events.get("dated_events", []),
                "notes": extracted_events.get("notes", [])
            }

            for event_type, event_list in all_events.items():
                if not isinstance(event_list, list):
                    continue
                
                for event_data in event_list:
                    new_event = Event(
                        meeting_id=new_meeting.id,
                        event_type=event_type,
                        event_data=json.dumps(event_data)
                    )
                    db.add(new_event)
            
            db.commit()
            logger.info(f"   ✓ Successfully saved meeting (ID: {new_meeting.id}).")
        except Exception as e:
            logger.error(f"❌ Failed to save results to database: {e}", exc_info=True)
            db.rollback()
            raise

# --- User Management Functions ---

def get_or_create_user(google_id: str, email: str, name: str = None, picture: str = None) -> User:
    """
    Get existing user or create new one from Google OAuth data.
    If email already exists, link Google account to existing user.
    """
    with get_db_session() as db:
        # First check if user with this google_id already exists
        user = db.query(User).filter(User.google_id == google_id).first()
        if not user:
            # Check if email already exists (user might have signed up with email/password)
            user = db.query(User).filter(User.email == email).first()
            if user:
                # Link Google account to existing user
                user.google_id = google_id
                if not user.name:
                    user.name = name
                if not user.picture:
                    user.picture = picture
                db.commit()
                db.refresh(user)
                logger.info(f"✓ Linked Google account to existing user: {email}")
            else:
                # Create new user
                user = User(
                    google_id=google_id,
                    email=email,
                    name=name,
                    picture=picture
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                logger.info(f"✓ Created new user from Google: {email} (ID: {user.id})")
        return user

def get_user_by_id(user_id: int):
    """Get user by ID"""
    with get_db_session() as db:
        return db.query(User).filter(User.id == user_id).first()

def get_user_by_email(email: str):
    """Get user by email address"""
    with get_db_session() as db:
        return db.query(User).filter(User.email == email).first()

def create_user_with_password(email: str, password_hash: str, name: str = None) -> User:
    """Create a new user with email/password authentication"""
    with get_db_session() as db:
        user = User(
            email=email,
            password_hash=password_hash,
            name=name
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"✓ Created new user with email/password: {email} (ID: {user.id})")
        return user

def get_or_create_user_github(github_id: str, email: str, name: str = None, picture: str = None) -> User:
    """Get existing user or create new one from GitHub OAuth data"""
    with get_db_session() as db:
        user = db.query(User).filter(User.github_id == github_id).first()
        if not user:
            # Check if email already exists (user might have signed up with email/password)
            user = db.query(User).filter(User.email == email).first()
            if user:
                # Link GitHub account to existing user
                user.github_id = github_id
                if not user.name:
                    user.name = name
                if not user.picture:
                    user.picture = picture
                db.commit()
                db.refresh(user)
                logger.info(f"✓ Linked GitHub account to existing user: {email}")
            else:
                # Create new user
                user = User(
                    github_id=github_id,
                    email=email,
                    name=name,
                    picture=picture
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                logger.info(f"✓ Created new user from GitHub: {email} (ID: {user.id})")
        return user

def update_user_calendar_tokens(
    user_id: int,
    access_token: str,
    refresh_token: str,
    expiry: datetime
):
    """Update user's Google Calendar OAuth tokens"""
    with get_db_session() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.calendar_access_token = access_token
            user.calendar_refresh_token = refresh_token
            user.calendar_token_expiry = expiry
            user.calendar_connected = True
            db.commit()
            logger.info(f"✓ Updated calendar tokens for user {user_id}")

def get_user_meetings(user_id: int, limit: int = 50, offset: int = 0):
    """Get all meetings for a user with pagination"""
    with get_db_session() as db:
        meetings = db.query(Meeting).options(
            selectinload(Meeting.events)
        ).filter(
            Meeting.user_id == user_id
        ).order_by(
            Meeting.created_at.desc()
        ).limit(limit).offset(offset).all()
        return meetings

def get_meeting_by_job_id(job_id: str, user_id: int):
    """Get meeting by job_id, ensuring it belongs to the user"""
    with get_db_session() as db:
        return db.query(Meeting).options(
            selectinload(Meeting.events)
        ).filter(
            Meeting.job_id == job_id,
            Meeting.user_id == user_id
        ).first()

# --- User Preset Functions ---

def create_user_preset(user_id: int, name: str, config: dict, is_default: bool = False):
    """Create a new preset for a user"""
    with get_db_session() as db:
        # If setting as default, unset other defaults
        if is_default:
            db.query(UserPreset).filter(
                UserPreset.user_id == user_id,
                UserPreset.is_default == True
            ).update({"is_default": False})

        preset = UserPreset(
            user_id=user_id,
            name=name,
            config=json.dumps(config),
            is_default=is_default
        )
        db.add(preset)
        db.commit()
        db.refresh(preset)
        return preset

def get_user_presets(user_id: int):
    """Get all presets for a user"""
    with get_db_session() as db:
        return db.query(UserPreset).filter(
            UserPreset.user_id == user_id
        ).order_by(UserPreset.created_at.desc()).all()

def update_user_preset(preset_id: int, user_id: int, name: str = None, config: dict = None, is_default: bool = None):
    """Update a preset"""
    with get_db_session() as db:
        preset = db.query(UserPreset).filter(
            UserPreset.id == preset_id,
            UserPreset.user_id == user_id
        ).first()

        if not preset:
            return None

        if name:
            preset.name = name
        if config:
            preset.config = json.dumps(config)
        if is_default is not None:
            if is_default:
                # Unset other defaults
                db.query(UserPreset).filter(
                    UserPreset.user_id == user_id,
                    UserPreset.is_default == True
                ).update({"is_default": False})
            preset.is_default = is_default

        db.commit()
        db.refresh(preset)
        return preset

def delete_user_preset(preset_id: int, user_id: int):
    """Delete a preset"""
    with get_db_session() as db:
        preset = db.query(UserPreset).filter(
            UserPreset.id == preset_id,
            UserPreset.user_id == user_id
        ).first()

        if preset:
            db.delete(preset)
            db.commit()
            return True
        return False

def mark_meeting_synced(job_id: str, user_id: int):
    """Mark a meeting as synced to calendar"""
    with get_db_session() as db:
        meeting = db.query(Meeting).filter(
            Meeting.job_id == job_id,
            Meeting.user_id == user_id
        ).first()

        if meeting:
            meeting.calendar_synced = True
            db.commit()
            logger.info(f"✓ Marked meeting {job_id} as synced to calendar")
            return True
        return False

def update_user_name(user_id: int, name: str):
    """Update user's display name"""
    with get_db_session() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.name = name
            db.commit()
            db.refresh(user)
            logger.info(f"✓ Updated name for user {user_id}: {name}")
            # Return dict instead of detached object
            return {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "picture": user.picture,
                "calendar_connected": user.calendar_connected
            }
        return None

def create_password_reset_token(email: str):
    """Generate and save password reset token for user"""
    with get_db_session() as db:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            # Return None if user doesn't exist (but don't reveal this to frontend for security)
            return None

        # Generate secure random token
        reset_token = secrets.token_urlsafe(32)

        # Set expiry to 1 hour from now
        expiry = datetime.utcnow() + timedelta(hours=1)

        # Save token to user
        user.reset_token = reset_token
        user.reset_token_expiry = expiry
        db.commit()

        logger.info(f"✓ Created password reset token for user {user.email}")
        return reset_token

def verify_reset_token(token: str):
    """Verify password reset token is valid and not expired"""
    with get_db_session() as db:
        user = db.query(User).filter(User.reset_token == token).first()

        if not user:
            return None

        # Check if token is expired
        if user.reset_token_expiry < datetime.utcnow():
            logger.warning(f"Reset token expired for user {user.email}")
            return None

        return user.email

def reset_password_with_token(token: str, new_password_hash: str):
    """Reset user password using valid token"""
    with get_db_session() as db:
        user = db.query(User).filter(User.reset_token == token).first()

        if not user:
            return False

        # Check if token is expired
        if user.reset_token_expiry < datetime.utcnow():
            logger.warning(f"Attempted to use expired reset token for user {user.email}")
            return False

        # Update password and clear reset token
        user.password_hash = new_password_hash
        user.reset_token = None
        user.reset_token_expiry = None
        db.commit()

        logger.info(f"✓ Password reset successfully for user {user.email}")
        return True

def create_verification_token(user_id: int):
    """Generate and save email verification token for user"""
    with get_db_session() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return None

        # Generate secure random token
        verification_token = secrets.token_urlsafe(32)

        # Set expiry to 24 hours from now
        expiry = datetime.utcnow() + timedelta(hours=24)

        # Save token to user
        user.verification_token = verification_token
        user.verification_token_expiry = expiry
        db.commit()

        logger.info(f"✓ Created email verification token for user {user.email}")
        return verification_token

def verify_email_with_token(token: str):
    """Verify user's email using valid token"""
    with get_db_session() as db:
        user = db.query(User).filter(User.verification_token == token).first()

        if not user:
            return False

        # Check if token is expired
        if user.verification_token_expiry < datetime.utcnow():
            logger.warning(f"Verification token expired for user {user.email}")
            return False

        # Verify email and clear token
        user.email_verified = True
        user.verification_token = None
        user.verification_token_expiry = None
        db.commit()

        logger.info(f"✓ Email verified successfully for user {user.email}")
        return True

def resend_verification_token(email: str):
    """Resend email verification token"""
    with get_db_session() as db:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None

        if user.email_verified:
            # Already verified
            return "already_verified"

        # Generate new token
        verification_token = secrets.token_urlsafe(32)
        expiry = datetime.utcnow() + timedelta(hours=24)

        user.verification_token = verification_token
        user.verification_token_expiry = expiry
        db.commit()

        logger.info(f"✓ Resent verification token for user {user.email}")
        return verification_token