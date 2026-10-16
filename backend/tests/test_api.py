import io

from PIL import Image

from tests.conftest import TMP_DIR

VALID_RISK = {
    "rainfall_24h_mm": 140, "rainfall_72h_mm": 280, "soil_moisture": 0.45, "slope_deg": 36,
    "vegetation_ndvi": 0.35, "soil_type": "clay", "slope_modified": True,
}
REPORT = {
    "category": "ground_crack",
    "description": "New cracks in the road above the village after heavy rain.",
    "observed_severity": "moderate",
    "latitude": "25.57",
    "longitude": "91.88",
    "location_source": "map",
    "state": "Meghalaya",
    "district": "East Khasi Hills",
    "location_text": "Test location",
    "reporter_name": "Test Person",
    "reporter_contact": "test@example.com",
}


def stored_report(report_id: int):
    from app.database import SessionLocal
    from app.models import CitizenReport

    with SessionLocal() as db:
        return db.get(CitizenReport, report_id)


def image_bytes(fmt: str = "JPEG", with_gps: bool = False) -> bytes:
    img = Image.new("RGB", (64, 48), (120, 90, 60))
    buf = io.BytesIO()
    if with_gps:
        exif = Image.Exif()
        exif[0x8825] = {1: "N", 2: (25.0, 34.0, 0.0)}  # GPSInfo IFD
        exif[0x010F] = "TestCam"  # Make
        img.save(buf, format=fmt, exif=exif)
    else:
        img.save(buf, format=fmt)
    return buf.getvalue()


# ---------- public endpoints ----------
def test_health_and_meta(client):
    assert client.get("/api/health").json()["status"] == "ok"
    meta = client.get("/api/meta").json()
    assert meta["weather_provider"] == "demo"
    assert meta["model"]["available"] is True
    assert meta["model"]["is_synthetic"] is True
    assert "not an official warning service" in meta["disclaimer"]
    rep = meta["reporting"]
    assert rep["coverage"] == "India" and rep["boundary_check"] == "bounding-envelope"
    assert len(rep["states"]) == 36 and "Kerala" in rep["states"] and "Ladakh" in rep["states"]
    assert {"landslide", "flood", "road_blocked", "ground_crack", "slope_movement"} <= set(rep["categories"])
    assert rep["geocoding"]["enabled"] is False


def test_locations_are_seeded_with_labelled_demo_assessments(client):
    locs = client.get("/api/locations").json()
    assert len(locs) == 46
    assert {l["state"] for l in locs} == {
        "Assam", "Arunachal Pradesh", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Sikkim", "Tripura"
    }
    for loc in locs:
        assert loc["attributes_source"] == "demo-estimate"
        assert loc["latest"]["data_source"] == "demo"
        assert 0 <= loc["latest"]["score"] <= 100
        assert loc["latest"]["ml_probability"] is not None


def test_location_detail_and_404(client):
    first = client.get("/api/locations").json()[0]
    detail = client.get(f"/api/locations/{first['id']}").json()
    assert detail["name"] == first["name"]
    assert len(detail["history"]) >= 1
    assert client.get("/api/locations/99999").status_code == 404


def test_dashboard_summary_is_consistent(client):
    s = client.get("/api/dashboard/summary").json()
    assert s["totals"]["locations"] == 46
    assert sum(s["level_counts"].values()) == s["totals"]["assessed"] == 46
    assert s["totals"]["high_or_above"] == s["level_counts"]["High"] + s["level_counts"]["Very High"]
    assert s["is_demo"] is True
    assert len(s["by_state"]) == 8
    scores = [p["score"] for p in s["top_locations"]]
    assert scores == sorted(scores, reverse=True)


def test_predict_returns_heuristic_and_ml(client):
    r = client.post("/api/risk/predict", json=VALID_RISK)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["heuristic"]["level"] in {"Low", "Moderate", "High", "Very High"}
    assert len(body["heuristic"]["factors"]) == 7
    assert body["ml"]["available"] is True
    assert body["ml"]["is_synthetic"] is True
    assert 0 <= body["ml"]["probability"] <= 1
    assert body["disclaimer"]


def test_predict_validates_input(client):
    assert client.post("/api/risk/predict", json={**VALID_RISK, "slope_deg": 120}).status_code == 422
    assert client.post("/api/risk/predict", json={**VALID_RISK, "soil_type": "lava"}).status_code == 422


def test_methodology_and_model_card(client):
    m = client.get("/api/risk/methodology").json()
    assert "Uncalibrated" in m["calibration_status"]
    card = client.get("/api/risk/model").json()
    assert card["available"] is True
    assert "roc_auc" in card["card"]["test_metrics"]


# ---------- citizen reports ----------
def test_report_without_photo_is_pending_and_not_public(client):
    r = client.post("/api/reports", data=REPORT)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "pending"
    assert "reporter_contact" not in body
    public_ids = {x["id"] for x in client.get("/api/reports").json()}
    assert body["id"] not in public_ids


def test_report_with_photo_strips_metadata_and_keeps_it_private(client):
    files = {"photo": ("site.jpg", image_bytes("JPEG", with_gps=True), "image/jpeg")}
    r = client.post("/api/reports", data={**REPORT, "description": "Photo test: cracks in the retaining wall."}, files=files)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["has_photo"] is True and body["photo_url"] is None  # pending: not public
    saved = TMP_DIR / "uploads" / stored_report(body["id"]).photo_filename
    assert saved.exists()
    with Image.open(saved) as img:
        assert len(img.getexif()) == 0
    # No static file route, and the public photo endpoint refuses unverified reports.
    assert client.get(f"/uploads/{saved.name}").status_code == 404
    assert client.get(f"/api/reports/{body['id']}/photo").status_code == 404


def test_report_rejects_bad_input(client):
    fake = {"photo": ("x.jpg", b"not really an image", "image/jpeg")}
    assert client.post("/api/reports", data=REPORT, files=fake).status_code == 422
    london = {**REPORT, "latitude": "51.507", "longitude": "-0.128"}
    assert client.post("/api/reports", data=london).status_code == 422
    assert client.post("/api/reports", data={**REPORT, "description": "short"}).status_code == 422
    assert client.post("/api/reports", data={**REPORT, "category": "volcano"}).status_code == 422


# ---------- admin ----------
def test_admin_requires_valid_credentials(client):
    assert client.post("/api/admin/login", json={"username": "admin", "password": "wrong"}).status_code == 401
    assert client.get("/api/admin/reports").status_code == 401
    bad = {"Authorization": "Bearer forged.token"}
    assert client.get("/api/admin/reports", headers=bad).status_code == 401


def test_admin_report_workflow(client, admin_headers):
    created = client.post(
        "/api/reports", data={**REPORT, "description": "Workflow test: slope cracked above the school."},
        files={"photo": ("p.png", image_bytes("PNG"), "image/png")},
    ).json()

    listing = client.get("/api/admin/reports?status=pending", headers=admin_headers).json()
    mine = next(x for x in listing if x["id"] == created["id"])
    assert mine["reporter_contact"] == "test@example.com"
    assert mine["photo_url"].startswith(f"/api/admin/media/{created['id']}/photo?exp=")
    assert client.get(mine["photo_url"]).status_code == 200  # signed link works without a bearer token

    upd = client.patch(f"/api/admin/reports/{created['id']}", headers=admin_headers,
                       json={"status": "verified", "admin_notes": "Confirmed by field team"})
    assert upd.status_code == 200 and upd.json()["status"] == "verified"
    assert upd.json()["reviewed_by"] == "admin" and upd.json()["reviewed_at"]
    public = client.get("/api/reports").json()
    entry = next(x for x in public if x["id"] == created["id"])
    assert all("reporter_contact" not in x and "reporter_name" not in x and "address" not in x for x in public)
    assert entry["photo_url"] == f"/api/reports/{created['id']}/photo"
    assert client.get(entry["photo_url"]).status_code == 200  # public once verified

    photo = TMP_DIR / "uploads" / stored_report(created["id"]).photo_filename
    assert photo.exists()
    assert client.delete(f"/api/admin/reports/{created['id']}", headers=admin_headers).status_code == 204
    assert not photo.exists()
    assert client.patch(f"/api/admin/reports/{created['id']}", headers=admin_headers,
                        json={"status": "verified"}).status_code == 404


def test_admin_alert_lifecycle(client, admin_headers):
    loc = client.get("/api/locations").json()[0]
    r = client.post("/api/admin/alerts", headers=admin_headers, json={
        "title": "Road closure advisory", "message": "Test advisory issued by admin.",
        "level": "High", "location_id": loc["id"],
    })
    assert r.status_code == 201, r.text
    alert = r.json()
    assert alert["source"] == "admin" and alert["is_demo"] is False
    assert alert["state"] == loc["state"] and alert["latitude"] == loc["latitude"]
    assert any(a["id"] == alert["id"] for a in client.get("/api/alerts").json())

    resolved = client.patch(f"/api/admin/alerts/{alert['id']}", headers=admin_headers, json={"status": "resolved"})
    assert resolved.json()["status"] == "resolved" and resolved.json()["resolved_at"]
    assert not any(a["id"] == alert["id"] for a in client.get("/api/alerts").json())
    assert any(a["id"] == alert["id"] for a in client.get("/api/alerts?status=resolved").json())


def test_system_alerts_from_demo_data_are_flagged(client):
    for a in client.get("/api/alerts?status=all").json():
        if a["source"] == "system":
            assert a["is_demo"] is True
            assert a["title"].startswith("[DEMO]")
            assert "NOT A REAL WARNING" in a["message"]


def test_spa_hosting_when_frontend_is_built(client):
    from app.main import FRONTEND_DIST

    if not FRONTEND_DIST.is_dir():
        import pytest
        pytest.skip("frontend/dist not built")
    page = client.get("/map")
    assert page.status_code == 200 and "<title>LandslideGuard AI</title>" in page.text
    assert client.get("/assets/missing-file.js").status_code == 404
    assert client.get("/api/unknown").status_code == 404


def test_refresh_creates_new_assessments(client, admin_headers):
    loc_id = client.get("/api/locations").json()[0]["id"]
    before = len(client.get(f"/api/locations/{loc_id}").json()["history"])
    r = client.post("/api/admin/assessments/refresh", headers=admin_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["assessed"] == 46 and body["data_source"] == "demo"
    after = len(client.get(f"/api/locations/{loc_id}").json()["history"])
    assert after == before + 1
