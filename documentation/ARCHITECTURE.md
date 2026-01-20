# DraftSmith System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
│                     (Web Browser)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND (React)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Campaign    │  │   Results    │  │    Gmail     │     │
│  │  Builder     │  │     Page     │  │  Connection  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│              Tailwind CSS + Vite                           │
└────────────────────┬───────────────────────────────────────┘
                     │
                     │ REST API (JSON)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                BACKEND (FastAPI)                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              API Endpoints                           │  │
│  │  /api/health  /api/run  /auth/google/*              │  │
│  └──────────┬───────────────────────────────────────────┘  │
│             │                                               │
│             ▼                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Agentic Workflow Engine                    │  │
│  │  • Outreach Mode Detection                           │  │
│  │  • Research Decision Logic                           │  │
│  │  • Personalization Synthesis                         │  │
│  │  • Draft Generation                                  │  │
│  └──────┬───────────────────────────┬───────────────────┘  │
│         │                           │                       │
│         ▼                           ▼                       │
│  ┌──────────────┐          ┌──────────────┐               │
│  │   OpenAI     │          │   Gmail      │               │
│  │     API      │          │     API      │               │
│  │              │          │              │               │
│  │ • Research   │          │ • OAuth      │               │
│  │ • Drafting   │          │ • Drafts     │               │
│  └──────────────┘          └──────────────┘               │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              SQLite Database                         │  │
│  │  • GoogleAuth  • Run  • Recipient                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Campaign Creation

```
1. USER CREATES CAMPAIGN
   │
   ├─ Enters pitch: "I offer free SEO audits..."
   ├─ Selects: B2B, Professional, Medium personalization
   ├─ Adds recipients (manual or CSV)
   └─ Clicks "Generate Drafts"

2. FRONTEND SENDS REQUEST
   │
   POST /api/run
   {
     "pitch": "...",
     "audience_type": "b2b",
     "tone": "professional",
     "personalization_level": "medium",
     "recipients": [...]
   }

3. BACKEND CREATES RUN
   │
   ├─ Generate run_id
   ├─ Save run to database
   ├─ Save all recipients to database
   └─ Return run_id to frontend

4. FRONTEND TRIGGERS GENERATION
   │
   POST /api/run/{run_id}/generate

5. BACKEND PROCESSES EACH RECIPIENT
   │
   FOR EACH recipient:
   │
   ├─ STEP 1: Determine Outreach Mode
   │   └─ B2B or B2C? (based on company/role)
   │
   ├─ STEP 2: Should Research?
   │   └─ Medium/High personalization? YES → research
   │
   ├─ STEP 3: Public Research (if needed)
   │   ├─ Build search query
   │   ├─ Call OpenAI with web search
   │   └─ Extract: summary, confidence, hooks
   │
   ├─ STEP 4: Personalization Synthesis
   │   ├─ Combine: pitch + recipient data + research
   │   ├─ Apply safety rules
   │   └─ Extract 0-2 safe hooks
   │
   ├─ STEP 5: Draft Email
   │   ├─ Call OpenAI with structured output
   │   └─ Get: subject, body, rationale
   │
   ├─ STEP 6: Create Gmail Draft
   │   ├─ Build MIME message
   │   ├─ Call Gmail API
   │   └─ Get draft_id
   │
   └─ Update recipient in database

6. FRONTEND POLLS FOR RESULTS
   │
   GET /api/run/{run_id}
   (every 2 seconds until status = 'completed')

7. RESULTS DISPLAYED
   │
   ├─ Show stats: 10 drafted, 0 failed
   ├─ Table of all recipients
   └─ Preview button for each draft

8. USER REVIEWS & SENDS
   │
   ├─ Click "Open Gmail Drafts"
   ├─ Review in Gmail
   └─ Manually send each email
```

---

## Agentic Decision Tree

```
START: New Recipient
│
├─ Has lead_type?
│  ├─ YES → Use it (B2B/B2C)
│  └─ NO → Continue
│
├─ Has company OR role?
│  ├─ YES → Infer B2B
│  └─ NO → Infer B2C
│
└─ OUTREACH MODE DETERMINED
   │
   ├─ Personalization = Low?
   │  ├─ YES → SKIP RESEARCH → Generate Generic Draft
   │  └─ NO → Continue
   │
   ├─ Personalization = Medium/High?
   │  └─ YES → PERFORM RESEARCH
   │     │
   │     ├─ Has LinkedIn URL?
   │     │  └─ YES → Search LinkedIn profile
   │     │
   │     ├─ Has Name + Company + Role?
   │     │  └─ YES → Search "Name Company Role"
   │     │
   │     ├─ Has Name + Location?
   │     │  └─ YES → Search "Name Location"
   │     │
   │     ├─ B2B + Has Company?
   │     │  └─ YES → Search company info
   │     │
   │     └─ Else → LOW CONFIDENCE
   │
   ├─ RESEARCH COMPLETE
   │  │
   │  ├─ Confidence = High/Medium?
   │  │  └─ YES → Extract 0-2 safe hooks
   │  │
   │  └─ Confidence = Low?
   │     └─ YES → Use GENERIC messaging
   │
   └─ GENERATE DRAFT
      │
      ├─ Combine: Pitch + Recipient Data + Hooks
      ├─ Apply: Tone, Safety Rules, Length Constraints
      ├─ Include: Greeting, Pitch, Personalization, CTA, Opt-out
      │
      └─ CREATE GMAIL DRAFT
         │
         └─ DONE ✅
```

---

## Database Schema

```sql
-- Store Google OAuth credentials
GoogleAuth:
  id              INTEGER PRIMARY KEY
  email           STRING UNIQUE
  access_token    TEXT
  refresh_token   TEXT
  token_uri       STRING
  client_id       STRING
  client_secret   STRING
  scopes          JSON
  expiry          DATETIME
  created_at      DATETIME
  updated_at      DATETIME

-- Store campaign runs
Run:
  id                      STRING PRIMARY KEY (UUID)
  user_email              STRING
  pitch                   TEXT
  audience_type           STRING (b2b|b2c|mixed)
  tone                    STRING (friendly|professional|neutral)
  personalization_level   STRING (low|medium|high)
  status                  STRING (queued|processing|completed|failed)
  created_at              DATETIME
  updated_at              DATETIME

-- Store recipients and draft results
Recipient:
  id                        INTEGER PRIMARY KEY
  run_id                    STRING (FK to Run)

  -- Input data
  email                     STRING
  first_name                STRING
  last_name                 STRING
  company                   STRING
  role                      STRING
  location                  STRING
  lead_type                 STRING
  notes                     TEXT
  linkedin_url              STRING
  personal_website_url      STRING
  company_website_url       STRING
  tags                      STRING

  -- Processing results
  status                    STRING (queued|researched|drafted|failed)
  inferred_outreach_mode    STRING (b2b|b2c)
  research_summary          TEXT
  research_confidence       STRING (high|medium|low)
  subject                   STRING
  body                      TEXT
  rationale                 TEXT
  used_personalization_level STRING
  draft_id                  STRING (Gmail draft ID)

  created_at                DATETIME
  updated_at                DATETIME
```

---

## Security & Privacy Layers

```
┌──────────────────────────────────────────────────┐
│            SAFETY LAYER 1: INPUT                 │
│  • User provides only what they know             │
│  • No scraped private data                       │
│  • Explicit consent for public research          │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│         SAFETY LAYER 2: RESEARCH                 │
│  • Only publicly available sources               │
│  • No private databases                          │
│  • No social media scraping without URL          │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│      SAFETY LAYER 3: PERSONALIZATION             │
│  • Filter out sensitive topics                   │
│  • Never reference private info                  │
│  • Downshift if confidence is low                │
│  • Limit to 0-2 hooks max                        │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│         SAFETY LAYER 4: DRAFT GENERATION         │
│  • Professional tone enforcement                 │
│  • No creepy phrasing detection                  │
│  • Respectful opt-out required                   │
│  • Length constraints (90-160 words)             │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│         SAFETY LAYER 5: HUMAN APPROVAL           │
│  • Draft created, NOT sent                       │
│  • User reviews in Gmail                         │
│  • User can edit or delete                       │
│  • User clicks Send manually                     │
└──────────────────────────────────────────────────┘
```

---

## API Request/Response Examples

### Create Run
```http
POST /api/run
Content-Type: application/json

{
  "pitch": "I offer free SEO audits for e-commerce businesses.",
  "audience_type": "b2b",
  "tone": "professional",
  "personalization_level": "medium",
  "recipients": [
    {
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "company": "Acme Corp",
      "role": "CEO"
    }
  ]
}

Response 200:
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "created"
}
```

### Get Run Status
```http
GET /api/run/550e8400-e29b-41d4-a716-446655440000

Response 200:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_email": "you@gmail.com",
  "pitch": "I offer free SEO audits...",
  "audience_type": "b2b",
  "tone": "professional",
  "personalization_level": "medium",
  "status": "completed",
  "created_at": "2025-01-20T10:30:00Z",
  "recipients": [
    {
      "id": 1,
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "company": "Acme Corp",
      "role": "CEO",
      "status": "drafted",
      "inferred_outreach_mode": "b2b",
      "subject": "Quick question about Acme Corp's SEO strategy",
      "body": "Hi John,\n\nI noticed Acme Corp...",
      "rationale": "B2B approach focusing on company name and role...",
      "draft_id": "r123456789",
      "research_confidence": "medium"
    }
  ]
}
```

---

## Component Interaction Flow

```
App.jsx
├─ manages: currentView, currentRunId, authStatus
├─ provides: handleRunCreated, handleDisconnect
│
├─ When view = 'builder':
│  └─ renders: <CampaignBuilder />
│     ├─ Gmail connection UI
│     ├─ Campaign config form
│     ├─ Recipient management
│     ├─ CSV upload
│     └─ onRunCreated() → switch to results
│
└─ When view = 'results':
   └─ renders: <ResultsPage />
      ├─ Polls /api/run/{id} every 2s
      ├─ Displays stats + table
      ├─ Draft preview modal
      └─ onBack() → switch to builder
```

---

## Technology Choices Rationale

| Technology | Why? |
|------------|------|
| **React + Vite** | Fast dev experience, modern tooling, easy to learn |
| **Tailwind CSS** | Rapid UI development, consistent design, no CSS files |
| **FastAPI** | Fast, modern Python framework, auto-docs, type safety |
| **SQLite** | Zero-config, portable, perfect for local demo |
| **OpenAI API** | Best-in-class LLM, structured outputs, web search |
| **Gmail API** | Direct integration, secure OAuth, draft support |

---

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Gmail OAuth | 2-5s | User authorization flow |
| Create Run | <100ms | Database insert only |
| Draft (Low) | 2-5s | No research, direct to OpenAI |
| Draft (Medium) | 5-10s | Light research + draft |
| Draft (High) | 10-20s | Full research + draft |
| 10 Recipients (Medium) | 50-100s | Sequential processing |

---

## Future Enhancements (Out of Scope)

- [ ] Parallel recipient processing
- [ ] Email scheduling
- [ ] A/B testing
- [ ] Analytics dashboard
- [ ] Template library
- [ ] Team collaboration
- [ ] Multi-language support
- [ ] Advanced research (news, social signals)
- [ ] Follow-up sequences
- [ ] CRM integration

---

This architecture is designed for:
✅ **Clarity** - Easy to understand
✅ **Safety** - Privacy-first design
✅ **Extensibility** - Easy to add features
✅ **Demo Value** - Shows agentic capabilities clearly
