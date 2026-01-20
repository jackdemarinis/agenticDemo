"""Pydantic models for request/response validation."""
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Literal
from datetime import datetime


class RecipientInput(BaseModel):
    """Input model for a single recipient."""
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    location: Optional[str] = None
    lead_type: Optional[Literal["b2b", "b2c"]] = None
    notes: Optional[str] = None
    linkedin_url: Optional[str] = None
    personal_website_url: Optional[str] = None
    company_website_url: Optional[str] = None
    tags: Optional[str] = None


class RunCreate(BaseModel):
    """Create a new campaign run."""
    pitch: str
    sign_off: Optional[str] = None
    audience_type: Literal["b2b", "b2c", "mixed"]
    tone: Literal["friendly", "professional", "neutral"]
    personalization_level: Literal["low", "medium", "high"]
    recipients: List[RecipientInput]


class RecipientResponse(BaseModel):
    """Response model for recipient status."""
    id: int
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    company: Optional[str]
    role: Optional[str]
    status: str
    inferred_outreach_mode: Optional[str]
    subject: Optional[str]
    body: Optional[str]
    rationale: Optional[str]
    draft_id: Optional[str]
    research_confidence: Optional[str]

    class Config:
        from_attributes = True


class RunResponse(BaseModel):
    """Response model for a campaign run."""
    id: str
    user_email: str
    pitch: str
    audience_type: str
    tone: str
    personalization_level: str
    status: str
    created_at: datetime
    recipients: List[RecipientResponse]

    class Config:
        from_attributes = True


class GoogleAuthResponse(BaseModel):
    """Response model for Google auth status."""
    connected: bool
    email: Optional[str] = None


class CSVParseResponse(BaseModel):
    """Response model for CSV parsing."""
    headers: List[str]
    preview: List[dict]
    total_rows: int
    valid_rows: int
    invalid_rows: List[dict]
