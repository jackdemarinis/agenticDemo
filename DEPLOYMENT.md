# Railway Deployment Guide for DraftSmith

## Step-by-Step Deployment Instructions

### 1. Create Railway Account & Project

1. Go to https://railway.app/
2. Click "Start a New Project"
3. Sign in with your GitHub account
4. Click "Deploy from GitHub repo"
5. Select `agentic-demo` repository
6. Railway will auto-detect Python and create a service

### 2. Configure Backend Service

#### A. Add Environment Variables

In Railway dashboard, go to your service → Variables tab and add:

```
OPENAI_API_KEY=your_openai_key_here
OPENAI_MODEL=gpt-4o-mini
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-backend-url.railway.app/auth/google/callback
APP_PASSWORD=DraftSmith2026!
SECRET_KEY=your_secret_key_here
FRONTEND_URL=https://your-frontend-url.railway.app
DATABASE_URL=sqlite:///./draftsmith.db
PORT=8000
```

**Important:** Replace `your-backend-url` and `your-frontend-url` with actual Railway URLs (you'll get these after deployment)

#### B. Add Persistent Volume for SQLite

1. In your backend service, go to "Settings" → "Volumes"
2. Click "New Volume"
3. Mount Path: `/app/backend`
4. Click "Add"

This ensures your SQLite database persists across deployments.

### 3. Deploy Frontend (Static Site)

Railway can host both backend and frontend in the same project:

1. In Railway dashboard, click "New" → "Empty Service"
2. Connect the same GitHub repo
3. Go to Settings → "Root Directory" and set to `frontend`
4. Railway will auto-detect Vite and build it

#### Add Frontend Environment Variable

In frontend service → Variables:

```
VITE_API_BASE_URL=https://your-backend-url.railway.app
```

### 4. Update Google OAuth Redirect URI

1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Navigate to your OAuth 2.0 Client
3. Add authorized redirect URI:
   ```
   https://your-backend-url.railway.app/auth/google/callback
   ```
4. Add authorized JavaScript origin:
   ```
   https://your-frontend-url.railway.app
   ```

### 5. Test Your Deployment

1. Open your frontend URL: `https://your-frontend-url.railway.app`
2. Login with password: `DraftSmith2026!`
3. Connect Gmail account
4. Upload CSV and generate drafts

## Important Notes

- **First deployment takes 3-5 minutes** as Railway builds your app
- **SQLite database** is stored in the persistent volume
- **Auto-deploys** happen on every GitHub push to main branch
- **Estimated cost:** $5-10/month for low traffic

## Troubleshooting

### Backend won't start
- Check logs in Railway dashboard
- Verify all environment variables are set
- Ensure Python dependencies installed correctly

### Frontend can't reach backend
- Verify `VITE_API_BASE_URL` is set correctly
- Check CORS settings in backend (FRONTEND_URL)
- Ensure backend is running (check service status)

### OAuth errors
- Verify Google redirect URIs include Railway URLs
- Check GOOGLE_REDIRECT_URI matches exactly
- Ensure FRONTEND_URL is correct

### Database resets on deploy
- Verify persistent volume is mounted at `/app/backend`
- Check volume settings in Railway dashboard

## Updating Your App

Simply push to GitHub:
```bash
git add .
git commit -m "Update message"
git push
```

Railway will automatically detect changes and redeploy.
