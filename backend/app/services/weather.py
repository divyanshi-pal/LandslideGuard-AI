"""Rainfall / soil-moisture inputs for monitored locations.

Two providers:

* DemoWeatherProvider  - deterministic SIMULATED values (seeded by location + date).
                         Always labelled data_source="demo".
* OpenMeteoProvider    - live numerical-weather-model data from api.open-meteo.com
                         (free, no API key). These are model estimates, not rain-gauge
                         observations. Labelled data_source="open-meteo".

If the live provider fails, `fetch_weather` falls back to demo values and says so.
"""

from __future__ import annotations

import hashlib
import logging
import math
import random
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Protocol

import httpx

logger = logging.getLogger("landslideguard.weather")

DEMO_NOTE = "SIMULATED demo values - not real observations."
OPEN_METEO_NOTE = (
    "Open-Meteo numerical weather model data for the past 72 h (not rain-gauge observations)."
)

# Rough seasonal scaling for the demo generator (NE India monsoon peaks Jun-Sep).
_DEMO_MONTH_FACTOR = {1: 0.15, 2: 0.2, 3: 0.3, 4: 0.45, 5: 0.7, 6: 1.0, 7: 1.0,
                      8: 1.0, 9: 0.85, 10: 0.6, 11: 0.25, 12: 0.15}


@dataclass(frozen=True)
class SiteRef:
    id: int
    name: str
    latitude: float
    longitude: float


@dataclass(frozen=True)
class WeatherReading:
    rainfall_24h_mm: float
    rainfall_72h_mm: float
    soil_moisture: float
    source: str
    observed_at: datetime
    note: str


class WeatherProvider(Protocol):
    name: str

    def get_batch(self, sites: list[SiteRef]) -> dict[int, WeatherReading]: ...


class DemoWeatherProvider:
    name = "demo"

    def __init__(self, on_date: date | None = None):
        self.on_date = on_date

    def reading_for(self, site: SiteRef, on_date: date) -> WeatherReading:
        seed = int(hashlib.sha256(f"{site.name}|{on_date.isoformat()}".encode()).hexdigest()[:12], 16)
        rng = random.Random(seed)
        factor = _DEMO_MONTH_FACTOR[on_date.month]
        rain72 = min(rng.gammavariate(1.3, 95.0 * factor), 900.0)
        rain24 = rain72 * rng.betavariate(2, 3)
        moisture = 0.12 + 0.30 * (1 - math.exp(-rain72 / 150.0)) + rng.gauss(0, 0.03)
        return WeatherReading(
            rainfall_24h_mm=round(rain24, 1),
            rainfall_72h_mm=round(rain72, 1),
            soil_moisture=round(min(max(moisture, 0.05), 0.55), 3),
            source="demo",
            observed_at=datetime.combine(on_date, datetime.min.time(), tzinfo=timezone.utc),
            note=DEMO_NOTE,
        )

    def get_batch(self, sites: list[SiteRef]) -> dict[int, WeatherReading]:
        on_date = self.on_date or datetime.now(timezone.utc).date()
        return {s.id: self.reading_for(s, on_date) for s in sites}


class OpenMeteoProvider:
    name = "open-meteo"
    BATCH_SIZE = 50

    def __init__(self, url: str, timeout: float = 15.0, client: httpx.Client | None = None):
        self.url = url
        self.timeout = timeout
        self.client = client

    def _request(self, sites: list[SiteRef]) -> list[dict]:
        params = {
            "latitude": ",".join(f"{s.latitude:.4f}" for s in sites),
            "longitude": ",".join(f"{s.longitude:.4f}" for s in sites),
            "hourly": "precipitation,soil_moisture_3_to_9cm",
            "past_days": 3,
            "forecast_days": 1,
            "timezone": "GMT",
        }
        client = self.client or httpx.Client(timeout=self.timeout)
        try:
            resp = client.get(self.url, params=params)
            resp.raise_for_status()
            data = resp.json()
        finally:
            if self.client is None:
                client.close()
        # A single coordinate returns an object; several return a list.
        return data if isinstance(data, list) else [data]

    @staticmethod
    def parse_hourly(payload: dict, now: datetime) -> WeatherReading:
        hourly = payload["hourly"]
        times = [datetime.fromisoformat(t).replace(tzinfo=timezone.utc) for t in hourly["time"]]
        precip = [p or 0.0 for p in hourly["precipitation"]]
        moisture = hourly.get("soil_moisture_3_to_9cm") or []

        current_hour = now.replace(minute=0, second=0, microsecond=0)
        idx = max((i for i, t in enumerate(times) if t <= current_hour), default=None)
        if idx is None or idx < 71:
            raise ValueError("Open-Meteo response does not cover the past 72 hours")

        rain24 = sum(precip[idx - 23: idx + 1])
        rain72 = sum(precip[idx - 71: idx + 1])
        sm = next((moisture[i] for i in range(idx, -1, -1) if i < len(moisture) and moisture[i] is not None), None)
        if sm is None:
            raise ValueError("Open-Meteo response has no soil moisture values")
        return WeatherReading(
            rainfall_24h_mm=round(rain24, 1),
            rainfall_72h_mm=round(rain72, 1),
            soil_moisture=round(float(sm), 3),
            source="open-meteo",
            observed_at=times[idx],
            note=OPEN_METEO_NOTE,
        )

    def get_batch(self, sites: list[SiteRef]) -> dict[int, WeatherReading]:
        now = datetime.now(timezone.utc)
        out: dict[int, WeatherReading] = {}
        for start in range(0, len(sites), self.BATCH_SIZE):
            chunk = sites[start: start + self.BATCH_SIZE]
            payloads = self._request(chunk)
            if len(payloads) != len(chunk):
                raise ValueError("Open-Meteo returned an unexpected number of locations")
            for site, payload in zip(chunk, payloads):
                out[site.id] = self.parse_hourly(payload, now)
        return out


def fetch_weather(
    sites: list[SiteRef], provider: WeatherProvider
) -> tuple[dict[int, WeatherReading], list[str]]:
    """Fetch readings; on live-provider failure fall back to clearly-labelled demo data."""
    warnings: list[str] = []
    try:
        return provider.get_batch(sites), warnings
    except Exception as exc:
        if isinstance(provider, DemoWeatherProvider):
            raise
        logger.warning("Weather provider %s failed: %s", provider.name, exc)
        warnings.append(
            f"Live weather provider '{provider.name}' failed ({type(exc).__name__}: {exc}). "
            "Fell back to SIMULATED demo values."
        )
        return DemoWeatherProvider().get_batch(sites), warnings


def provider_from_settings(settings) -> WeatherProvider:
    if settings.weather_provider == "open-meteo":
        return OpenMeteoProvider(settings.open_meteo_url, settings.http_timeout_seconds)
    return DemoWeatherProvider()
