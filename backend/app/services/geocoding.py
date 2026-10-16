"""Optional reverse geocoding: coordinates -> state, district and address suggestions.

Disabled unless GEOCODER_PROVIDER=nominatim *and* GEOCODER_USER_AGENT are set. The public
Nominatim service (OpenStreetMap) requires an identifying User-Agent, at most 1 request per
second, and attribution; results are cached in memory. Results are only *suggestions* shown
to the reporter, who can correct them. Failures never block a report.
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict

import httpx

from .geo import normalize_state

ATTRIBUTION = "Address data © OpenStreetMap contributors (ODbL), via Nominatim"
_DISTRICT_KEYS = ("state_district", "district", "county", "city_district")


class ReverseGeocoder:
    def __init__(self, settings, client: httpx.Client | None = None, min_interval: float = 1.0):
        self.provider = settings.geocoder_provider
        self.url = settings.geocoder_url
        self.search_url = getattr(settings, "geocoder_search_url", "https://nominatim.openstreetmap.org/search")
        self.user_agent = settings.geocoder_user_agent.strip()
        self.email = settings.geocoder_email.strip()
        self.timeout = settings.http_timeout_seconds
        self.client = client
        self.min_interval = min_interval
        self._lock = threading.Lock()
        self._last_call = 0.0
        self._cache: OrderedDict[tuple[float, float], dict] = OrderedDict()

    @property
    def enabled(self) -> bool:
        return self.provider == "nominatim" and bool(self.user_agent)

    def describe(self) -> dict:
        return {
            "enabled": self.enabled,
            "provider": self.provider if self.enabled else None,
            "attribution": ATTRIBUTION if self.enabled else None,
        }

    @staticmethod
    def parse_nominatim(data: dict) -> dict:
        if not isinstance(data, dict) or data.get("error"):
            return {"status": "not_found", "message": "No address found for this point."}
        address = data.get("address") or {}
        state_raw = address.get("state") or address.get("union_territory") or address.get("territory")
        district = next((address[k] for k in _DISTRICT_KEYS if address.get(k)), None)
        country_code = (address.get("country_code") or "").lower() or None
        return {
            "status": "ok",
            "provider": "nominatim",
            "country_code": country_code,
            "in_india": country_code == "in" if country_code else None,
            "state": normalize_state(state_raw),
            "state_raw": state_raw,
            "district": district,
            "address": (data.get("display_name") or "")[:300] or None,
            "attribution": ATTRIBUTION,
        }

    def _get(self, url: str, params: dict):
        """One polite request: identifying User-Agent, at most one call per min_interval seconds."""
        if self.email:
            params["email"] = self.email
        client = self.client or httpx.Client(timeout=self.timeout)
        try:
            with self._lock:
                wait = self.min_interval - (time.monotonic() - self._last_call)
                if wait > 0:
                    time.sleep(wait)
                self._last_call = time.monotonic()
                resp = client.get(url, params=params, headers={"User-Agent": self.user_agent})
            resp.raise_for_status()
            return resp.json()
        finally:
            if self.client is None:
                client.close()

    def _cached(self, key, compute):
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        result = compute()
        if result.get("status") in ("ok", "not_found"):
            self._cache[key] = result
            if len(self._cache) > 512:
                self._cache.popitem(last=False)
        return result

    def reverse(self, lat: float, lon: float) -> dict:
        if not self.enabled:
            return {"status": "disabled", "message": "Address lookup is not configured on this server."}
        key = (round(lat, 4), round(lon, 4))  # ~11 m

        def compute():
            params = {"format": "jsonv2", "lat": key[0], "lon": key[1], "zoom": 14, "addressdetails": 1,
                      "accept-language": "en"}
            try:
                return self.parse_nominatim(self._get(self.url, params))
            except (httpx.HTTPError, ValueError) as exc:
                return {"status": "error", "message": f"Address lookup failed ({type(exc).__name__}). Enter the state and district manually."}

        return self._cached(("reverse", *key), compute)

    @staticmethod
    def parse_search(data) -> dict:
        from .geo import INDIA_ENVELOPE, in_bounds

        results = []
        for item in data if isinstance(data, list) else []:
            try:
                lat, lon = float(item["lat"]), float(item["lon"])
            except (KeyError, TypeError, ValueError):
                continue
            if not in_bounds(lat, lon, INDIA_ENVELOPE):
                continue
            address = item.get("address") or {}
            results.append({
                "name": item.get("display_name", "")[:200],
                "latitude": lat,
                "longitude": lon,
                "state": normalize_state(address.get("state")),
                "district": next((address[k] for k in _DISTRICT_KEYS if address.get(k)), None),
                "type": item.get("type"),
            })
        return {"status": "ok" if results else "not_found", "results": results, "attribution": ATTRIBUTION}

    def search(self, query: str) -> dict:
        """Find places in India by name (for the incident map's location search)."""
        if not self.enabled:
            return {"status": "disabled", "results": [], "message": "Place search is not configured on this server."}
        q = " ".join(query.split())[:120]

        def compute():
            params = {"q": q, "format": "jsonv2", "countrycodes": "in", "limit": 6, "addressdetails": 1,
                      "accept-language": "en"}
            try:
                return self.parse_search(self._get(self.search_url, params))
            except (httpx.HTTPError, ValueError) as exc:
                return {"status": "error", "results": [], "message": f"Place search failed ({type(exc).__name__})."}

        return self._cached(("search", q.lower()), compute)
