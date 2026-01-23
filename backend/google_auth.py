"""Google OAuth and Gmail API integration."""
import os
import json
from datetime import datetime
from typing import Optional
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy.orm import Session
from database import GoogleAuth
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SCOPES = ['https://www.googleapis.com/auth/gmail.compose']


def get_oauth_flow():
    """Create OAuth flow for Google authentication."""
    client_config = {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [os.getenv("GOOGLE_REDIRECT_URI")]
        }
    }

    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI")
    )

    return flow


def get_authorization_url(session_token: str = None):
    """Get the authorization URL for OAuth.

    Args:
        session_token: The user's session token to associate with the OAuth credentials
    """
    flow = get_oauth_flow()
    # Embed session token in state parameter for retrieval in callback
    state_data = {"session_token": session_token} if session_token else {}
    state = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()

    authorization_url, _ = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',
        state=state
    )
    return authorization_url, state


def parse_oauth_state(state: str) -> dict:
    """Parse the state parameter from OAuth callback."""
    try:
        return json.loads(base64.urlsafe_b64decode(state.encode()).decode())
    except Exception:
        return {}


def exchange_code_for_token(code: str):
    """Exchange authorization code for tokens."""
    flow = get_oauth_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials
    return credentials


def save_credentials(db: Session, credentials: Credentials, email: str, session_token: str):
    """Save credentials to database linked to a session.

    Args:
        db: Database session
        credentials: Google OAuth credentials
        email: User's Gmail email address
        session_token: The session token to associate with these credentials
    """
    # Check if auth already exists for this session
    auth = db.query(GoogleAuth).filter(GoogleAuth.session_token == session_token).first()

    if auth:
        # Update existing session's credentials
        auth.email = email
        auth.access_token = credentials.token
        auth.refresh_token = credentials.refresh_token
        auth.token_uri = credentials.token_uri
        auth.client_id = credentials.client_id
        auth.client_secret = credentials.client_secret
        auth.scopes = credentials.scopes
        auth.expiry = credentials.expiry
        auth.updated_at = datetime.utcnow()
    else:
        # Create new credentials for this session
        auth = GoogleAuth(
            session_token=session_token,
            email=email,
            access_token=credentials.token,
            refresh_token=credentials.refresh_token,
            token_uri=credentials.token_uri,
            client_id=credentials.client_id,
            client_secret=credentials.client_secret,
            scopes=credentials.scopes,
            expiry=credentials.expiry
        )
        db.add(auth)

    db.commit()
    return auth


def get_credentials_from_db(db: Session, email: str) -> Optional[Credentials]:
    """Load credentials from database."""
    auth = db.query(GoogleAuth).filter(GoogleAuth.email == email).first()

    if not auth:
        return None

    credentials = Credentials(
        token=auth.access_token,
        refresh_token=auth.refresh_token,
        token_uri=auth.token_uri,
        client_id=auth.client_id,
        client_secret=auth.client_secret,
        scopes=auth.scopes
    )

    return credentials


def get_user_email_from_token(credentials: Credentials) -> str:
    """Get user email from credentials."""
    service = build('gmail', 'v1', credentials=credentials)
    profile = service.users().getProfile(userId='me').execute()
    return profile['emailAddress']


def create_gmail_draft(credentials: Credentials, to_email: str, subject: str, body: str) -> str:
    """Create a Gmail draft and return draft ID."""
    service = build('gmail', 'v1', credentials=credentials)

    # Create MIME message
    message = MIMEMultipart('alternative')
    message['To'] = to_email
    message['Subject'] = subject

    # Add body as both plain text and HTML
    text_part = MIMEText(body, 'plain')
    html_part = MIMEText(body.replace('\n', '<br>'), 'html')

    message.attach(text_part)
    message.attach(html_part)

    # Encode message
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')

    # Create draft
    draft_body = {
        'message': {
            'raw': raw_message
        }
    }

    draft = service.users().drafts().create(userId='me', body=draft_body).execute()
    return draft['id']


def delete_credentials_by_session(db: Session, session_token: str):
    """Delete stored credentials for a session."""
    auth = db.query(GoogleAuth).filter(GoogleAuth.session_token == session_token).first()
    if auth:
        db.delete(auth)
        db.commit()
