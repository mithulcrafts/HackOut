# Forecast providers

The operator forecast boundary supports three sources:

- **Synthetic scenario** for a repeatable local walkthrough.
- **Open-Meteo weather estimate** using live weather and the configured solar/wind capacities.
- **Model services** using Quartz Solar and an optional WindFM HTTP bridge.

Quartz and WindFM are Python projects, so the Next.js app calls them through small HTTP adapters. Set `QUARTZ_SOLAR_FORECAST_URL` and `WINDFM_WIND_FORECAST_URL` in the environment. A WindFM bridge should accept `{ latitude, longitude, capacity_kw, start, end, interval_minutes, timezone }` and return an array (or `forecast`/`predictions`/`data`) containing `timestamp` and `power_kw` (or `power`). The app validates the returned timeline and labels it `model_forecast`.

If either service is unavailable, the app uses the live Open-Meteo estimate and labels the fallback. It never presents a synthetic value as a live model result. Quartz documentation cautions that its default model was trained mainly on UK data; WindFM is a foundation model and still requires site validation. Forecasts are therefore decision inputs, not guarantees of plant output.

Sources: [Quartz Solar](https://github.com/openclimatefix/open-source-quartz-solar-forecast) and [WindFM](https://github.com/shiyu-coder/WindFM).
