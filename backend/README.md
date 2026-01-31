# Backend API

Flask REST API for AI-powered content generation.

## Files

- `content_generator_server.py` - Main Flask application
- `prompts.py` - AI prompts for hints and real-life examples
- `llm_client.py` - LLM API client (reference)
- `requirements.txt` - Python dependencies
- `Procfile` - Deployment configuration for Render
- `usage_tracker.json` - API usage statistics (auto-created)

## API Endpoints

### `POST /generate-content`
Generate hints and real-life examples for a coding problem.

**Request:**
```json
{
  "problem_name": "Two Sum",
  "problem_description": "Given an array...",
  "solution_code": "class Solution { ... }"
}
```

**Response:**
```json
{
  "success": true,
  "hints": "...",
  "real_life_examples": "...",
  "usage": { ... },
  "tracker": { ... }
}
```

### `GET /usage-stats`
Get current API usage statistics.

### `GET /health`
Health check endpoint.

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
python3 content_generator_server.py
```

Server runs on `http://localhost:5001`

## Environment Variables

For production, set these in Render dashboard:

```bash
API_KEY=your-api-key-here
API_URL=http://43.204.71.128:4000/chat/completions
PYTHON_VERSION=3.11.0
```

For local development, these are hardcoded with fallback values.

## Deployment to Render

1. Create new Web Service
2. Connect GitHub repository
3. Set root directory: `backend`
4. Build command: `pip install -r requirements.txt`
5. Start command: `gunicorn content_generator_server:app --bind 0.0.0.0:$PORT`
6. Add environment variables
7. Deploy!

**See `DEPLOYMENT_CHECKLIST.md` for detailed instructions.**

## Usage Tracking

- Tracks total requests, tokens, and costs
- Persists to `usage_tracker.json`
- Accessible via `/usage-stats` endpoint
- Keeps history of last 100 requests

## Cost Information

Using GPT-4o pricing:
- Prompt tokens: $0.0025 per 1K tokens
- Completion tokens: $0.01 per 1K tokens

## Dependencies

- Flask >= 2.0.0
- Flask-CORS >= 3.0.0
- requests >= 2.25.0
- gunicorn >= 20.1.0 (production)

## Documentation

- `DEPLOYMENT_CHECKLIST.md` - Complete deployment guide
- `RENDER_DEPLOYMENT.md` - Render-specific setup
- `CONTENT_GENERATOR_README.md` - Content generator details
