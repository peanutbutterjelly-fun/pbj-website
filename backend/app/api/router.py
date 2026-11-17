"""Collects every route group under /api. Add new route files here."""

from fastapi import APIRouter

from app.api.routes import chats, events, health, me, mine, people

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(me.router)
api_router.include_router(people.router)
api_router.include_router(events.router)
api_router.include_router(chats.router)
api_router.include_router(mine.router)
