"""End-to-end check of the post-results contract EventDetail.tsx now calls:
POST /events/{id}/results -> {awarded: int}, idempotent on repeat."""
import sys
import uuid
from datetime import datetime, timedelta, timezone

import httpx

BASE = "http://127.0.0.1:8077"
stamp = uuid.uuid4().hex[:8]
org_email = f"org-{stamp}@example.com"
user_email = f"user-{stamp}@example.com"

now = datetime.now(timezone.utc)
# Event opens now and closes in 30s: register + mark attendance while it is
# live, then post results once it has actually ended. The window has to cover
# geocoding + remote-DB latency (~2-3s), hence 30 rather than 5.
end = now + timedelta(seconds=30)
start = (now - timedelta(minutes=5)).isoformat()
end_iso = end.isoformat()


def make_user(client, email, role):
    r = client.post("/auth/register", json={"name": role, "email": email, "password": "secret123", "role": role})
    assert r.status_code == 201, r.text
    login = client.post("/auth/login", data={"username": email, "password": "secret123"})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


with httpx.Client(base_url=BASE, timeout=20) as client:
    org = make_user(client, org_email, "organizer")
    user = make_user(client, user_email, "participant")
    user_id = client.get("/auth/me", headers=user).json()["id"]

    event = client.post(
        "/events/",
        json={"name": "Past Hack", "category": "hackathon", "venue": "Sankhu, Kathmandu",
              "start_time": start, "end_time": end_iso, "capacity": 10},
        headers=org,
    )
    assert event.status_code == 201, event.text
    event_id = event.json()["id"]

    reg = client.post("/registrations/", json={"event_id": event_id}, headers=user)
    assert reg.status_code == 201, reg.text

    # attendance is a precondition for placing
    attend = client.post(f"/events/{event_id}/attendees/{user_id}/attend", headers=org)
    print("attend:", attend.status_code, attend.text.strip())
    assert attend.status_code == 200, attend.text

    # results may only be posted after the event ends: wait out the real clock
    # rather than guessing how much latency the request took.
    import time

    time.sleep(max(0, (end - datetime.now(timezone.utc)).total_seconds()) + 2)

    before = client.get("/auth/me", headers=user).json()["xp"]

    results = client.post(f"/events/{event_id}/results",
                          json={"results": [{"place": 1, "user_id": user_id}]}, headers=org)
    print("post results:", results.status_code, results.json())
    assert results.status_code == 200, results.text
    assert results.json() == {"awarded": 1}, results.json()

    after = client.get("/auth/me", headers=user).json()["xp"]
    assert after == before + 100, f"expected +100, {before} -> {after}"

    # repeat must be a no-op (idempotent), not a double award
    again = client.post(f"/events/{event_id}/results",
                        json={"results": [{"place": 1, "user_id": user_id}]}, headers=org)
    assert again.json() == {"awarded": 0}, again.json()
    assert client.get("/auth/me", headers=user).json()["xp"] == after

    # duplicate place rejected
    dup = client.post(f"/events/{event_id}/results",
                      json={"results": [{"place": 1, "user_id": user_id},
                                        {"place": 1, "user_id": user_id}]}, headers=org)
    assert dup.status_code == 400, dup.text

    ledger = client.get("/auth/me/xp", headers=user).json()
    reasons = sorted(e["reason"] for e in ledger)
    print("participant ledger:", reasons)
    assert reasons == ["attended", "signup", "won_first"], reasons

print("ALL PASS")
sys.exit(0)
