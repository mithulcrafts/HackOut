# Forecast providers

The operator forecast boundary supports three sources:

- **Synthetic scenario** for a repeatable local walkthrough.
- **Open-Meteo weather estimate** using live weather and the configured solar/wind capacities.
- **Model services** using Quartz Solar and an optional WindFM HTTP bridge.

Quartz and WindFM are Python projects, so the Next.js app calls them through small HTTP adapters. Quartz defaults to its public `/forecast/` endpoint; set `QUARTZ_SOLAR_FORECAST_URL` only when using an approved private deployment. Quartz receives `{ site: { latitude, longitude, capacity_kwp, tilt?, orientation? }, timestamp }` and returns a timestamp-keyed `predictions.power_kw` map. The adapter converts the UTC 15-minute Quartz output into the app's half-hour slot averages and caps values at the configured site capacity. The repository includes a runnable WindFM bridge in `services/windfm_bridge.py`; it accepts `{ latitude, longitude, capacity_kw, start, end, interval_minutes, timezone }` plus either inline history or `WINDFM_HISTORY_PATH`, and returns `forecast[]` entries containing `timestamp`, `power_kw`, `p10_kw` and `p90_kw`.

The two components are reported independently. If WindFM is unavailable, a live Open-Meteo weather estimate can supply the wind component while Quartz remains visible as the solar provider; the metadata labels this as a partial fallback. A slot is labelled `model_forecast` when at least one model component contributed, while `fallback: true` and the provider message make the missing component explicit.

If either service is unavailable, the app uses the live Open-Meteo estimate and labels the fallback. It never presents a synthetic value as a live model result. Quartz documentation cautions that its default model was trained mainly on UK data; WindFM is a foundation model and still requires site validation. Forecasts are therefore decision inputs, not guarantees of plant output.

Sources: [Quartz Solar](https://github.com/openclimatefix/open-source-quartz-solar-forecast) and [WindFM](https://github.com/shiyu-coder/WindFM).
