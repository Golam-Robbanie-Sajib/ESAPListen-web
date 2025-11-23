#!/bin/bash

# Start script for Listening Agent backend

echo "🚀 Starting Listening Agent Backend..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Copy .env.example to .env and configure your API keys"
    echo "   cp ../.env.example .env"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install/update dependencies
echo "📥 Installing dependencies..."
pip install -q -r requirements_backend.txt

# Initialize database
echo "🗄️  Initializing database..."
python -c "from database import init_db; init_db()" 2>/dev/null || echo "   Database already initialized"

# Start server
echo "✅ Starting FastAPI server on port 8000..."
echo "📖 API Docs: http://localhost:8000/docs"
echo ""
python main.py
