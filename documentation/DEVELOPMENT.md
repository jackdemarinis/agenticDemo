# DraftSmith Development Guide

## Development Environment Setup

### Backend Development

```bash
cd backend

# Activate virtual environment
source venv/bin/activate  # Mac/Linux
venv\Scripts\activate     # Windows

# Run with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# View API docs
# Open http://localhost:8000/docs
```

### Frontend Development

```bash
cd frontend

# Run dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Testing the App

### Manual Testing Checklist

#### 1. Health Check
```bash
curl http://localhost:8000/api/health
# Expected: {"status": "healthy", "service": "DraftSmith"}
```

#### 2. Gmail OAuth Flow
- [ ] Click "Connect Gmail Account"
- [ ] Redirected to Google consent screen
- [ ] Approve permissions
- [ ] Redirected back to app
- [ ] See "Connected as: your@email.com"

#### 3. Campaign Creation (Low Personalization)
- [ ] Fill in pitch
- [ ] Select: B2B, Professional, Low
- [ ] Add 1 recipient (your own email)
- [ ] Click "Generate Drafts"
- [ ] See "Processing" status
- [ ] See "Completed" status
- [ ] Click "Preview" to see draft
- [ ] Click "Open Gmail Drafts"
- [ ] Verify draft exists in Gmail

#### 4. CSV Upload
- [ ] Use `sample_recipients.csv`
- [ ] Upload CSV
- [ ] See preview of recipients
- [ ] Verify auto-population
- [ ] Generate drafts

#### 5. Medium/High Personalization
- [ ] Select Medium or High
- [ ] Add recipient with LinkedIn URL
- [ ] Generate drafts
- [ ] Check "Research Confidence" in preview
- [ ] Verify rationale mentions research

#### 6. Mixed Audience
- [ ] Select "Mixed" audience type
- [ ] Add B2B recipient (with company/role)
- [ ] Add B2C recipient (without company/role)
- [ ] Generate drafts
- [ ] Verify correct mode inference in results

#### 7. Disconnect/Reconnect
- [ ] Click "Disconnect"
- [ ] See "Connect Gmail Account" button again
- [ ] Reconnect
- [ ] Verify it works

---

## Common Development Tasks

### Add a New Field to Recipient

1. Update database model in `backend/database.py`:
```python
class Recipient(Base):
    # ...existing fields...
    new_field = Column(String, nullable=True)
```

2. Update Pydantic model in `backend/models.py`:
```python
class RecipientInput(BaseModel):
    # ...existing fields...
    new_field: Optional[str] = None
```

3. Update frontend form in `frontend/src/components/CampaignBuilder.jsx`:
```jsx
<input
  type="text"
  placeholder="New Field"
  value={recipient.new_field}
  onChange={(e) => handleRecipientChange(index, 'new_field', e.target.value)}
/>
```

4. Update agent logic in `backend/agent.py` to use new field

5. Delete old database and restart:
```bash
rm backend/draftsmith.db
python backend/main.py
```

### Change OpenAI Model

Edit `backend/.env`:
```env
OPENAI_MODEL=gpt-4o  # or gpt-4o-mini, gpt-4-turbo, etc.
```

Restart backend.

### Add New Tone Option

1. Update frontend dropdown in `CampaignBuilder.jsx`:
```jsx
<select value={tone} onChange={(e) => setTone(e.target.value)}>
  <option value="friendly">Friendly</option>
  <option value="professional">Professional</option>
  <option value="neutral">Neutral</option>
  <option value="casual">Casual</option>  {/* NEW */}
</select>
```

2. Update agent prompt in `backend/agent.py`:
```python
# In synthesize_personalization function
content=f"""You are an expert email copywriter...
Match the tone: {tone}
"""
```

### Customize Email Length

Edit `backend/agent.py` in the system prompt:
```python
7. Email must be 90-160 words  # Change to your preference
```

---

## Debugging Tips

### Backend Not Starting

**Error: "Address already in use"**
```bash
# Find process using port 8000
lsof -i :8000         # Mac/Linux
netstat -ano | findstr :8000  # Windows

# Kill it
kill -9 <PID>         # Mac/Linux
taskkill /PID <PID> /F  # Windows
```

**Error: "ModuleNotFoundError"**
```bash
# Ensure virtual environment is activated
which python  # Should show venv path

# Reinstall dependencies
pip install -r requirements.txt
```

### Frontend Not Connecting

**Check CORS Settings**

In `backend/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Verify this matches
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Check API Base URL**

In `frontend/src/App.jsx` and `CampaignBuilder.jsx`:
```javascript
const API_BASE = 'http://localhost:8000'  // Verify this
```

### OpenAI Errors

**Error: "Invalid API key"**
- Verify `OPENAI_API_KEY` in `.env`
- Check key at https://platform.openai.com/api-keys

**Error: "Rate limit exceeded"**
- Wait a few seconds
- Reduce number of recipients
- Upgrade OpenAI plan

**Error: "Model not found"**
- Check model name in `.env`
- Valid options: `gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo`

### Gmail API Errors

**Error: "Invalid grant"**
- OAuth token expired
- Disconnect and reconnect Gmail
- Check OAuth consent screen status

**Error: "Insufficient permissions"**
- Verify Gmail API is enabled
- Check scopes in `backend/google_auth.py`
- Should be: `https://www.googleapis.com/auth/gmail.compose`

**Error: "Redirect URI mismatch"**
- Must be EXACTLY: `http://localhost:8000/auth/google/callback`
- No trailing slash
- No variations

### Database Issues

**Reset database:**
```bash
cd backend
rm draftsmith.db
python main.py  # Will recreate tables
```

**View database contents:**
```bash
sqlite3 draftsmith.db
.tables
SELECT * FROM google_auth;
SELECT * FROM runs;
SELECT * FROM recipients;
.quit
```

---

## API Testing with curl

### Check Auth Status
```bash
curl http://localhost:8000/api/auth/status
```

### Create Run
```bash
curl -X POST http://localhost:8000/api/run \
  -H "Content-Type: application/json" \
  -d '{
    "pitch": "Test pitch",
    "audience_type": "b2b",
    "tone": "professional",
    "personalization_level": "low",
    "recipients": [
      {
        "email": "test@example.com",
        "first_name": "Test"
      }
    ]
  }'
```

### Get Run Status
```bash
curl http://localhost:8000/api/run/{run_id}
```

---

## Code Style Guidelines

### Python (Backend)

```python
# Use type hints
def generate_draft_for_recipient(
    recipient_data: Dict[str, Any],
    pitch: str,
    audience_type: str
) -> Dict[str, Any]:
    pass

# Use docstrings
"""
Brief description.

Args:
    recipient_data: Recipient information
    pitch: User's pitch paragraph

Returns:
    Draft data including subject, body, rationale
"""

# Format with black (optional)
pip install black
black backend/*.py
```

### JavaScript (Frontend)

```javascript
// Use const/let, not var
const API_BASE = 'http://localhost:8000'

// Destructure props
function CampaignBuilder({ authStatus, onRunCreated }) {
  // ...
}

// Use async/await
const handleGenerateDrafts = async () => {
  const response = await fetch(`${API_BASE}/api/run`)
  const data = await response.json()
}

// Format with prettier (optional)
npm install -D prettier
npx prettier --write "src/**/*.{js,jsx}"
```

---

## Environment Variables Reference

### Backend (.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Model to use |
| `GOOGLE_CLIENT_ID` | Yes | - | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | - | OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Yes | - | OAuth redirect URI |
| `SECRET_KEY` | No | Random | Session secret |
| `DATABASE_URL` | No | `sqlite:///./draftsmith.db` | DB connection |
| `FRONTEND_URL` | No | `http://localhost:5173` | CORS origin |

---

## Performance Optimization

### Reduce API Costs

1. **Use cheaper model:**
```env
OPENAI_MODEL=gpt-4o-mini  # Instead of gpt-4o
```

2. **Lower personalization:**
- Use "Low" for testing
- "Medium" for production
- "High" only for warm leads

3. **Shorter prompts:**
- Edit system prompts in `backend/agent.py`
- Remove verbose examples

### Speed Up Processing

1. **Skip research for testing:**
- Always use "Low" personalization
- Or comment out research in `backend/agent.py`

2. **Reduce recipient count:**
- Test with 1-3 recipients
- Scale up once working

---

## Extending the Agent

### Add Custom Research Source

In `backend/agent.py`, modify `perform_public_research`:

```python
def perform_public_research(recipient_data, outreach_mode):
    # Existing OpenAI research...

    # Add custom research
    if recipient_data.get('company'):
        company_info = fetch_company_info(recipient_data['company'])
        result['company_context'] = company_info

    return result

def fetch_company_info(company_name):
    """Your custom research logic."""
    # Could call Clearbit, Hunter.io, etc.
    pass
```

### Add Email Templates

Create `backend/templates.py`:

```python
TEMPLATES = {
    'seo_audit': {
        'subject': 'Quick question about {company} SEO',
        'intro': 'I noticed {company} could benefit from...'
    },
    'product_demo': {
        'subject': 'Demo for {first_name}?',
        'intro': 'Hi {first_name}, I thought you might find...'
    }
}
```

Modify agent to use templates.

### Add Follow-up Logic

Extend `Recipient` model to track:
- `sent_at` timestamp
- `follow_up_scheduled` boolean
- `follow_up_count` integer

Add cron job to create follow-up drafts.

---

## Deployment Notes

**This is a local demo app. For production:**

1. **Use proper database:**
   - PostgreSQL instead of SQLite
   - Connection pooling

2. **Add authentication:**
   - User accounts
   - Multi-tenant support
   - Session management

3. **Secure secrets:**
   - Use secret management (AWS Secrets Manager, etc.)
   - Rotate credentials

4. **Rate limiting:**
   - Limit requests per user
   - Queue background jobs

5. **Monitoring:**
   - Log aggregation
   - Error tracking (Sentry)
   - Performance monitoring

6. **HTTPS:**
   - SSL certificates
   - Secure headers

---

## Contributing

1. Fork the repo
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

---

## Resources

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [React Docs](https://react.dev/)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Gmail API Docs](https://developers.google.com/gmail/api)
- [Tailwind CSS Docs](https://tailwindcss.com/)

---

**Happy coding! 🚀**
