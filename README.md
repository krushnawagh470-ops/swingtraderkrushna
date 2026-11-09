# SwingTraderKrushna — SPIDER

SPIDER is a mobile-friendly AI workspace with a static web frontend and a separate Python API backend.

## Architecture

- **Frontend:** `index.html`, CSS and browser JavaScript, hosted with GitHub Pages.
- **Backend:** FastAPI in `backend/`, deployable as a Docker service on a Python-compatible host.
- **Market data:** read-only Biquote REST adapter.
- **News:** publisher RSS aggregation, newest-first sorting, URL deduplication and short in-memory caching.
- **AI gateway:** Gemini server-side proxy. The Gemini key belongs in the backend host's environment variables, never in the frontend or Git.

## Backend quick start

See [backend setup](backend/README.md).

```bash
cd backend
python -m venv .venv
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API documentation: `http://127.0.0.1:8000/docs`

## Deployment notes

GitHub Pages does not execute Python. Keep the frontend on GitHub Pages and deploy the `backend/` service separately. After deployment, point the frontend API client at the backend's HTTPS URL and restrict CORS to the exact frontend origin. Backend deployment and frontend-to-backend integration are separate steps; this repository currently contains the backend source, not a live backend URL.

## Scope and safety

The backend provides read-only market data and AI/news services. It does not place trades, access broker credentials, or guarantee live quote availability. Verify market data and broker contract specifications independently before making trading decisions.
