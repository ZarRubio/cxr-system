import json
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import predict


@asynccontextmanager
async def lifespan(app: FastAPI):
    from services.model_service import load_model

    app.state.model = load_model("artifacts/sprint3_model.pt")

    with open("artifacts/thresholds.json") as f:
        app.state.thresholds = json.load(f)["thresholds"]

    yield


app = FastAPI(
    title="CXR Classification API",
    description="Clasificación de radiografías de tórax — HNAL 2026",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
