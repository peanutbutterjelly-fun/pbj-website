# pbj-website

PB&J teaser site, with a starter server alongside it.

| Folder | What lives there |
|---|---|
| [`frontend/`](frontend/) | The website (Vite + Three.js): pages, `src/`, `public/`, helper `scripts/`, `film/` for videos, `lab/` for local experiments |
| [`backend/`](backend/) | The server (Python, FastAPI). See [`backend/README.md`](backend/README.md) |

Shared notes stay in the top folder: [`PLAN.md`](PLAN.md), [`INSPIRATION.md`](INSPIRATION.md) and [`inspiration/`](inspiration/).

## Website

```bash
cd frontend
npm install
npm run dev
```

## Server

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```
