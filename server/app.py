"""GDET - Global Data Extract Tool FastAPI application."""
import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


def load_env_file(filepath: str) -> None:
    if Path(filepath).exists():
        with open(filepath) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    key, _, value = line.partition("=")
                    if key and value:
                        os.environ.setdefault(key.strip(), value.strip())


load_env_file(".env")
load_env_file(".env.local")

from server.routers import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="GDET - Global Data Extract Tool",
    description="Self-service data extraction platform for Arrow Electronics",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "healthy"}


# Serve React frontend (must be last)
if os.path.exists("client/build"):
    app.mount("/", StaticFiles(directory="client/build", html=True), name="static")
