import time

import httpx
import pytest

from parteidistsipliin_scraper.api_client import ApiClient


def _transport(responses):
    """MockTransport that yields the given responses in order, then repeats the last."""
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        i = min(calls["n"], len(responses) - 1)
        calls["n"] += 1
        status, payload = responses[i]
        return httpx.Response(status, json=payload)

    return httpx.MockTransport(handler), calls


@pytest.mark.asyncio
async def test_get_json_returns_parsed_body():
    transport, _ = _transport([(200, {"ok": True})])
    async with ApiClient(delay_ms=0, transport=transport) as client:
        body = await client.get_json("/api/anything")
    assert body == {"ok": True}


@pytest.mark.asyncio
async def test_retries_on_429_then_succeeds():
    transport, calls = _transport([(429, {}), (200, {"ok": 1})])
    async with ApiClient(delay_ms=0, transport=transport) as client:
        body = await client.get_json("/api/x")
    assert body == {"ok": 1}
    assert calls["n"] == 2  # one 429, one success


@pytest.mark.asyncio
async def test_throttle_spaces_requests():
    transport, _ = _transport([(200, {})])
    async with ApiClient(delay_ms=80, transport=transport) as client:
        await client.get_json("/api/a")
        t0 = time.monotonic()
        await client.get_json("/api/b")
        elapsed = time.monotonic() - t0
    assert elapsed >= 0.075  # second call waited ~80ms
