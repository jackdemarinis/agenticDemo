"""Database models and setup for DraftSmith."""
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./draftsmith.db")

# Handle PostgreSQL vs SQLite connection args
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # PostgreSQL doesn't need check_same_thread
    # Also handle Railway's postgres:// vs postgresql:// URL format
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class GoogleAuth(Base):
    """Store Google OAuth tokens per session."""
    __tablename__ = "google_auth"

    id = Column(Integer, primary_key=True, index=True)
    session_token = Column(String, unique=True, index=True)  # Link to user session
    email = Column(String, index=True)  # No longer unique - same email can be linked to different sessions
    access_token = Column(Text)
    refresh_token = Column(Text)
    token_uri = Column(String)
    client_id = Column(String)
    client_secret = Column(String)
    scopes = Column(JSON)
    expiry = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Run(Base):
    """Store campaign runs."""
    __tablename__ = "runs"

    id = Column(String, primary_key=True, index=True)
    user_email = Column(String, index=True)
    pitch = Column(Text)
    sign_off = Column(Text, nullable=True)
    audience_type = Column(String)  # b2b, b2c, mixed
    tone = Column(String)  # friendly, professional, neutral
    personalization_level = Column(String)  # low, medium, high
    status = Column(String, default="queued")  # queued, processing, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Recipient(Base):
    """Store recipients and their draft status."""
    __tablename__ = "recipients"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(String, index=True)

    # Required
    email = Column(String)

    # Optional lead data
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    company = Column(String, nullable=True)
    role = Column(String, nullable=True)
    location = Column(String, nullable=True)
    lead_type = Column(String, nullable=True)  # b2b, b2c
    notes = Column(Text, nullable=True)
    linkedin_url = Column(String, nullable=True)
    personal_website_url = Column(String, nullable=True)
    company_website_url = Column(String, nullable=True)
    tags = Column(String, nullable=True)

    # Processing status
    status = Column(String, default="queued")  # queued, researched, drafted, failed
    inferred_outreach_mode = Column(String, nullable=True)  # b2b, b2c

    # Research results
    research_summary = Column(Text, nullable=True)
    research_confidence = Column(String, nullable=True)  # high, medium, low

    # Draft results
    subject = Column(String, nullable=True)
    body = Column(Text, nullable=True)
    rationale = Column(Text, nullable=True)
    used_personalization_level = Column(String, nullable=True)
    draft_id = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def init_db():
    """Initialize the database."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
