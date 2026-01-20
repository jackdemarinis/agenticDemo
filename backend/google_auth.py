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


def get_authorization_url():
    """Get the authorization URL for OAuth."""
    flow = get_oauth_flow()
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    return authorization_url, state


def exchange_code_for_token(code: str):
    """Exchange authorization code for tokens."""
    flow = get_oauth_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials
    return credentials


def save_credentials(db: Session, credentials: Credentials, email: str):
    """Save credentials to database."""
    # Check if auth already exists
    auth = db.query(GoogleAuth).filter(GoogleAuth.email == email).first()

    if auth:
        # Update existing
        auth.access_token = credentials.token
        auth.refresh_token = credentials.refresh_token
        auth.token_uri = credentials.token_uri
        auth.client_id = credentials.client_id
        auth.client_secret = credentials.client_secret
        auth.scopes = credentials.scopes
        auth.expiry = credentials.expiry
        auth.updated_at = datetime.utcnow()
    else:
        # Create new
        auth = GoogleAuth(
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


def delete_credentials(db: Session, email: str):
    """Delete stored credentials."""
    auth = db.query(GoogleAuth).filter(GoogleAuth.email == email).first()
    if auth:
        db.delete(auth)
        db.commit()
