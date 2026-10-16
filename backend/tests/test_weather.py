from datetime import date, datetime, timedelta, timezone

import httpx
import pytest

from app.services.weather import (
    DemoWeatherProvider,
    OpenMeteoProvider,
    SiteRef,
    fetch_weather,
)

SITES = [SiteRef(1, "Aizawl", 23.727, 92.718), SiteRef(2, "Gangtok", 27.33, 88.612)]


def hourly_payload(now: datetime, mm_per_hour: float, moisture: float = 0.31) -> dict:
    start = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=80)
    times = [(start + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M") for i in range(100)]
    return {
        "hourly": {
            "time": times,
            "precipitation": [mm_per_hour] * 100,
            "soil_moisture_3_to_9cm": [moisture] * 100,
        }
    }


def test_demo_provider_is_deterministic_and_labelled():
    a = DemoWeatherProvider(date(2026, 7, 15)).get_batch(SITES)
    b = DemoWeatherProvider(date(2026, 7, 15)).get_batch(SITES)
    assert a == b
    for r in a.values():
        assert r.source == "demo"
        assert "SIMULATED" in r.note
        assert 0 <= r.rainfall_24h_mm <= r.rainfall_72h_mm
        assert 0.05 <= r.soil_moisture <= 0.55


def test_open_meteo_parsing_sums_last_24_and_72_hours():
    now = datetime.now(timezone.utc)
    r = OpenMeteoProvider.parse_hourly(hourly_payload(now, 2.0), now)
    assert r.rainfall_24h_mm == pytest.approx(48.0)
    assert r.rainfall_72h_mm == pytest.approx(144.0)
    assert r.soil_moisture == pytest.approx(0.31)
    assert r.source == "open-meteo"


def test_open_meteo_provider_with_mocked_http():
    now = datetime.now(timezone.utc)
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["params"] = dict(request.url.params)
        return httpx.Response(200, json=[hourly_payload(now, 1.0), hourly_payload(now, 0.5)])

    client = httpx.Client(transport=httpx.MockTransport(handler))
    readings = OpenMeteoProvider("https://example.test/v1/forecast", client=client).get_batch(SITES)
    assert seen["params"]["latitude"] == "23.7270,27.3300"
    assert seen["params"]["past_days"] == "3"
    assert readings[1].rainfall_72h_mm == pytest.approx(72.0)
    assert readings[2].rainfall_24h_mm == pytest.approx(12.0)


def test_failed_live_provider_falls_back_to_labelled_demo_data():
    def handler(request):
        return httpx.Response(503, text="unavailable")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    readings, warnings = fetch_weather(SITES, OpenMeteoProvider("https://example.test", client=client))
    assert all(r.source == "demo" for r in readings.values())
    assert warnings and "SIMULATED" in warnings[0]
