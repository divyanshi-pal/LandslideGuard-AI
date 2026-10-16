"""Nationwide citizen incident reporting through the REST API."""

import io
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from PIL import Image

from tests.conftest import TMP_DIR


def report(**overrides) -> dict:
    base = {
        "category": "landslide",
        "description": f"Nationwide test report {uuid.uuid4().hex[:8]}: debris on the road.",
        "observed_severity": "moderate",
        "latitude": "31.104",
        "longitude": "77.173",
        "location_source": "map",
        "state": "Himachal Pradesh",
        "district": "Shimla",
    }
    return {k: v for k, v in {**base, **overrides}.items() if v is not None}


def jpeg(color=(90, 120, 60), exif_time: str | None = None) -> bytes:
    img = Image.new("RGB", (80, 60), color)
    buf = io.BytesIO()
    if exif_time:
        exif = Image.Exif()
        exif.get_ifd(0x8769)[0x9003] = exif_time  # DateTimeOriginal
        exif[0x8825] = {1: "N", 2: (31.0, 6.0, 0.0)}  # GPS, must be stripped
        img.save(buf, format="JPEG", exif=exif)
    else:
        img.save(buf, format="JPEG")
    return buf.getvalue()


MP4_HEADER = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"\x00" * 64


def admin_get(client, headers, report_id):
    listing = client.get("/api/admin/reports", headers=headers).json()
    return next(r for r in listing if r["id"] == report_id)


# ---------------------------------------------------------------- submission across India
@pytest.mark.parametrize("state,district,lat,lon,category", [
    ("Kerala", "Idukki", "10.089", "77.060", "flood"),
    ("Uttarakhand", "Chamoli", "30.555", "79.565", "land_subsidence"),
    ("Maharashtra", "Raigad", "18.515", "73.180", "landslide"),
    ("Jammu and Kashmir", "Ramban", "33.243", "75.240", "road_blocked"),
    ("Ladakh", "Leh", "34.152", "77.577", "rockfall"),
    ("Tamil Nadu", "The Nilgiris", "11.410", "76.695", "ground_crack"),
    ("Andaman and Nicobar Islands", "South Andaman", "11.623", "92.726", "slope_movement"),
])
def test_reports_accepted_from_states_across_india(client, state, district, lat, lon, category):
    r = client.post("/api/reports", data=report(state=state, district=district, latitude=lat, longitude=lon,
                                                category=category))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["state"] == state and body["district"] == district and body["category"] == category
    assert body["status"] == "pending" and body["duplicate"] is False
    assert float(lat) == body["latitude"] and float(lon) == body["longitude"]


def test_state_names_are_normalised_and_unknown_states_rejected(client):
    r = client.post("/api/reports", data=report(state="orissa", district="Gajapati", latitude="18.95", longitude="84.18"))
    assert r.status_code == 201 and r.json()["state"] == "Odisha"
    assert client.post("/api/reports", data=report(state="Atlantis")).status_code == 422


def test_state_and_district_are_optional(client):
    data = report()
    data.pop("state"), data.pop("district")
    r = client.post("/api/reports", data=data)
    assert r.status_code == 201 and r.json()["state"] is None


@pytest.mark.parametrize("lat,lon", [("51.507", "-0.128"), ("24.861", "67.010"), ("0", "0"), ("nan", "77"), ("95", "77")])
def test_invalid_or_foreign_coordinates_rejected(client, lat, lon):
    assert client.post("/api/reports", data=report(latitude=lat, longitude=lon)).status_code == 422


# ---------------------------------------------------------------- location source
def test_gps_report_keeps_accuracy(client, admin_headers):
    r = client.post("/api/reports", data=report(location_source="gps", location_accuracy_m="12.5"))
    assert r.status_code == 201 and r.json()["location_source"] == "gps"
    stored = admin_get(client, admin_headers, r.json()["id"])
    assert stored["location_accuracy_m"] == 12.5 and stored["location_check"] == "india_envelope"


@pytest.mark.parametrize("source", ["map", "manual"])
def test_non_gps_sources_never_store_gps_accuracy(client, admin_headers, source):
    r = client.post("/api/reports", data=report(location_source=source, location_accuracy_m="8"))
    assert r.status_code == 201 and r.json()["location_source"] == source
    assert admin_get(client, admin_headers, r.json()["id"])["location_accuracy_m"] is None


def test_location_source_is_required_and_validated(client):
    data = report()
    data.pop("location_source")
    assert client.post("/api/reports", data=data).status_code == 422
    assert client.post("/api/reports", data=report(location_source="satellite")).status_code == 422


# ---------------------------------------------------------------- incident time
def test_observed_time_is_stored(client):
    when = (datetime.now(timezone.utc) - timedelta(hours=5)).replace(microsecond=0)
    r = client.post("/api/reports", data=report(observed_at=when.isoformat().replace("+00:00", "Z")))
    assert r.status_code == 201
    assert datetime.fromisoformat(r.json()["observed_at"]) == when


def test_observed_time_with_ist_offset_is_converted_to_utc(client):
    ist = timezone(timedelta(hours=5, minutes=30))
    local = (datetime.now(ist) - timedelta(hours=1)).replace(microsecond=0)
    r = client.post("/api/reports", data=report(observed_at=local.isoformat()))
    assert r.status_code == 201
    returned = datetime.fromisoformat(r.json()["observed_at"])
    assert returned == local  # same instant...
    assert returned.utcoffset() == timedelta(0)  # ...expressed in UTC


@pytest.mark.parametrize("delta", [timedelta(hours=2), timedelta(days=-400)])
def test_observed_time_must_be_plausible(client, delta):
    when = datetime.now(timezone.utc) + delta
    assert client.post("/api/reports", data=report(observed_at=when.isoformat())).status_code == 422


def test_missing_observed_time_defaults_to_now(client):
    r = client.post("/api/reports", data=report())
    observed = datetime.fromisoformat(r.json()["observed_at"])
    assert abs((datetime.now(timezone.utc) - observed).total_seconds()) < 60


# ---------------------------------------------------------------- duplicates
def test_same_submission_id_returns_original(client):
    sid = uuid.uuid4().hex
    first = client.post("/api/reports", data=report(client_submission_id=sid))
    second = client.post("/api/reports", data=report(client_submission_id=sid, description="Different text, same key ok"))
    assert first.status_code == 201 and second.status_code == 200
    assert second.json()["id"] == first.json()["id"] and second.json()["duplicate"] is True


def test_identical_resubmission_returns_original(client):
    data = report()
    first = client.post("/api/reports", data=data)
    again = client.post("/api/reports", data=data)
    assert again.status_code == 200 and again.json()["id"] == first.json()["id"] and again.json()["duplicate"]


def test_resubmission_with_invalid_photo_is_still_rejected(client):
    data = report()
    client.post("/api/reports", data=data)
    bad = {"photo": ("x.jpg", b"not an image", "image/jpeg")}
    assert client.post("/api/reports", data=data, files=bad).status_code == 422


def test_same_photo_flags_possible_duplicate(client, admin_headers):
    photo = jpeg(color=(1, 2, 3))
    a = client.post("/api/reports", data=report(), files={"photo": ("a.jpg", photo, "image/jpeg")}).json()
    b = client.post("/api/reports", data=report(), files={"photo": ("b.jpg", photo, "image/jpeg")}).json()
    assert a["id"] != b["id"]  # different reports are kept...
    assert admin_get(client, admin_headers, b["id"])["possible_duplicate_of"] == a["id"]  # ...but flagged


def test_bad_submission_id_rejected(client):
    assert client.post("/api/reports", data=report(client_submission_id="x y")).status_code == 422


# ---------------------------------------------------------------- media
def test_photo_metadata_recorded_and_gps_stripped(client, admin_headers):
    r = client.post("/api/reports", data=report(),
                    files={"photo": ("cam.jpg", jpeg(exif_time="2026:10:12 07:45:00"), "image/jpeg")})
    assert r.status_code == 201
    stored = admin_get(client, admin_headers, r.json()["id"])
    assert stored["photo_content_type"] == "image/jpeg"
    assert (stored["photo_width"], stored["photo_height"]) == (80, 60)
    assert stored["photo_size_bytes"] > 0
    assert stored["photo_exif_datetime"] == "2026:10:12 07:45:00"
    image = client.get(stored["photo_url"])
    assert image.status_code == 200 and image.headers["content-type"] == "image/jpeg"
    with Image.open(io.BytesIO(image.content)) as img:
        assert len(img.getexif()) == 0


def test_video_upload_is_admin_only(client, admin_headers):
    r = client.post("/api/reports", data=report(), files={"video": ("clip.mp4", MP4_HEADER, "video/mp4")})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["has_video"] is True
    stored = admin_get(client, admin_headers, body["id"])
    assert stored["video_content_type"] == "video/mp4" and stored["video_size_bytes"] == len(MP4_HEADER)
    assert client.get(stored["video_url"]).status_code == 200
    client.patch(f"/api/admin/reports/{body['id']}", headers=admin_headers, json={"status": "verified"})
    public = next(x for x in client.get("/api/reports").json() if x["id"] == body["id"])
    assert "video_url" not in public  # never public, even after verification


@pytest.mark.parametrize("kind", ["text", "heic-image", "too-big"])
def test_invalid_videos_rejected(client, kind):
    content = {
        "text": b"plain text pretending to be a video",
        "heic-image": b"\x00\x00\x00\x18ftypheic" + b"\x00" * 40,  # an image container, not video
        "too-big": MP4_HEADER + b"\x00" * (1024 * 1024),           # over MAX_VIDEO_MB=1 in tests
    }[kind]
    r = client.post("/api/reports", data=report(), files={"video": ("clip.mp4", content, "video/mp4")})
    assert r.status_code == 422, r.text


def test_photo_size_limit(client):
    big = b"\xff\xd8" + b"\x00" * (5 * 1024 * 1024 + 10)
    r = client.post("/api/reports", data=report(), files={"photo": ("big.jpg", big, "image/jpeg")})
    assert r.status_code == 422 and "limit" in r.json()["detail"]


def test_signed_media_links_cannot_be_forged_or_reused_after_expiry(client, admin_headers):
    from app.services.media_access import signed_media_url

    r = client.post("/api/reports", data=report(), files={"photo": ("p.jpg", jpeg(color=(9, 9, 9)), "image/jpeg")})
    rid = r.json()["id"]
    url = admin_get(client, admin_headers, rid)["photo_url"]
    assert client.get(url.replace(f"/{rid}/", f"/{rid + 1000}/")).status_code == 403  # signature bound to report
    assert client.get(url[:-4] + "0000").status_code == 403  # tampered signature
    assert client.get(signed_media_url(rid, "photo", ttl_seconds=-5)).status_code == 403  # expired
    assert client.get(f"/api/admin/media/{rid}/photo").status_code == 422  # unsigned


def test_uploaded_files_are_removed_when_validation_fails(client):
    before = set((TMP_DIR / "uploads").glob("*"))
    files = {"photo": ("ok.jpg", jpeg(color=(7, 7, 7)), "image/jpeg"), "video": ("bad.mp4", b"nope" * 10, "video/mp4")}
    assert client.post("/api/reports", data=report(), files=files).status_code == 422
    assert set((TMP_DIR / "uploads").glob("*")) == before


# ---------------------------------------------------------------- listing and filters
def test_public_listing_filters_and_hides_private_fields(client, admin_headers):
    tag = uuid.uuid4().hex[:6]
    kerala = client.post("/api/reports", data=report(state="Kerala", district="Wayanad", category="flood",
                                                    observed_severity="severe", latitude="11.6", longitude="76.1",
                                                    reporter_contact="private@example.com",
                                                    address=f"House {tag}, private lane")).json()
    client.patch(f"/api/admin/reports/{kerala['id']}", headers=admin_headers, json={"status": "verified"})

    public = client.get("/api/reports", params={"state": "Kerala", "category": "flood", "severity": "severe"}).json()
    assert any(x["id"] == kerala["id"] for x in public)
    assert all(x["state"] == "Kerala" and x["category"] == "flood" for x in public)
    entry = next(x for x in public if x["id"] == kerala["id"])
    assert not {"reporter_contact", "reporter_name", "address", "admin_notes"} & set(entry)
    assert client.get("/api/reports", params={"district": "wayanad"}).json()  # case-insensitive
    assert not any(x["id"] == kerala["id"] for x in client.get("/api/reports", params={"state": "Assam"}).json())


def test_public_listing_excludes_unverified_by_default(client):
    pending = client.post("/api/reports", data=report()).json()
    assert pending["id"] not in {x["id"] for x in client.get("/api/reports").json()}
    assert client.get("/api/reports", params={"status": "pending"}).json() == []
    assert client.get("/api/reports", params={"status": "rejected"}).json() == []


def test_date_filters_use_incident_time(client, admin_headers):
    old = (datetime.now(timezone.utc) - timedelta(days=20)).isoformat()
    r = client.post("/api/reports", data=report(observed_at=old)).json()
    client.patch(f"/api/admin/reports/{r['id']}", headers=admin_headers, json={"status": "verified"})
    day = (datetime.now(timezone.utc) - timedelta(days=20)).date().isoformat()
    in_range = client.get("/api/reports", params={"date_from": day, "date_to": day}).json()
    assert r["id"] in {x["id"] for x in in_range}
    recent = client.get("/api/reports", params={"date_from": datetime.now(timezone.utc).date().isoformat()}).json()
    assert r["id"] not in {x["id"] for x in recent}


def test_admin_listing_filters_all_statuses(client, admin_headers):
    r = client.post("/api/reports", data=report(state="Goa", district="North Goa", latitude="15.49",
                                                longitude="73.83")).json()
    goa = client.get("/api/admin/reports", headers=admin_headers, params={"state": "Goa", "status": "pending"}).json()
    assert r["id"] in {x["id"] for x in goa}
    assert all(x["state"] == "Goa" and x["status"] == "pending" for x in goa)
    unspecified = client.get("/api/admin/reports", headers=admin_headers, params={"state": "unspecified"}).json()
    assert all(x["state"] is None for x in unspecified)


def test_admin_can_correct_location_details(client, admin_headers):
    r = client.post("/api/reports", data=report(state=None, district=None)).json()
    upd = client.patch(f"/api/admin/reports/{r['id']}", headers=admin_headers,
                       json={"state": "himachal pradesh", "district": "Shimla", "address": "Near Dhalli tunnel"})
    assert upd.status_code == 200
    body = upd.json()
    assert body["state"] == "Himachal Pradesh" and body["address_source"] == "admin"
    assert body["reviewed_by"] is None  # editing details is not a verification
    bad = client.patch(f"/api/admin/reports/{r['id']}", headers=admin_headers, json={"state": "Narnia"})
    assert bad.status_code == 422


def test_delete_removes_photo_and_video(client, admin_headers):
    from app.database import SessionLocal
    from app.models import CitizenReport

    r = client.post("/api/reports", data=report(), files={
        "photo": ("p.jpg", jpeg(color=(5, 6, 7)), "image/jpeg"), "video": ("v.mp4", MP4_HEADER, "video/mp4")}).json()
    with SessionLocal() as db:
        row = db.get(CitizenReport, r["id"])
        files = [TMP_DIR / "uploads" / row.photo_filename, TMP_DIR / "uploads" / row.video_filename]
    assert all(f.exists() for f in files)
    assert client.delete(f"/api/admin/reports/{r['id']}", headers=admin_headers).status_code == 204
    assert not any(f.exists() for f in files)


# ---------------------------------------------------------------- risk context and geocoding
def test_risk_context_near_monitored_town_is_a_labelled_estimate(client):
    ctx = client.get("/api/risk/context", params={"lat": 23.74, "lon": 92.72}).json()  # ~1 km from Aizawl
    assert ctx["status"] == "nearby_monitored" and ctx["kind"] == "model_estimate"
    assert ctx["location"]["name"] == "Aizawl" and ctx["distance_km"] < 5
    assert "not an official warning" in ctx["message"]


@pytest.mark.parametrize("lat,lon", [(10.089, 77.06), (30.555, 79.565), (25.0, 92.0)])
def test_risk_context_elsewhere_is_unavailable_not_invented(client, lat, lon):
    ctx = client.get("/api/risk/context", params={"lat": lat, "lon": lon}).json()
    assert ctx["status"] == "unavailable" and "score" not in ctx and "level" not in ctx


def test_risk_context_rejects_points_outside_india(client):
    assert client.get("/api/risk/context", params={"lat": 51.5, "lon": -0.1}).status_code == 422


def test_reverse_geocoding_disabled_by_default(client):
    r = client.get("/api/geocode/reverse", params={"lat": 31.1, "lon": 77.17})
    assert r.status_code == 200 and r.json()["status"] == "disabled"


# ---------------------------------------------------------------- rate limit and alerts
def test_rate_limit_returns_429(client):
    from app.main import app
    from app.services.report_guard import RateLimiter

    original = app.state.report_limiter
    app.state.report_limiter = RateLimiter(limit_per_hour=1)
    try:
        assert client.post("/api/reports", data=report()).status_code == 201
        limited = client.post("/api/reports", data=report())
        assert limited.status_code == 429 and "Too many" in limited.json()["detail"]
    finally:
        app.state.report_limiter = original


def test_official_warning_must_name_its_source(client, admin_headers):
    ok = client.post("/api/admin/alerts", headers=admin_headers, json={
        "title": "Heavy rain advisory relayed", "message": "Relayed from the district authority.",
        "level": "High", "state": "Uttarakhand",
        "official_source": "DDMA Chamoli", "official_reference": "https://example.org/advisory/1",
    })
    assert ok.status_code == 201 and ok.json()["official_source"] == "DDMA Chamoli"
    no_source = client.post("/api/admin/alerts", headers=admin_headers, json={
        "title": "Missing source", "message": "x" * 10, "level": "High",
        "official_reference": "https://example.org/a",
    })
    assert no_source.status_code == 422
    bad_url = client.post("/api/admin/alerts", headers=admin_headers, json={
        "title": "Bad url", "message": "x" * 10, "level": "High", "official_source": "IMD",
        "official_reference": "javascript:alert(1)",
    })
    assert bad_url.status_code == 422
