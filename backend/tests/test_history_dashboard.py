"""Report verification history, report detail endpoints, dashboard report statistics, place search."""

import uuid
from datetime import datetime, timezone

import httpx

from app.services.geocoding import ReverseGeocoder
from tests.test_geocoding_uploads import settings as geo_settings


def new_report(client, **overrides):
    data = {
        "category": "landslide", "observed_severity": "severe", "location_source": "map",
        "description": f"History test {uuid.uuid4().hex[:8]}: slope collapsed onto the road.",
        "latitude": "30.555", "longitude": "79.565", "state": "Uttarakhand", "district": "Chamoli",
        "reporter_contact": "private@example.com", **overrides,
    }
    r = client.post("/api/reports", data=data)
    assert r.status_code == 201, r.text
    return r.json()


def test_new_report_is_trackable_but_content_stays_private(client):
    rep = new_report(client)
    d = client.get(f"/api/reports/{rep['id']}").json()
    assert d["visible"] is False and d["status"] == "pending" and d["report"] is None
    assert "waiting for an administrator" in d["message"]
    assert [e["kind"] for e in d["history"]] == ["submitted"]
    assert d["history"][0]["to_status"] == "pending"


def test_status_change_history_admin_vs_public(client, admin_headers):
    rep = new_report(client)
    rid = rep["id"]
    client.patch(f"/api/admin/reports/{rid}", headers=admin_headers, json={"admin_notes": "Called the reporter"})
    client.patch(f"/api/admin/reports/{rid}", headers=admin_headers, json={"district": "Chamoli (Joshimath)"})
    client.patch(f"/api/admin/reports/{rid}", headers=admin_headers, json={"status": "verified"})

    admin = client.get(f"/api/admin/reports/{rid}", headers=admin_headers).json()
    kinds = [e["kind"] for e in admin["history"]]
    assert kinds == ["submitted", "notes_updated", "location_corrected", "status_changed"]
    change = admin["history"][-1]
    assert (change["from_status"], change["to_status"], change["actor"]) == ("pending", "verified", "admin")
    assert admin["report"]["reporter_contact"] == "private@example.com"

    public = client.get(f"/api/reports/{rid}").json()
    assert public["visible"] is True and public["report"]["district"] == "Chamoli (Joshimath)"
    assert [e["kind"] for e in public["history"]] == ["submitted", "status_changed"]  # no internal notes/edits
    assert all(e["actor"] is None and e["detail"] is None for e in public["history"])  # no admin names
    assert "reporter_contact" not in public["report"]


def test_no_event_when_nothing_changes(client, admin_headers):
    rid = new_report(client)["id"]
    client.patch(f"/api/admin/reports/{rid}", headers=admin_headers, json={"status": "pending"})
    client.patch(f"/api/admin/reports/{rid}", headers=admin_headers, json={"state": "Uttarakhand"})
    history = client.get(f"/api/admin/reports/{rid}", headers=admin_headers).json()["history"]
    assert [e["kind"] for e in history] == ["submitted"]


def test_rejected_report_shows_only_status(client, admin_headers):
    rid = new_report(client)["id"]
    client.patch(f"/api/admin/reports/{rid}", headers=admin_headers, json={"status": "rejected"})
    d = client.get(f"/api/reports/{rid}").json()
    assert d["visible"] is False and d["status"] == "rejected" and "not published" in d["message"]


def test_report_detail_errors_and_auth(client):
    assert client.get("/api/reports/999999").status_code == 404
    assert client.get("/api/admin/reports/1").status_code == 401


def test_deleting_a_report_deletes_its_history(client, admin_headers):
    from sqlalchemy import func, select

    from app.database import SessionLocal
    from app.models import ReportEvent

    rid = new_report(client)["id"]
    client.patch(f"/api/admin/reports/{rid}", headers=admin_headers, json={"status": "verified"})
    assert client.delete(f"/api/admin/reports/{rid}", headers=admin_headers).status_code == 204
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(ReportEvent).where(ReportEvent.report_id == rid)) == 0


def test_dashboard_report_statistics_are_consistent(client, admin_headers):
    before = client.get("/api/dashboard/summary").json()["reports"]
    rid = new_report(client, category="flash_flood")["id"]
    client.patch(f"/api/admin/reports/{rid}", headers=admin_headers, json={"status": "verified"})
    after = client.get("/api/dashboard/summary").json()["reports"]

    assert after["total"] == before["total"] + 1
    assert after["verified"] == before["verified"] + 1
    assert after["total"] == sum(after["by_status"].values())
    assert after["public_by_type"].get("flash_flood", 0) == before["public_by_type"].get("flash_flood", 0) + 1
    assert len(after["trend"]) == after["trend_days"] == 30
    today = datetime.now(timezone.utc).date().isoformat()
    assert after["trend"][-1]["date"] == today
    assert after["trend"][-1]["received"] >= 1 and after["trend"][-1]["verified_now"] >= 1
    assert after["demo"] >= 1  # seeded samples are counted so the UI can label them


def test_place_search_disabled_by_default(client):
    r = client.get("/api/geocode/search", params={"q": "Joshimath"})
    assert r.status_code == 200 and r.json()["status"] == "disabled"
    assert client.get("/api/geocode/search", params={"q": "x"}).status_code == 422


def test_place_search_parses_results_and_drops_foreign_places():
    seen = {}

    def handler(request):
        seen["params"] = dict(request.url.params)
        return httpx.Response(200, json=[
            {"lat": "30.5553", "lon": "79.5650", "display_name": "Joshimath, Chamoli, Uttarakhand, India",
             "type": "town", "address": {"state": "Uttarakhand", "state_district": "Chamoli"}},
            {"lat": "51.5", "lon": "-0.12", "display_name": "Somewhere abroad", "address": {}},
        ])

    g = ReverseGeocoder(geo_settings(), client=httpx.Client(transport=httpx.MockTransport(handler)), min_interval=0)
    result = g.search("Joshimath")
    assert seen["params"]["countrycodes"] == "in"
    assert result["status"] == "ok" and len(result["results"]) == 1
    place = result["results"][0]
    assert place["state"] == "Uttarakhand" and place["district"] == "Chamoli" and place["latitude"] == 30.5553
