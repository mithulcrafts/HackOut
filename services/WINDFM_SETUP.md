# WindFM bridge

This adapter runs the public [WindFM](https://github.com/shiyu-coder/WindFM)
model behind a small HTTP service. It requires an approved historical wind-farm
CSV; it returns a clear error when history is absent instead of generating fake
observations.

## Required CSV columns

`time`, `wind_speed`, `wind_direction`, `power`, `density`, `temperature`,
`pressure`. Timestamps must be UTC, sorted and unique. `power` must use the
same unit as `capacity_kw` (set `WINDFM_POWER_SCALE=1000` when the source
records power in MW and the API is configured in kW).

## Run locally

```powershell
python -m venv .windfm-venv
.\.windfm-venv\Scripts\pip install -r services\windfm_requirements.txt
git clone https://github.com/shiyu-coder/WindFM.git .windfm-src
$env:WINDFM_REPO_PATH = (Resolve-Path .windfm-src).Path
$env:WINDFM_HISTORY_PATH = (Resolve-Path .\path\to\approved_scada.csv).Path
$env:WINDFM_DEVICE = "cpu"
python -m uvicorn services.windfm_bridge:app --host 127.0.0.1 --port 8091
```

The first forecast downloads the public WindFM model and tokenizer from
Hugging Face. Use `GET /health` to check runtime, history and weight status.
`POST /forecast` accepts the same location/time contract used by the Next.js
forecast adapter and returns median, p10 and p90 values for each slot.

The public model is a zero-shot foundation model, not a Gujarat-specific
accuracy guarantee. Validate it against local plant history before using it for
operational decisions.
