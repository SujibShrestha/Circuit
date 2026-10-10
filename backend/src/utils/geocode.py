import os

import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_USER_AGENT = os.getenv("NOMINATIM_USER_AGENT", "circuit-events/1.0")


def geocode_address(address: str) -> tuple[float, float] | None:
    try:
        response = httpx.get(
            NOMINATIM_URL,
            params={"q": address, "format": "json", "limit": 1},
            headers={"User-Agent": NOMINATIM_USER_AGENT},
            timeout=5.0,
        )
        response.raise_for_status()
        results = response.json()
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except (httpx.HTTPError, KeyError, ValueError):
        pass
    return None
