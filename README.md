# DraftSmith

**AI-Powered Email Draft Generator - An Agentic Systems Demo**

DraftSmith demonstrates the real business value of AGENTIC SYSTEMS by creating personalized Gmail draft emails for both B2B and B2C outreach. Emails are NEVER auto-sent - they are created as drafts only so the human user can review and click Send.

## Core Value Proposition

> "Instead of manually writing 50 personalized emails, a human writes ONE intent. The agent does the grunt work. The human approves."

## What This Demo Shows

This app demonstrates how an AI agent can:
- Understand user intent (a pitch paragraph)
- Understand who a specific person is (via user-provided lead data + light public research)
- Decide how to personalize an outreach message safely
- Draft emails at scale
- Leave the final decision to a human

## Key Features

### ✅ Gmail Integration
- Connect your own Gmail account via Google OAuth
- Drafts appear in YOUR Gmail account
- Switch between multiple Gmail accounts
- No auto-sending - full user control

### ✅ Intelligent Personalization
- **Low**: Generic messaging using only name/company
- **Medium**: Reference role, industry, or company context
- **High**: Use public research for deeper personalization

### ✅ Multi-Audience Support
- **B2B**: Business outreach (company-focused)
- **B2C**: Personal outreach (individual-focused)
- **Mixed**: Auto-detect per recipient

### ✅ Privacy-First Design
- Only uses publicly available information
- Never claims access to private data
- No creepy references to sensitive attributes
- Respectful opt-out included in every email

### ✅ Flexible Input
- Manual recipient entry
- CSV upload with auto-detection
- Support for rich lead data (LinkedIn, websites, notes, etc.)

## Tech Stack

### Frontend
- React + Vite
- Tailwind CSS
- Clean, simple GUI for non-technical users

### Backend
- Python FastAPI
- SQLite for local storage
- OpenAI API for agentic workflow
- Google Gmail API for draft creation

## Setup Instructions

### Prerequisites

1. **Node.js** (v18+)
2. **Python** (v3.10+)
3. **OpenAI API Key**
4. **Google Cloud Project** with Gmail API enabled

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd agentic-demo
```

### Step 2: Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Gmail API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen:
   - User Type: External
   - Add test users (your Gmail account)
6. Create OAuth Client ID:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:8000/auth/google/callback`
7. Download the credentials and note the Client ID and Client Secret

### Step 3: Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
```

Edit `backend/.env` with your credentials:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
SECRET_KEY=your_random_secret_key_here
DATABASE_URL=sqlite:///./draftsmith.db
FRONTEND_URL=http://localhost:5173
```

### Step 4: Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

### Step 5: Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
venv\Scripts\activate  # or source venv/bin/activate on macOS/Linux
python main.py
```

Backend will run on `http://localhost:8000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Frontend will run on `http://localhost:5173`

### Step 6: Open the App

Navigate to `http://localhost:5173` in your browser.

## Usage Guide

### 1. Connect Gmail

Click "Connect Gmail Account" and authorize the app to create drafts in your Gmail account.

### 2. Configure Campaign

- **Pitch**: Write what you want to communicate (e.g., "I'm offering a free SEO audit for e-commerce businesses")
- **Audience Type**: B2B, B2C, or Mixed
- **Tone**: Friendly, Professional, or Neutral
- **Personalization Level**: Low, Medium, or High

### 3. Add Recipients

**Option A: Manual Entry**
- Click "Add Recipient"
- Fill in email (required) and optional fields:
  - First/Last Name
  - Company
  - Role/Title
  - Location
  - LinkedIn URL
  - Notes

**Option B: CSV Upload**
- Click "Upload CSV"
- Supported columns:
  - `email` (required)
  - `first_name`, `last_name`, `name`
  - `company`, `role`, `title`
  - `location`
  - `linkedin`, `linkedin_url`
  - `website`, `company_website`
  - `notes`, `tags`

### 4. Generate Drafts

Click "Generate Drafts" - the AI agent will:
1. Determine outreach mode per recipient (B2B/B2C)
2. Perform public research if personalization level is Medium/High
3. Synthesize personalization hooks
4. Draft emails (90-160 words, one clear CTA)
5. Create Gmail drafts in your account

### 5. Review & Send

- View results in the results page
- Click "Preview" to see draft details
- Click "Open Gmail Drafts" to review in Gmail
- **You manually send each email** after reviewing

## Agentic Workflow

The agent follows this workflow for each recipient:

1. **Determine Outreach Mode**: B2B vs B2C based on available data
2. **Decide Whether to Research**: Skip if Low personalization
3. **Public Research**: Use OpenAI with web search for publicly available info
4. **Personalization Synthesis**: Extract 0-2 safe hooks, match to pitch
5. **Draft Email**: Generate structured output (subject, body, rationale)
6. **Create Gmail Draft**: Build RFC 2822 MIME message and upload to Gmail

## Privacy & Safety Rules

The agent is designed to be NON-CREEPY:
- ✅ Only uses explicitly provided data OR publicly available information
- ✅ Never references private/sensitive data
- ✅ Never sounds like surveillance
- ✅ Downshifts to generic messaging if confidence is low
- ✅ Always includes respectful opt-out line
- ✅ No auto-sending - human approval required

## API Endpoints

```
GET  /api/health                    # Health check
GET  /auth/google/login            # Initiate OAuth
GET  /auth/google/callback         # OAuth callback
GET  /api/auth/status              # Check auth status
POST /api/auth/google/disconnect   # Disconnect Gmail
POST /api/recipients/parse-csv     # Parse CSV file
POST /api/run                      # Create campaign run
POST /api/run/{run_id}/generate    # Generate drafts
GET  /api/run/{run_id}             # Get run status
```

## Project Structure

```
agentic-demo/
├── backend/
│   ├── agent.py           # Agentic workflow logic
│   ├── database.py        # SQLAlchemy models
│   ├── google_auth.py     # Google OAuth & Gmail API
│   ├── main.py            # FastAPI application
│   ├── models.py          # Pydantic models
│   ├── requirements.txt   # Python dependencies
│   └── .env              # Environment variables
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CampaignBuilder.jsx
│   │   │   └── ResultsPage.jsx
│   │   ├── App.jsx
│   │   └── index.css
│   ├── package.json
│   └── tailwind.config.js
└── README.md
```

## Acceptance Checklist

- [x] App boots; /api/health works
- [x] Gmail OAuth works; active email shown in UI
- [x] Manual test: create one draft to self (no OpenAI)
- [x] OpenAI drafts work for 3 recipients (Low personalization)
- [x] CSV parsing + mapping works
- [x] Medium/High personalization triggers person-level research
- [x] Mixed audience auto-detection works
- [x] User can disconnect Gmail and switch accounts

## Security Considerations

- Minimal Gmail scopes (draft creation only)
- OAuth tokens stored locally in SQLite
- No background sending
- No silent email usage
- Local development only (not production-ready)

## Troubleshooting

### Gmail OAuth not working
- Ensure redirect URI matches exactly in Google Cloud Console
- Add your email as a test user in OAuth consent screen
- Clear browser cookies and try again

### OpenAI API errors
- Verify API key is valid in `.env`
- Check OpenAI account has credits
- Ensure model name is correct (default: `gpt-4o-mini`)

### Frontend not connecting to backend
- Ensure backend is running on port 8000
- Check CORS settings in `backend/main.py`
- Verify `FRONTEND_URL` in backend `.env`

## Demo Video / Screenshots

*(Add screenshots here showing the UI in action)*

## License

MIT License - See LICENSE file for details

## Contributing

This is a demo project for educational purposes. Contributions welcome!

## Acknowledgments

Built to demonstrate the power of agentic systems in real-world business scenarios.

---

**Remember**: DraftSmith creates drafts only. YOU maintain full control over what gets sent. 🎯
