# PB&J backend

The server for PeanutButterJelly.vip, built with [FastAPI](https://fastapi.tiangolo.com/) (Python). This is a starter for now: one health check route, settings, and a test.

## Run it

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Then open http://localhost:8000/api/health (should say `{"status":"ok"}`) or http://localhost:8000/docs for the interactive API page.

## Test it

```bash
pytest
```

## Where it runs

On Railway: project **pbj-backend**, service **api**, Singapore region (the closest to Mumbai).
- Live: https://api-production-bb76bfb9.up.railway.app/api/health
- Deploys automatically when a `feat(backend)`, `fix(backend)` or `chore(backend)` PR is merged into `main` (see `.github/workflows/deploy-backend.yml`). To deploy `main` by hand: GitHub → Actions → Deploy backend → Run workflow.
- `railway.json` holds the Railway settings (region, health check, restarts). `railpack.json` holds the start command.
- Settings and secrets (like `ENVIRONMENT`) are set in Railway under the **api** service's Variables, never in code.

## Layout

```
backend/
  app/
    main.py          # creates the app, CORS, mounts routes
    config.py        # settings from environment / .env
    api/
      router.py      # gathers all routes under /api
      routes/
        health.py    # GET /api/health
  tests/             # pytest tests
  railway.json           # Railway settings (region, health check)
  railpack.json          # how Railway starts the server
  requirements.txt       # what the server needs
  requirements-dev.txt   # plus testing tools
  .env.example           # copy to .env for local settings
```

To add a feature, make a new file in `app/api/routes/`, then include it in `app/api/router.py`.
