# 🎙️ ESAPListen - AI-Powered Meeting Analysis Platform

> Transform meeting recordings into actionable intelligence with AI-powered transcription, analysis, and smart task management.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Google Gemini](https://img.shields.io/badge/Google-Gemini%202.0-4285F4?logo=google)](https://ai.google.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python)](https://python.org/)

---

## 📖 Overview

**ESAPListen** is a comprehensive meeting intelligence platform that automates the process of recording, transcribing, and analyzing meetings. Powered by Google's Gemini 2.0 Flash AI, it extracts actionable tasks, events, and insights from your meeting recordings.

###  Key Features

✨ **Smart Recording** - Browser-based and file upload recording
🤖 **AI Transcription** - Powered by Google Gemini 2.0 Flash
📅 **Auto Task Extraction** - Automatically identifies tasks, deadlines, and action items
📊 **Meeting Analytics** - Duration tracking, completion rates, urgency detection
🗓️ **Calendar Integration** - Google Calendar sync for events
🔍 **Query Analysis** - Ask questions about your meetings
👥 **Multi-User Support** - OAuth authentication (Google & GitHub)
🎨 **Modern UI** - Clean, responsive interface with dark mode

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Vercel)                     │
│  ┌────────────┐  ┌──────────┐  ┌─────────┐  ┌─────────┐   │
│  │ Next.js 14 │  │ React 18 │  │ Tailwind│  │TypeScript│   │
│  └────────────┘  └──────────┘  └─────────┘  └─────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS/REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       Backend (Render)                       │
│  ┌──────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │ FastAPI  │  │PostgreSQL  │  │  Google Gemini 2.0     │  │
│  │  Python  │  │  Database  │  │  Flash AI Engine       │  │
│  └──────────┘  └────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Frontend
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **UI**: Tailwind CSS + shadcn/ui components
- **State**: React Hooks + Context API
- **Auth**: Google OAuth 2.0 + GitHub OAuth
- **Icons**: Lucide React

#### Backend
- **Framework**: FastAPI (async Python)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **AI**: Google Gemini 2.0 Flash
- **Audio**: Web Audio API / File Upload
- **Calendar**: Google Calendar API

---

## 🚀 Quick Start

### Prerequisites

```bash
# Required
- Node.js 18+ and npm
- Python 3.10+
- PostgreSQL (or use Render's managed database)
- Google Cloud account (for Gemini API & OAuth)
- GitHub account (for OAuth)
```

### Local Development

#### 1. Clone Repository

```bash
git clone https://github.com/Golam-Robbanie-Sajib/EsapListenWeb.git
cd EsapListenWeb
```

#### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
DATABASE_URL=sqlite:///meetings.db  # For local dev
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
SECRET_KEY=$(openssl rand -hex 32)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
EOF

# Start backend
uvicorn main:app --reload --port 8000
```

Backend will run at `http://localhost:8000`

#### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
EOF

# Start frontend
npm run dev
```

Frontend will run at `http://localhost:3000`

---

## 📚 Features in Detail

### 1. Meeting Recording & Upload

**Multiple Input Methods:**
- 🎤 **Browser Recording**: Record directly in the browser
- 📁 **File Upload**: Upload pre-recorded audio files (MP3, WAV, WebM, M4A)
- ⚙️ **Configurable Options**:
  - Meeting role (Manager, Participant, Observer)
  - Output fields (Summary, Tasks, Events, Notes)
  - Custom queries for specific analysis

### 2. AI-Powered Analysis

**Gemini 2.0 Flash Processing:**
- **Transcription**: Accurate speech-to-text conversion
- **Summarization**: Bilingual summaries (English + Original Language)
- **Event Extraction**: Automatically identifies:
  - 📅 Dated Events (with deadlines)
  - ✅ Tasks (action items)
  - 📝 Notes (decisions, budgets, general info)
- **Smart Categorization**:
  - Urgency detection (high/medium/low → yes/no)
  - Category classification (DECISION, BUDGET, ACTION, GENERAL)

### 3. Dashboard

**Real-Time Insights:**
- 📊 Total meetings count
- ⏱️ Average meeting duration
- ✅ Task completion rate
- 📈 Weekly meeting trend chart
- 📋 Upcoming events widget
- 🎯 Recent tasks list

### 4. Task Management

**Features:**
- ✅ Mark tasks complete/incomplete
- 🔍 Search and filter by status/urgency
- 📅 Date-based organization
- 🗑️ Delete tasks
- 🎨 Urgency indicators (color-coded)
- ↕️ Auto-sort (uncompleted first, then by date)

### 5. Events & Calendar

**Event Tracking:**
- 📅 All events view with filtering
- 🔄 Google Calendar sync
- 📊 Event statistics
- 🗓️ Calendar view
- 📤 Export to CSV/ICS

### 6. Notes System

**Organized Information:**
- 🏷️ Category tags (DECISION, BUDGET, ACTION, GENERAL)
- 🔍 Search functionality
- 📑 Pagination
- 🎨 Color-coded categories
- 🗑️ Delete notes

### 7. Query Analysis

**Ask Questions About Meetings:**
- 💬 Natural language queries
- 🤖 Gemini-powered analysis
- 📊 Query type classification (summary, analysis, list, etc.)
- 📅 Date extraction from answers → auto-create events
- 💰 Budget detection → auto-create budget notes
- 📜 Query history

### 8. Analytics

**Meeting Insights:**
- 📊 Meetings per month chart
- ⏰ Duration distribution
- 📈 Task completion trends
- 🎯 Category breakdowns
- 📉 Performance metrics

---

## 🗄️ Database Schema

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    google_id VARCHAR UNIQUE,
    github_id VARCHAR UNIQUE,
    password_hash VARCHAR,
    name VARCHAR,
    picture VARCHAR,
    created_at TIMESTAMP DEFAULT NOW(),
    calendar_access_token TEXT,
    calendar_refresh_token TEXT,
    calendar_token_expiry TIMESTAMP,
    calendar_connected BOOLEAN DEFAULT FALSE
);

-- Meetings table
CREATE TABLE meetings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    job_id VARCHAR UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    raw_transcript TEXT,
    final_summary TEXT,  -- JSON: {title, english, original_language}
    user_input TEXT,     -- Custom query
    user_input_result TEXT,  -- Query result JSON
    calendar_synced BOOLEAN DEFAULT FALSE,
    audio_duration INTEGER,    -- seconds
    processing_time INTEGER    -- seconds
);

-- Events table (stores tasks, events, notes)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
    event_type VARCHAR NOT NULL,  -- 'dated_events', 'tasks', 'notes'
    event_data TEXT NOT NULL      -- JSON with event details
);

-- User Presets table
CREATE TABLE user_presets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR NOT NULL,
    config TEXT NOT NULL,  -- JSON configuration
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🎨 UI Components

### Pages

| Route | Description |
|-------|-------------|
| `/dashboard` | Main dashboard with analytics and widgets |
| `/analytics` | Detailed analytics and charts |
| `/history` | All past meetings |
| `/calendar` | Calendar view of events |
| `/events` | All events list |
| `/tasks` | Task management |
| `/notes` | Notes library |
| `/queries` | Query history |
| `/settings` | User preferences and calendar sync |

### Key Features

- 🌓 **Dark Mode Support**
- 📱 **Fully Responsive**
- ♿ **Accessibility Compliant**
- 🎨 **Consistent Design System**
- ⚡ **Fast Page Loads**
- 🔄 **Optimistic UI Updates**

---

## 🔐 Security

### Authentication
- OAuth 2.0 (Google & GitHub)
- JWT tokens with refresh rotation
- Secure password hashing (bcrypt)
- Email verification
- Password reset flow

### Authorization
- User-specific data isolation
- Meeting ownership verification
- API endpoint protection
- CORS configuration

### Data Privacy
- User data encrypted at rest
- Secure OAuth token storage
- No third-party data sharing
- GDPR-compliant

---

## 📦 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment guide.

**Quick Deploy:**

1. **Backend (Render)**:
   - PostgreSQL database
   - FastAPI web service
   - Environment variables configured

2. **Frontend (Vercel)**:
   - One-click GitHub deployment
   - Auto-deploy on push
   - Environment variables in dashboard

---

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```bash
DATABASE_URL=postgresql://user:password@host/database
GOOGLE_GEMINI_API_KEY=your_key
SECRET_KEY=your_secret
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_secret
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_secret
FRONTEND_URL=https://your-app.vercel.app
ALLOWED_ORIGINS=https://your-app.vercel.app
```

#### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript/Python best practices
- Write meaningful commit messages
- Add comments for complex logic
- Test before submitting PR
- Update documentation as needed

---

## 📝 API Documentation

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/process-audio` | Upload and process meeting |
| GET | `/api/meetings` | Get all user meetings |
| GET | `/api/meetings/{id}` | Get meeting details |
| DELETE | `/api/meetings/{id}` | Delete meeting |
| PATCH | `/api/events/{id}/toggle-complete` | Toggle task completion |
| DELETE | `/api/events/{id}` | Delete event/task |
| DELETE | `/api/notes/{id}` | Delete note |
| POST | `/api/auth/google` | Google OAuth login |
| POST | `/api/auth/github` | GitHub OAuth login |
| GET | `/api/analytics` | Get user analytics |

Full API docs available at `/docs` when running backend locally.

---

## 🐛 Troubleshooting

### Common Issues

**"Failed to load meetings"**
- Check backend is running
- Verify `NEXT_PUBLIC_API_URL` is correct
- Check browser console for CORS errors

**"Authentication failed"**
- Verify OAuth credentials are correct
- Check redirect URIs in Google/GitHub console
- Clear browser cookies and try again

**"Database connection failed"**
- Verify `DATABASE_URL` format is correct
- Check PostgreSQL is running
- Ensure database exists

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors

**Golam Robbanie Sajib**
- Email: sajib.sqr48164816@gmail.com
- GitHub: [@Golam-Robbanie-Sajib](https://github.com/Golam-Robbanie-Sajib)

---

## 🙏 Acknowledgments

- **Google Gemini** - Powerful AI processing
- **Next.js Team** - Amazing React framework
- **FastAPI** - Modern Python web framework
- **Vercel & Render** - Reliable hosting platforms
- **Open Source Community** - Countless helpful libraries

---

## 📞 Support

- 📧 Email: sajib.sqr48164816@gmail.com
- 🐛 Issues: [GitHub Issues](https://github.com/Golam-Robbanie-Sajib/EsapListenWeb/issues)
- 📖 Docs: This README and [DEPLOYMENT.md](DEPLOYMENT.md)

---

<div align="center">

**Built with ❤️ for better meetings**

*Transform your meetings into actionable insights*

[Live Demo](#) • [Documentation](#) • [Report Bug](https://github.com/Golam-Robbanie-Sajib/EsapListenWeb/issues)

</div>
