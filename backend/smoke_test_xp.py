"""Smoke test for the three fixes: signup bonus, XP ledger endpoint."""
import sys
import uuid

import httpx

BASE = "http://127.0.0.1:8077"
email = f"xp-smoke-{uuid.uuid4().hex[:8]}@example.com"

with httpx.Client(base_url=BASE, timeout=20) as client:
    reg = client.post(
        "/auth/register",
        json={"name": "XP Smoke", "email": email, "password": "secret123", "role": "participant"},
    )
    print("register:", reg.status_code, reg.json())
    assert reg.status_code == 201, reg.text
    assert reg.json()["xp"] == 100, "signup bonus not applied to users.xp"
    assert reg.json()["level"] == 2, f"level should be 2 at 100 xp, got {reg.json()['level']}"

    login = client.post("/auth/login", data={"username": email, "password": "secret123"})
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    ledger = client.get("/auth/me/xp", headers=headers)
    print("ledger:", ledger.status_code, ledger.json())
    assert ledger.status_code == 200, ledger.text
    entries = ledger.json()
    assert len(entries) == 1, f"expected 1 ledger row, got {len(entries)}"
    assert entries[0]["reason"] == "signup"
    assert entries[0]["xp"] == 100
    assert entries[0]["event_id"] is None and entries[0]["event_name"] is None

    # unauthenticated must be rejected
    assert client.get("/auth/me/xp").status_code == 401

print("ALL PASS")
sys.exit(0)
