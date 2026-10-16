"""FastAPI dependencies for shared services stored on app.state."""

from __future__ import annotations

from fastapi import Request

from .services.geocoding import ReverseGeocoder
from .services.ml_model import MLModelService
from .services.report_guard import RateLimiter
from .services.weather import WeatherProvider


def get_ml_service(request: Request) -> MLModelService:
    return request.app.state.ml_service


def get_weather_provider(request: Request) -> WeatherProvider:
    return request.app.state.weather_provider


def get_geocoder(request: Request) -> ReverseGeocoder:
    return request.app.state.geocoder


def get_report_limiter(request: Request) -> RateLimiter:
    return request.app.state.report_limiter
