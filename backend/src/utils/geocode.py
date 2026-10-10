import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

def geocode_address(address: str) -> tuple[float, float] | None:
    try:
        response = httpx.get(
            NOMINATIM_URL,
            params={"q": address, "format": "json", "limit": 1},
            headers={"User-Agent": "circuit-events/1.0 (your-email@example.com)"},
            timeout=5.0,
        )
        response.raise_for_status()
        results = response.json()
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except (httpx.HTTPError, KeyError, ValueError):
        pass
    return None