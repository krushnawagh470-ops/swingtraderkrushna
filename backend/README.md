# SPIDER Python API

FastAPI backend for the SwingTraderKrushna SPIDER frontend.

## Services
- `GET /api/v1/health` — API and integration configuration status.
- `GET /api/v1/market/quotes?symbols=XAUUSD,EURUSD` — normalized public Biquote quotes.
- `GET /api/v1/news/latest?limit=5` — newest publisher RSS stories, deduplicated and sorted newest-first.
- `POST /api/v1/ai/chat` — server-side Gemini gateway. The API key stays in the backend environment.
- `GET /docs` — interactive API documentation.

## Run locally
Python 3.11+ is recommended.

```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set GEMINI_API_KEY in your shell or hosting dashboard; never commit the real value.
uvicorn app.main:app --reload --port 8000
```
Open http://127.0.0.1:8000/docs.

## Deploy
Deploy the `backend` directory as a Docker service. Set `GEMINI_API_KEY` and `CORS_ORIGINS` as host environment variables. After deployment, configure the frontend to use the HTTPS API URL.

## Security and scope
- Never put API keys in `index.html`, frontend JavaScript, or Git.
- Restrict `CORS_ORIGINS` to exact deployed frontend origins.
- Add host-level rate limiting and monitoring before public production use.
- Market data is read-only. This API does not place trades or connect to a broker account.
- Provider availability and quote freshness are not guaranteed.
