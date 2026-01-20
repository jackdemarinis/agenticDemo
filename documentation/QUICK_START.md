# DraftSmith - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Prerequisites
```bash
# Check you have these installed:
node --version   # Need v18+
python --version # Need v3.10+
```

### Step 2: Get API Keys

**OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy and save it

**Google OAuth Setup:**
1. Go to https://console.cloud.google.com/
2. Create new project (or select existing)
3. Enable Gmail API
4. Create OAuth 2.0 Client ID:
   - Type: Web application
   - Redirect URI: `http://localhost:8000/auth/google/callback`
5. Save Client ID and Client Secret

### Step 3: Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate        # Windows
# OR
source venv/bin/activate     # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
```

Edit `backend/.env`:
```env
OPENAI_API_KEY=sk-...your-key-here...
OPENAI_MODEL=gpt-4o-mini
GOOGLE_CLIENT_ID=...your-client-id...
GOOGLE_CLIENT_SECRET=...your-client-secret...
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
SECRET_KEY=any-random-string-here
DATABASE_URL=sqlite:///./draftsmith.db
FRONTEND_URL=http://localhost:5173
```

### Step 4: Frontend Setup
```bash
cd frontend
npm install
```

### Step 5: Run the App

**Option A: Use startup scripts**
```bash
# Windows
start.bat

# Mac/Linux
chmod +x start.sh
./start.sh
```

**Option B: Manual (2 terminals)**

Terminal 1 (Backend):
```bash
cd backend
venv\Scripts\activate   # or source venv/bin/activate
python main.py
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

### Step 6: Open App
Navigate to: http://localhost:5173

---

## 🚀 First Campaign

### 1. Connect Gmail
- Click "Connect Gmail Account"
- Authorize the app
- You'll see "Connected as: your@email.com"

### 2. Create Campaign
**Pitch Example:**
```
I'm offering a free 30-minute SEO audit for e-commerce businesses.
I've helped companies increase organic traffic by 40% in 90 days.
```

**Settings:**
- Audience: B2B
- Tone: Professional
- Personalization: Medium

### 3. Add Recipients

**Option A: Manual**
- Click "Add Recipient"
- Fill in: email, name, company, role

**Option B: CSV**
- Click "Upload CSV"
- Use `sample_recipients.csv` as template

### 4. Generate Drafts
- Click "Generate Drafts"
- Watch progress in results page
- Preview drafts

### 5. Review & Send
- Click "Open Gmail Drafts"
- Review each draft in Gmail
- Make edits if needed
- Click Send (manually!)

---

## 📋 Sample CSV Format

```csv
email,first_name,last_name,company,role,location,linkedin_url,notes
john@example.com,John,Doe,Acme Corp,CEO,SF,https://linkedin.com/in/johndoe,Met at conference
jane@example.com,Jane,Smith,,,NYC,,Personal contact
```

**Required:** email
**Optional:** Everything else

---

## 🔧 Troubleshooting

### "Gmail OAuth not working"
- Ensure redirect URI is EXACTLY: `http://localhost:8000/auth/google/callback`
- Add your email as test user in OAuth consent screen
- Try incognito mode

### "OpenAI API error"
- Check API key is valid in `.env`
- Verify you have credits at https://platform.openai.com/usage
- Try model `gpt-4o-mini` (cheaper than gpt-4)

### "Frontend won't connect"
- Backend must be running on port 8000
- Frontend must be running on port 5173
- Check no other apps using these ports

### "No drafts appearing in Gmail"
- Wait a few seconds and refresh Gmail
- Check "Drafts" folder
- Verify correct Gmail account is connected

---

## 💡 Tips

1. **Start Small:** Test with 2-3 recipients first
2. **Low Personalization:** Use this for testing (faster, no research)
3. **Review Rationale:** Click "Preview" to see why the agent personalized each email
4. **Iterate:** After reviewing drafts, adjust your pitch and try again
5. **CSV Template:** Use `sample_recipients.csv` as starting point

---

## 🎯 Best Practices

### Writing Your Pitch
- Be specific about what you offer
- Include clear value proposition
- Mention who you help (target audience)
- Keep it concise (2-3 sentences)

### Good Pitch Examples

**B2B (SaaS):**
```
I help B2B SaaS companies reduce churn by 25% through better onboarding.
Our AI analyzes user behavior and automates personalized engagement.
```

**B2C (Freelance):**
```
I'm a freelance web designer specializing in modern, mobile-first websites
for small businesses. I can transform your online presence in 2 weeks.
```

**Investor Outreach:**
```
We're raising a seed round for our AI-powered recruitment platform.
We've grown 300% MoM and have $50k MRR with Fortune 500 customers.
```

### Lead Data Tips
- **More data = better personalization**
- LinkedIn URLs are gold (agent can research)
- Notes field is helpful for context
- Company + Role triggers B2B mode

### Personalization Levels
- **Low:** Generic, fast, safe (use for cold outreach)
- **Medium:** Role/company context (balanced)
- **High:** Public research (best for warm leads)

---

## 📊 Expected Results

**Low Personalization (1 recipient):**
- Processing: ~5 seconds
- No research

**Medium Personalization (10 recipients):**
- Processing: ~30-60 seconds
- Light research per recipient

**High Personalization (10 recipients):**
- Processing: ~60-120 seconds
- Full research per recipient

---

## 🛡️ Privacy & Ethics

DraftSmith is designed to be:
- ✅ Transparent (shows rationale)
- ✅ Respectful (opt-out included)
- ✅ Public-only (no private data)
- ✅ Human-controlled (no auto-send)

**Always:**
- Review before sending
- Respect opt-outs
- Don't spam
- Be honest

---

## Need Help?

1. Check [README.md](README.md) for full documentation
2. Check [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for technical details
3. Review backend logs for errors
4. Check browser console for frontend errors

---

**Ready to generate personalized emails at scale? Let's go! 🚀**
