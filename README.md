# Coding JSON Practice Website

A web-based tool for generating and managing JSON files for coding questions, with AI-powered content generation.

## Project Structure

```
CodingJSONPracticeWebsite/
├── frontend/           # Static frontend (deploy to Netlify)
│   ├── index.html     # Single-page application
│   └── README.md
│
├── backend/           # Python Flask API (deploy to Render)
│   ├── content_generator_server.py
│   ├── prompts.py
│   ├── requirements.txt
│   ├── Procfile
│   └── README.md
│
└── README.md (this file)
```

## Features

### 1. JSON Generator
- Convert Lua files to JSON format
- Support for standard and node-based questions
- Automatic test case parsing
- ID preservation for updates

### 2. ID Changer
- Bulk update IDs in existing JSON files
- Preserves data structure

### 3. Content Generator (AI-Powered)
- Generate hints for coding problems
- Generate real-life examples
- Track API usage and costs
- Persistent form state

## Quick Start

### Frontend (Local)
```bash
open frontend/index.html
```

### Backend (Local)
```bash
cd backend
pip install -r requirements.txt
python3 content_generator_server.py
```

Server runs on `http://localhost:5001`

## Deployment

See individual README files in `frontend/` and `backend/` folders for deployment instructions.

## Technologies

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Python, Flask, Gunicorn
- **AI**: GPT-4o for content generation
- **Deployment**: Netlify (frontend) + Render (backend)

