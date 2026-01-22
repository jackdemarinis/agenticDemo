"""FastAPI backend for DraftSmith."""
import os
import uuid
import csv
import io
from typing import List
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Response, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import secrets

import database
from database import get_db, GoogleAuth, Run, Recipient
from models import (
    RunCreate, RunResponse, RecipientResponse,
    GoogleAuthResponse, CSVParseResponse, RecipientInput
)
from google_auth import (
    get_authorization_url, exchange_code_for_token,
    save_credentials, get_user_email_from_token,
    get_credentials_from_db, create_gmail_draft,
    delete_credentials
)
from agent import generate_draft_for_recipient

load_dotenv()

# Simple session storage (in production, use Redis or a database)
active_sessions = {}
SESSION_EXPIRY = timedelta(hours=24)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    database.init_db()
    yield


app = FastAPI(title="DraftSmith API", lifespan=lifespan)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# AUTHENTICATION
# ============================================================================

def verify_session(authorization: str = Header(None)):
    """Verify session token."""
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    token = authorization.replace("Bearer ", "")

    if token not in active_sessions:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    session_data = active_sessions[token]
    if datetime.now() > session_data["expires_at"]:
        del active_sessions[token]
        raise HTTPException(status_code=401, detail="Session expired")

    return session_data


@app.post("/api/auth/login")
def login(credentials: dict):
    """Authenticate with password."""
    password = credentials.get("password")
    app_password = os.getenv("APP_PASSWORD", "DraftSmith2024!")

    if password != app_password:
        raise HTTPException(status_code=401, detail="Invalid password")

    # Create session token
    token = secrets.token_urlsafe(32)
    active_sessions[token] = {
        "created_at": datetime.now(),
        "expires_at": datetime.now() + SESSION_EXPIRY
    }

    return {"token": token, "expires_in": int(SESSION_EXPIRY.total_seconds())}


@app.post("/api/auth/logout")
def logout(session = Depends(verify_session), authorization: str = Header(None)):
    """Logout and invalidate session."""
    token = authorization.replace("Bearer ", "")
    if token in active_sessions:
        del active_sessions[token]
    return {"success": True}


@app.get("/api/auth/verify")
def verify_auth(session = Depends(verify_session)):
    """Verify if session is valid."""
    return {"authenticated": True}


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/")
def root():
    """Root endpoint for Railway deployment."""
    return {
        "service": "DraftSmith API",
        "status": "running",
        "version": "1.0.0",
        "endpoints": {
            "health": "/api/health",
            "docs": "/docs",
            "auth": "/api/auth/login"
        }
    }

@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "DraftSmith"}


# ============================================================================
# GOOGLE OAUTH ENDPOINTS
# ============================================================================

@app.get("/auth/google/login")
def google_login():
    """Initiate Google OAuth flow."""
    auth_url, state = get_authorization_url()
    return {"auth_url": auth_url, "state": state}


@app.get("/auth/google/callback")
def google_callback(code: str, db: Session = Depends(get_db)):
    """Handle Google OAuth callback."""
    try:
        # Exchange code for credentials
        credentials = exchange_code_for_token(code)

        # Get user email
        email = get_user_email_from_token(credentials)

        # Save credentials
        save_credentials(db, credentials, email)

        # Redirect to frontend with success
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        return RedirectResponse(url=f"{frontend_url}?auth=success&email={email}")

    except Exception as e:
        print(f"OAuth callback error: {e}")
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        return RedirectResponse(url=f"{frontend_url}?auth=error&message={str(e)}")


@app.get("/api/auth/status")
def auth_status(db: Session = Depends(get_db), session = Depends(verify_session)) -> GoogleAuthResponse:
    """Check if user is authenticated with Gmail."""
    # Get the most recent auth (simple single-user approach for demo)
    auth = db.query(GoogleAuth).order_by(GoogleAuth.updated_at.desc()).first()

    if auth:
        return GoogleAuthResponse(connected=True, email=auth.email)

    return GoogleAuthResponse(connected=False)


@app.post("/api/auth/google/disconnect")
def google_disconnect(db: Session = Depends(get_db)):
    """Disconnect Google account."""
    # Get the most recent auth
    auth = db.query(GoogleAuth).order_by(GoogleAuth.updated_at.desc()).first()

    if auth:
        delete_credentials(db, auth.email)

    return {"success": True, "message": "Disconnected from Gmail"}


# ============================================================================
# CSV PARSING
# ============================================================================

@app.post("/api/recipients/parse-csv")
async def parse_csv(file: UploadFile = File(...), session = Depends(verify_session)) -> CSVParseResponse:
    """Parse CSV file and return preview with validation."""
    try:
        contents = await file.read()
        decoded = contents.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(decoded))

        headers = csv_reader.fieldnames or []
        rows = list(csv_reader)

        # Normalize headers to our expected fields
        header_mapping = {
            'email': 'email',
            'e-mail': 'email',
            'mail': 'email',
            'first_name': 'first_name',
            'firstname': 'first_name',
            'first': 'first_name',
            'last_name': 'last_name',
            'lastname': 'last_name',
            'last': 'last_name',
            'name': 'name',
            'full_name': 'name',
            'company': 'company',
            'organization': 'company',
            'role': 'role',
            'title': 'role',
            'position': 'role',
            'location': 'location',
            'city': 'location',
            'linkedin': 'linkedin_url',
            'linkedin_url': 'linkedin_url',
            'website': 'personal_website_url',
            'personal_website': 'personal_website_url',
            'personal_website_url': 'personal_website_url',
            'company_website': 'company_website_url',
            'company_website_url': 'company_website_url',
            'notes': 'notes',
            'tags': 'tags',
            'lead_type': 'lead_type'
        }

        preview = []
        invalid_rows = []

        for idx, row in enumerate(rows[:100]):  # Preview first 100 rows
            # Normalize row
            normalized = {}
            for key, value in row.items():
                normalized_key = header_mapping.get(key.lower().strip(), key)
                normalized[normalized_key] = value.strip() if value else None

            # Split "name" into first_name and last_name if needed
            if 'name' in normalized and normalized['name']:
                parts = normalized['name'].split(' ', 1)
                if 'first_name' not in normalized or not normalized.get('first_name'):
                    normalized['first_name'] = parts[0]
                if 'last_name' not in normalized or not normalized.get('last_name'):
                    normalized['last_name'] = parts[1] if len(parts) > 1 else ''

            # Validate email
            if 'email' not in normalized or not normalized['email']:
                invalid_rows.append({
                    "row": idx + 1,
                    "error": "Missing email",
                    "data": row
                })
                continue

            preview.append(normalized)

        valid_rows = len(preview)
        total_rows = len(rows)

        return CSVParseResponse(
            headers=headers,
            preview=preview[:10],  # Return only first 10 for preview
            total_rows=total_rows,
            valid_rows=valid_rows,
            invalid_rows=invalid_rows[:10]  # Return first 10 invalid
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")


# ============================================================================
# RUN / CAMPAIGN ENDPOINTS
# ============================================================================

@app.post("/api/run")
def create_run(run_data: RunCreate, db: Session = Depends(get_db), session = Depends(verify_session)) -> dict:
    """Create a new campaign run."""
    # Check auth
    auth = db.query(GoogleAuth).order_by(GoogleAuth.updated_at.desc()).first()
    if not auth:
        raise HTTPException(status_code=401, detail="Gmail not connected")

    # Create run
    run_id = str(uuid.uuid4())
    run = Run(
        id=run_id,
        user_email=auth.email,
        pitch=run_data.pitch,
        sign_off=run_data.sign_off,
        audience_type=run_data.audience_type,
        tone=run_data.tone,
        personalization_level=run_data.personalization_level,
        status="queued"
    )
    db.add(run)

    # Add recipients
    for recipient_input in run_data.recipients:
        recipient = Recipient(
            run_id=run_id,
            email=recipient_input.email,
            first_name=recipient_input.first_name,
            last_name=recipient_input.last_name,
            company=recipient_input.company,
            role=recipient_input.role,
            location=recipient_input.location,
            lead_type=recipient_input.lead_type,
            notes=recipient_input.notes,
            linkedin_url=recipient_input.linkedin_url,
            personal_website_url=recipient_input.personal_website_url,
            company_website_url=recipient_input.company_website_url,
            tags=recipient_input.tags,
            status="queued"
        )
        db.add(recipient)

    db.commit()

    return {"run_id": run_id, "status": "created"}


@app.post("/api/run/{run_id}/generate")
def generate_drafts(run_id: str, db: Session = Depends(get_db), session = Depends(verify_session)):
    """Generate drafts for all recipients in a run."""
    # Get run
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Get auth
    auth = db.query(GoogleAuth).filter(GoogleAuth.email == run.user_email).first()
    if not auth:
        raise HTTPException(status_code=401, detail="Gmail not connected")

    # Get credentials
    from google_auth import get_credentials_from_db
    credentials = get_credentials_from_db(db, run.user_email)
    if not credentials:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Update run status
    run.status = "processing"
    db.commit()

    # Get recipients
    recipients = db.query(Recipient).filter(Recipient.run_id == run_id).all()

    # Process each recipient
    for recipient in recipients:
        try:
            # Prepare recipient data
            recipient_data = {
                "email": recipient.email,
                "first_name": recipient.first_name,
                "last_name": recipient.last_name,
                "company": recipient.company,
                "role": recipient.role,
                "location": recipient.location,
                "lead_type": recipient.lead_type,
                "notes": recipient.notes,
                "linkedin_url": recipient.linkedin_url,
                "personal_website_url": recipient.personal_website_url,
                "company_website_url": recipient.company_website_url,
                "tags": recipient.tags
            }

            # Generate draft using agent
            draft_data = generate_draft_for_recipient(
                recipient_data,
                run.pitch,
                run.audience_type,
                run.tone,
                run.personalization_level,
                run.sign_off
            )

            # Update recipient with draft data
            recipient.inferred_outreach_mode = draft_data["inferred_outreach_mode"]
            recipient.research_summary = draft_data.get("research_summary")
            recipient.research_confidence = draft_data.get("research_confidence")
            recipient.subject = draft_data["subject"]
            recipient.body = draft_data["body"]
            recipient.rationale = draft_data["rationale"]
            recipient.used_personalization_level = draft_data["used_personalization_level"]
            recipient.status = "drafted"

            # Create Gmail draft
            draft_id = create_gmail_draft(
                credentials,
                recipient.email,
                recipient.subject,
                recipient.body
            )
            recipient.draft_id = draft_id

            db.commit()

        except Exception as e:
            print(f"Error processing recipient {recipient.email}: {e}")
            recipient.status = "failed"
            recipient.rationale = f"Error: {str(e)}"
            db.commit()

    # Update run status
    run.status = "completed"
    db.commit()

    return {"status": "completed", "run_id": run_id}


@app.get("/api/run/{run_id}")
def get_run(run_id: str, db: Session = Depends(get_db), session = Depends(verify_session)) -> RunResponse:
    """Get run details with all recipients."""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    recipients = db.query(Recipient).filter(Recipient.run_id == run_id).all()

    return RunResponse(
        id=run.id,
        user_email=run.user_email,
        pitch=run.pitch,
        audience_type=run.audience_type,
        tone=run.tone,
        personalization_level=run.personalization_level,
        status=run.status,
        created_at=run.created_at,
        recipients=[RecipientResponse.from_orm(r) for r in recipients]
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
