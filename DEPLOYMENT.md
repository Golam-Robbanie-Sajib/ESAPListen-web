# 🚀 Deployment Guide

This guide walks you through deploying **ESAPListen** with backend on Render and frontend on Vercel.

---

## 📋 Prerequisites

Before deploying, ensure you have:
- [Render](https://render.com) account (for backend + database)
- [Vercel](https://vercel.com) account (for frontend)
- [Google Cloud](https://console.cloud.google.com) project for OAuth
- [GitHub](https://github.com/settings/developers) OAuth App
- [Google Gemini API](https://ai.google.dev) key

---

## 🎯 Architecture

```
Frontend (Vercel)  ←→  Backend API (Render)  ←→  PostgreSQL (Render)
   Next.js 14              FastAPI                  Database
```

---

## 🔧 Part 1: Backend Deployment (Render)

### 1.1 Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **PostgreSQL**
3. Configure:
   - **Name**: `esaplisten-db`
   - **Database**: `esaplisten`
   - **Region**: Choose closest region
   - **Plan**: Free (or Starter $7/month)
4. Click **Create Database**
5. **Copy the Internal Database URL** (starts with `postgresql://`)

### 1.2 Create Web Service

1. Click **New +** → **Web Service**
2. Connect GitHub repository
3. Configure:
   - **Name**: `esaplisten-api`
   - **Region**: Same as database
   - **Branch**: `main` (or your primary branch)
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command**:
     ```bash
     uvicorn main:app --host 0.0.0.0 --port $PORT
     ```
   - **Plan**: Free (or Starter $7/month)

### 1.3 Environment Variables

In Render Web Service, add these environment variables:

```bash
# Database (from step 1.1)
DATABASE_URL=postgresql://user:password@host/database

# Google Gemini AI
GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here

# JWT Secret (generate with: openssl rand -hex 32)
SECRET_KEY=your_random_secret_key_here

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Frontend URL (update after Vercel deployment)
FRONTEND_URL=https://your-app.vercel.app

# CORS (update after Vercel deployment)
ALLOWED_ORIGINS=https://your-app.vercel.app

# Environment
ENVIRONMENT=production
```

### 1.4 Deploy

1. Click **Create Web Service**
2. Wait for build (~3-5 minutes)
3. Your API will be at: `https://esaplisten-api.onrender.com`
4. Test: Visit `https://esaplisten-api.onrender.com/health`

---

## 🎨 Part 2: Frontend Deployment (Vercel)

### 2.1 Deploy to Vercel

#### Via Vercel Dashboard:

1. Go to [Vercel](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Configure:
   - **Framework**: Next.js (auto-detected)
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

### 2.2 Environment Variables

Add in Vercel project settings:

```bash
NEXT_PUBLIC_API_URL=https://esaplisten-api.onrender.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

### 2.3 Deploy

1. Click **Deploy**
2. Wait for build (~2-3 minutes)
3. Your app will be at: `https://your-app.vercel.app`

### 2.4 Update Backend CORS

After Vercel deployment:
1. Go back to Render dashboard
2. Update environment variables:
   ```bash
   FRONTEND_URL=https://your-actual-app.vercel.app
   ALLOWED_ORIGINS=https://your-actual-app.vercel.app
   ```
3. Manually redeploy the backend service

---

## 🔐 Part 3: OAuth Configuration

### Google OAuth Setup

1. [Google Cloud Console](https://console.cloud.google.com)
2. Select project → **APIs & Services** → **Credentials**
3. Edit OAuth 2.0 Client
4. **Authorized redirect URIs**:
   ```
   https://your-app.vercel.app
   https://esaplisten-api.onrender.com/api/auth/google
   ```
5. **Authorized JavaScript origins**:
   ```
   https://your-app.vercel.app
   https://esaplisten-api.onrender.com
   ```

### GitHub OAuth Setup

1. [GitHub Developer Settings](https://github.com/settings/developers)
2. Edit OAuth App
3. **Homepage URL**: `https://your-app.vercel.app`
4. **Authorization callback URL**:
   ```
   https://esaplisten-api.onrender.com/api/auth/github/callback
   ```

---

## ✅ Verification

### Test Backend
```bash
curl https://esaplisten-api.onrender.com/health
# Should return: {"status": "healthy"}
```

### Test Frontend
1. Visit your Vercel URL
2. Sign in with Google/GitHub
3. Upload test audio
4. Verify transcription works

---

## 🔍 Troubleshooting

### Common Issues

**CORS Errors**
- Verify `ALLOWED_ORIGINS` matches your Vercel URL exactly
- Redeploy backend after changing environment variables
- Check browser console for specific origin

**Database Connection**
- Use Internal Database URL (not External)
- Check database status in Render dashboard
- Verify DATABASE_URL has no typos

**OAuth Fails**
- Double-check redirect URIs in Google/GitHub
- Ensure client IDs match in frontend and backend
- Clear browser cookies and try again

**API Calls Timeout**
- Render free tier can cold-start (15-30 seconds)
- Consider upgrading to paid tier for instant response
- Check Render logs for specific errors

### View Logs

**Render Logs:**
Dashboard → Service → Logs tab

**Vercel Logs:**
Project → Deployments → Select deployment → Function Logs

---

## 🔄 Auto-Deployment

Both platforms auto-deploy on git push:

```bash
git add .
git commit -m "Update app"
git push origin main
```

- **Render**: Auto-deploys backend
- **Vercel**: Auto-deploys frontend

---

## 💰 Pricing

### Free Tier
- Render: PostgreSQL (90 days) + 750 hours web service/month
- Vercel: 100GB bandwidth, unlimited deployments
- **Total**: $0/month (with limitations)

### Production (Recommended)
- Render: Starter DB ($7) + Starter service ($7)
- Vercel: Pro ($20/month)
- **Total**: ~$34/month

---

## 🎉 Success Checklist

- [ ] Backend deployed to Render
- [ ] Database connected
- [ ] Frontend deployed to Vercel
- [ ] Environment variables set
- [ ] OAuth configured (Google & GitHub)
- [ ] CORS configured
- [ ] Health check passes
- [ ] Sign-in works
- [ ] Audio upload works
- [ ] Analysis generates correctly

---

## 📚 Additional Resources

- [Render Docs](https://render.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**Need Help?** Check logs in Render/Vercel dashboards for detailed error messages.
