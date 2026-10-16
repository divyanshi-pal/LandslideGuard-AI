"""Reverse geocoder (mocked HTTP), video signature detection and the rate limiter."""

from types import SimpleNamespace

import httpx
import pytest

from app.services.geocoding import ReverseGeocoder
from app.services.report_guard import RateLimiter
from app.services.uploads import MediaError, detect_video_type, save_video


def settings(**overrides):
    base = dict(geocoder_provider="nominatim", geocoder_url="https://geo.test/reverse",
                geocoder_user_agent="LandslideGuardTest/1.0 (test@example.com)", geocoder_email="",
                http_timeout_seconds=5)
    return SimpleNamespace(**{**base, **overrides})


NOMINATIM_SHIMLA = {
    "display_name": "The Mall, Shimla, Shimla District, Himachal Pradesh, 171001, India",
    "address": {"road": "The Mall", "city": "Shimla", "state_district": "Shimla District",
                "state": "Himachal Pradesh", "postcode": "171001", "country": "India", "country_code": "in"},
}


def geocoder_with(handler, **overrides):
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return ReverseGeocoder(settings(**overrides), client=client, min_interval=0)


def test_disabled_without_user_agent():
    g = ReverseGeocoder(settings(geocoder_user_agent=""))
    assert not g.enabled and g.reverse(31.1, 77.17)["status"] == "disabled"
    assert ReverseGeocoder(settings(geocoder_provider="none")).describe()["enabled"] is False


def test_parses_nominatim_and_sends_identifying_user_agent():
    seen = {}

    def handler(request):
        seen["ua"] = request.headers["user-agent"]
        seen["params"] = dict(request.url.params)
        return httpx.Response(200, json=NOMINATIM_SHIMLA)

    result = geocoder_with(handler).reverse(31.10412, 77.17331)
    assert seen["ua"].startswith("LandslideGuardTest") and seen["params"]["format"] == "jsonv2"
    assert result["status"] == "ok" and result["state"] == "Himachal Pradesh"
    assert result["district"] == "Shimla District" and result["in_india"] is True
    assert "OpenStreetMap" in result["attribution"]


def test_results_are_cached():
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(200, json=NOMINATIM_SHIMLA)

    g = geocoder_with(handler)
    g.reverse(31.10412, 77.17331)
    g.reverse(31.10414, 77.17329)  # same ~11 m cell
    assert len(calls) == 1


@pytest.mark.parametrize("response,status", [
    (httpx.Response(503, text="busy"), "error"),
    (httpx.Response(200, text="not json"), "error"),
    (httpx.Response(200, json={"error": "Unable to geocode"}), "not_found"),
])
def test_failures_are_reported_not_raised(response, status):
    assert geocoder_with(lambda r: response).reverse(20.0, 80.0)["status"] == status


def test_foreign_country_is_flagged():
    data = {"display_name": "Kathmandu, Nepal", "address": {"state": "Bagmati Province", "country_code": "np"}}
    result = ReverseGeocoder.parse_nominatim(data)
    assert result["in_india"] is False and result["state"] is None and result["state_raw"] == "Bagmati Province"


@pytest.mark.parametrize("head,expected", [
    (b"\x00\x00\x00\x18ftypisom" + b"\x00" * 8, ("video/mp4", ".mp4")),
    (b"\x00\x00\x00\x14ftypqt  " + b"\x00" * 8, ("video/quicktime", ".mov")),
    (b"\x00\x00\x00\x18ftyp3gp4" + b"\x00" * 8, ("video/3gpp", ".3gp")),
    (b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\x82\x84webm" + b"\x00" * 8, ("video/webm", ".webm")),
    (b"\x00\x00\x00\x18ftypheic" + b"\x00" * 8, None),
    (b"\x89PNG\r\n\x1a\n" + b"\x00" * 16, None),
    (b"", None),
])
def test_video_signature_detection(head, expected):
    assert detect_video_type(head) == expected


def test_save_video_limits(tmp_path):
    header = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 40
    info = save_video(header, tmp_path, max_bytes=1000)
    assert (tmp_path / info.filename).exists() and info.content_type == "video/mp4"
    with pytest.raises(MediaError, match="limit"):
        save_video(header * 100, tmp_path, max_bytes=1000)
    with pytest.raises(MediaError):
        save_video(b"", tmp_path, max_bytes=1000)


def test_rate_limiter_sliding_window():
    rl = RateLimiter(limit_per_hour=2, window_seconds=100)
    assert rl.allow("a", now=0) and rl.allow("a", now=10)
    assert not rl.allow("a", now=20)
    assert rl.allow("b", now=20)  # independent per client
    assert rl.allow("a", now=101)  # first hit expired
    assert RateLimiter(limit_per_hour=0).allow("x")  # 0 disables
