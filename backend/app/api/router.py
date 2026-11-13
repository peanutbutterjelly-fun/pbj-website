"""Collects every route group under /api. Add new route files here."""

from fastapi import APIRouter

from app.api.routes import health, me

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(me.router)
