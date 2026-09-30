# EduGenie

EduGenie is a lightweight educational assistant for asking questions, simplifying concepts, generating quizzes, building learning paths, and summarizing study material. Its responsive HTML/CSS/JavaScript interface is served by a small FastAPI backend.

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). The app works without credentials using local starter responses for common study scenarios.

## Optional cloud model

Set an OpenAI-compatible chat completions provider before starting the server:

```bash
export OPENAI_API_KEY="your-api-key"
export OPENAI_MODEL="gpt-4o-mini"
export OPENAI_BASE_URL="https://api.openai.com/v1"
```

The base URL can point to another OpenAI-compatible provider. Copy `.env.example` as a reference; the app reads settings from environment variables and does not require an additional client SDK.

## API

- `GET /api/health` reports whether local or cloud responses are configured.
- `POST /api/study` accepts `{ "mode": "ask|explain|quiz|path|summarize", "prompt": "...", "level": "High school" }` and returns an answer.