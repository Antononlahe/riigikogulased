import httpx
import pytest

from parteidistsipliin_scraper.ariregister_client import AriregisterClient


def _transport(responses):
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        i = min(calls["n"], len(responses) - 1)
        calls["n"] += 1
        status, text = responses[i]
        return httpx.Response(status, text=text)

    return httpx.MockTransport(handler), calls


@pytest.mark.asyncio
async def test_search_returns_html():
    transport, _ = _transport([(200, "<html>ok</html>")])
    async with AriregisterClient(delay_ms=0, transport=transport) as c:
        html = await c.search("Alar Laneman")
    assert "ok" in html


@pytest.mark.asyncio
async def test_history_retries_on_429():
    transport, calls = _transport([(429, ""), (200, "<html>h</html>")])
    async with AriregisterClient(delay_ms=0, transport=transport) as c:
        html = await c.history("9000034247")
    assert "h" in html and calls["n"] == 2
