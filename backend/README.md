# Backend - Multi-User Listening Agent

FastAPI backend with Google OAuth authentication, multi-user support, and AI-powered meeting analysis.

## 🗂️ Project Structure

```
backend/
├── main.py                    # FastAPI application entry point
├── auth.py                    # Google OAuth + JWT authentication
├── database.py                # SQLAlchemy models and database operations
├── transcription_service.py   # Audio enhancement + transcription (AssemblyAI)
├── llm_synthesizer.py         # Event extraction (Gemini)
├── calendar_client.py         # Google Calendar OAuth integration
├── requirements_backend.txt   # Python dependencies
└── uploads/                   # Temporary audio file storage
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements_backend.txt
```

### 2. Configure Environment

```bash
cp ../.env.example .env
```

Edit `.env` with your API keys:
- `ASSEMBLYAI_API_KEY` - From [assemblyai.com](https://www.assemblyai.com/)
- `GEMINI_API_KEY` - From [ai.google.dev](https://ai.google.dev/)
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - From [Google Cloud Console](https://console.cloud.google.com/)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET_KEY` - Random secret key for JWT tokens

### 3. Initialize Database

```bash
python -c "from database import init_db; init_db()"
```

### 4. Run Server

```bash
python main.py
```

Server runs on: `http://localhost:8000`

API docs: `http://localhost:8000/docs`

## 🔑 Key Features

### Audio Processing Pipeline
1. **Upload** - User uploads audio file
2. **Enhancement** - Pedalboard DRC (Dynamic Range Compression)
3. **Transcription** - AssemblyAI with automatic speaker diarization
4. **Analysis** - Google Gemini extracts action items, deadlines, notes
5. **Storage** - Save to PostgreSQL database
6. **Calendar** - Optionally sync events to user's Google Calendar

### Authentication
- Google OAuth 2.0 sign-in
- JWT access tokens (15 min expiry)
- Refresh tokens (7 day expiry)
- User isolation and data security

### Multi-User Features
- Each user has isolated data access
- Custom presets per user
- Personal Google Calendar integration
- User-scoped job IDs

## 📡 API Endpoints

### Authentication
- `POST /api/auth/google` - Authenticate with Google OAuth token
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user info

### Meetings
- `POST /api/process-audio` - Upload and process audio file
- `GET /api/job/{job_id}/status` - Get processing status
- `GET /api/job/{job_id}/result` - Get final results
- `GET /api/meetings` - List user's meetings
- `GET /api/meetings/{job_id}` - Get meeting details
- `DELETE /api/meetings/{job_id}` - Delete meeting
- `POST /api/meetings/{job_id}/sync-calendar` - Sync to calendar

### Presets
- `GET /api/presets` - List user's custom presets
- `POST /api/presets` - Create new preset
- `PUT /api/presets/{id}` - Update preset
- `DELETE /api/presets/{id}` - Delete preset

### Calendar OAuth
- `GET /api/calendar/auth-url` - Get Google OAuth URL
- `POST /api/calendar/callback` - Handle OAuth callback
- `POST /api/calendar/disconnect` - Disconnect calendar

## 🗄️ Database Models

### Users
- OAuth authentication data
- Calendar tokens (encrypted)
- User preferences

### Meetings
- User-scoped meeting records
- Transcripts and analysis
- Custom query results

### Events
- Extracted action items
- Deadlines and notes

### UserPresets
- Custom analysis configurations
- Reusable presets

## 🔧 Configuration

### Environment Variables

```bash
# Transcription
TRANSCRIPTION_PROVIDER=assemblyai
ASSEMBLYAI_API_KEY=your_key

# AI Analysis
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_key

# Authentication
GOOGLE_CLIENT_ID=your_oauth_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_oauth_client_secret
JWT_SECRET_KEY=your_random_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/listening_agent

# Frontend
FRONTEND_URL=http://localhost:3000

# Server
PORT=8000
```

## 🎵 Audio Enhancement

The backend uses **Pedalboard** for Dynamic Range Compression (DRC):

```python
# DRC Chain: Compressor -> Gain -> Limiter
Compressor(threshold_db=-25, ratio=4, attack_ms=2, release_ms=50)
Gain(gain_db=15)  # Boost quiet parts
Limiter(threshold_db=-1.0)  # Safety ceiling
```

This ensures consistent audio levels before transcription, improving accuracy for speakers at varying distances from the microphone.

## 🚢 Deployment

### Railway (Recommended)

1. Connect GitHub repository
2. Railway auto-detects Python
3. Add environment variables
4. Deploy automatically

### Render

1. Create new Web Service
2. Build: `pip install -r requirements_backend.txt`
3. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables

### Docker

```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements_backend.txt .
RUN pip install -r requirements_backend.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 🔐 Security

- All endpoints require authentication (except `/api/auth/*`)
- User ownership verified on all data access
- CORS restricted to frontend domain
- JWT tokens with expiration
- Calendar tokens stored securely
- SQL injection prevention (SQLAlchemy ORM)

## 📊 Monitoring

### Development
```bash
# View logs
tail -f logs/app.log
```

### Production
- Railway: View logs in dashboard
- Render: View logs in dashboard
- Set up error tracking (Sentry)

## 🐛 Troubleshooting

### Database Connection Fails
- Verify `DATABASE_URL` is correct
- Check PostgreSQL is running
- Test connection string

### Google Auth Fails
- Verify OAuth credentials in `.env`
- Check redirect URIs in Google Cloud Console
- Ensure Google APIs are enabled

### Transcription Fails
- Verify `ASSEMBLYAI_API_KEY` is valid
- Check API usage limits
- Ensure audio file format is supported

### Pedalboard Not Working
- Install: `pip install pedalboard`
- Check import errors in logs
- Falls back to unenhanced audio if unavailable

## 📚 Dependencies

### Core
- **FastAPI** - Web framework
- **SQLAlchemy** - Database ORM
- **PostgreSQL** - Production database

### Audio
- **Pedalboard** - Audio enhancement (DRC)
- **soundfile** - Audio I/O
- **torch + torchaudio** - Audio processing

### AI Services
- **AssemblyAI** - Transcription + diarization
- **Google Gemini** - Event extraction

### Authentication
- **python-jose** - JWT tokens
- **google-auth** - OAuth integration

## 💰 Cost Estimates

**API Usage (per hour of audio):**
- AssemblyAI: ~$0.90 (at $0.00025/second)
- Gemini: Free tier (15 req/min) or minimal cost

**Infrastructure:**
- Railway: ~$20/month (backend + database)
- Or Render: Free tier available

## 📖 Related Documentation

- [Main README](../README_MULTIUSER.md) - Full application documentation
- [Deployment Guide](../DEPLOYMENT.md) - Production deployment
- [API Reference](http://localhost:8000/docs) - Interactive API docs

---

**Backend is production-ready for multi-user deployment! 🚀**
