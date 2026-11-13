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
  requirements.txt       # what the server needs
  requirements-dev.txt   # plus testing tools
  .env.example           # copy to .env for local settings
```

To add a feature, make a new file in `app/api/routes/`, then include it in `app/api/router.py`.
