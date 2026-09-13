"""HTTP adapter for WindFM. Run with uvicorn after installing WindFM."""
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="WindFM forecast bridge")

class ForecastRequest(BaseModel):
    latitude: float
    longitude: float
    capacity_kw: float = 1
    start: str
    end: str
    interval_minutes: int = 30
    timezone: str = "UTC"

@app.get("/health")
def health():
    return {"status": "ok", "model": "WindFM", "ready": bool(os.getenv("WINDFM_MODEL_PATH"))}

@app.post("/forecast")
def forecast(request: ForecastRequest):
    try:
        import windfm  # type: ignore
    except ImportError as exc:
        raise HTTPException(503, "Install WindFM dependencies first.") from exc
    if not os.getenv("WINDFM_MODEL_PATH"):
        raise HTTPException(503, "WINDFM_MODEL_PATH is not configured.")
    # WindFM requires approved site history (wind, power, density,
    # temperature and pressure). Connect that SCADA adapter here; do not
    # fabricate observations when serving production forecasts.
    raise HTTPException(501, "Connect an approved SCADA history adapter before serving forecasts.")
