"""Small HTTP adapter for the public WindFM foundation model.

The bridge deliberately requires a real historical time series. It never
creates wind or power observations when the history is missing. Configure
``WINDFM_REPO_PATH`` to the cloned WindFM repository and
``WINDFM_HISTORY_PATH`` to an approved CSV containing the six columns listed
below. Model weights are downloaded by Hugging Face on first use.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

REQUIRED_COLUMNS = ["time", "wind_speed", "wind_direction", "power", "density", "temperature", "pressure"]
DEFAULT_MODEL_ID = "NeoQuasar/WindFM"
DEFAULT_TOKENIZER_ID = "NeoQuasar/WindFM-Tokenizer"

app = FastAPI(title="WindFM forecast bridge", version="1.0")
_model_lock = Lock()
_predictor: Any | None = None


class HistoryPoint(BaseModel):
    """One trusted SCADA/weather observation in UTC."""

    time: datetime
    wind_speed: float
    wind_direction: float
    power: float
    density: float
    temperature: float
    pressure: float


class ForecastRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    capacity_kw: float = Field(default=1, gt=0)
    start: datetime
    end: datetime
    interval_minutes: int = Field(default=30, ge=15, le=60)
    timezone: str = "UTC"
    history: list[HistoryPoint] | None = None


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _utc(value: datetime) -> pd.Timestamp:
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is None:
        timestamp = timestamp.tz_localize("UTC")
    return timestamp.tz_convert("UTC")


def _load_history(request: ForecastRequest) -> pd.DataFrame:
    if request.history:
        frame = pd.DataFrame([point.model_dump() for point in request.history])
    else:
        history_path = os.getenv("WINDFM_HISTORY_PATH")
        if not history_path:
            raise HTTPException(status_code=503, detail="WINDFM_HISTORY_PATH or inline SCADA history is required.")
        path = Path(history_path).expanduser()
        if not path.is_file():
            raise HTTPException(status_code=503, detail=f"Wind history file not found: {path}")
        try:
            frame = pd.read_csv(path)
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Unable to read WindFM history CSV.") from exc

    missing = [column for column in REQUIRED_COLUMNS if column not in frame.columns]
    if missing:
        raise HTTPException(status_code=422, detail=f"Wind history is missing columns: {', '.join(missing)}")
    frame = frame[REQUIRED_COLUMNS].copy()
    frame["time"] = pd.to_datetime(frame["time"], utc=True, errors="coerce")
    for column in REQUIRED_COLUMNS[1:]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame = frame.sort_values("time").reset_index(drop=True)
    if frame.isna().any().any() or frame["time"].duplicated().any():
        raise HTTPException(status_code=422, detail="Wind history contains invalid or duplicate observations.")
    if (frame[REQUIRED_COLUMNS[1:]] < 0).any().any():
        raise HTTPException(status_code=422, detail="Wind history contains negative values.")
    return frame


def _load_predictor() -> Any:
    global _predictor
    if _predictor is not None:
        return _predictor
    repo_path = os.getenv("WINDFM_REPO_PATH")
    if not repo_path:
        raise HTTPException(status_code=503, detail="WINDFM_REPO_PATH is not configured.")
    if repo_path not in sys.path:
        sys.path.insert(0, repo_path)
    try:
        from model import WindFM, WindFMPredictor, WindFMTokenizer  # type: ignore
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="Install WindFM dependencies and set WINDFM_REPO_PATH.") from exc
    with _model_lock:
        if _predictor is None:
            try:
                tokenizer = WindFMTokenizer.from_pretrained(os.getenv("WINDFM_TOKENIZER_ID", DEFAULT_TOKENIZER_ID))
                model = WindFM.from_pretrained(os.getenv("WINDFM_MODEL_ID", DEFAULT_MODEL_ID))
                _predictor = WindFMPredictor(
                    model,
                    tokenizer,
                    device=os.getenv("WINDFM_DEVICE", "cpu"),
                    max_context=_env_int("WINDFM_MAX_CONTEXT", 512),
                    clip=float(os.getenv("WINDFM_CLIP", "5")),
                )
            except Exception as exc:
                raise HTTPException(status_code=503, detail=f"WindFM model could not be loaded: {exc}") from exc
    return _predictor


@app.get("/health")
def health() -> dict[str, Any]:
    repo_path = os.getenv("WINDFM_REPO_PATH")
    history_path = os.getenv("WINDFM_HISTORY_PATH")
    return {
        "status": "ok",
        "model": "WindFM",
        "runtime_configured": bool(repo_path),
        "history_configured": bool(history_path and Path(history_path).expanduser().is_file()),
        "weights_loaded": _predictor is not None,
        "device": os.getenv("WINDFM_DEVICE", "cpu"),
    }


@app.post("/forecast")
def forecast(request: ForecastRequest) -> dict[str, Any]:
    start = _utc(request.start)
    end = _utc(request.end)
    if end <= start:
        raise HTTPException(status_code=422, detail="end must be after start.")
    timestamps = pd.date_range(start=start, end=end, inclusive="left", freq=f"{request.interval_minutes}min")
    if len(timestamps) == 0 or len(timestamps) > 192:
        raise HTTPException(status_code=422, detail="Forecast horizon must contain 1–192 intervals.")

    history = _load_history(request)
    minimum = _env_int("WINDFM_MIN_HISTORY", 240)
    usable = history[history["time"] < start].tail(minimum)
    if len(usable) < minimum:
        raise HTTPException(status_code=422, detail=f"WindFM needs at least {minimum} observations before start.")

    predictor = _load_predictor()
    features = ["wind_speed", "wind_direction", "power", "density", "temperature", "pressure"]
    try:
        prediction = predictor.predict(
            df=usable[features],
            x_timestamp=usable["time"],
            # WindFM's timestamp helper uses the pandas Series `.dt` API.
            y_timestamp=pd.Series(timestamps),
            pred_len=len(timestamps),
            sample_count=_env_int("WINDFM_SAMPLE_COUNT", 5),
            verbose=False,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"WindFM inference failed: {exc}") from exc

    scale = float(os.getenv("WINDFM_POWER_SCALE", "1"))
    values = prediction.apply(pd.to_numeric, errors="coerce") * scale
    values = values.clip(lower=0, upper=request.capacity_kw)
    result = []
    for index, timestamp in enumerate(timestamps):
        row = values.iloc[index]
        result.append({
            "timestamp": timestamp.isoformat().replace("+00:00", "Z"),
            "power_kw": float(row.median()),
            "p10_kw": float(row.quantile(0.1)),
            "p90_kw": float(row.quantile(0.9)),
        })
    return {
        "forecast": result,
        "provider": "WindFM",
        "model": os.getenv("WINDFM_MODEL_ID", DEFAULT_MODEL_ID),
        "source": "SCADA_history_and_WindFM",
        "history_points": len(usable),
        "interval_minutes": request.interval_minutes,
    }
