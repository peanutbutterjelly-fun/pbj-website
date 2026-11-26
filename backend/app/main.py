"""Entry point: uvicorn app.main:app --reload"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg import errors

from app.api.router import api_router
from app.config import get_settings
from app.db import close_pool, open_pool


@asynccontextmanager
async def lifespan(_app: FastAPI):
    open_pool()
    yield
    close_pool()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)

    @app.exception_handler(errors.CheckViolation)
    @app.exception_handler(errors.NotNullViolation)
    async def invalid_value(_request: Request, _exc: Exception) -> JSONResponse:
        # The database refused a value (too long, wrong shape, empty where it can't be): that's the sender's mistake, not a crash
        return JSONResponse({"detail": "One of the values isn't allowed"}, status_code=422)

    return app


app = create_app()
