from __future__ import annotations

import asyncio
import os
import time
from typing import Any

import httpx

DEFAULT_API_BASE = "https://api.riigikogu.ee"
DEFAULT_UA = (
    "parteidistsipliin-scraper/0.2 "
    "(+https://github.com/antononlahe/parteidistsipliin; data CC-BY-SA 3.0)"
)


class ApiClient:
    """Polite async JSON client for api.riigikogu.ee.

    The API allows at most 1 request/second per IP (429 above that, observed live), so
    the client hard-throttles to a minimum inter-request delay and backs off on 429/5xx.
    A custom ``transport`` may be injected for tests.
    """

    def __init__(
        self,
        base_url: str | None = None,
        user_agent: str | None = None,
        delay_ms: int | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        raw_base = base_url or os.getenv("RIIGIKOGU_API_BASE") or DEFAULT_API_BASE
        self.base_url = raw_base.rstrip("/")
        self.user_agent = user_agent or os.getenv("SCRAPER_USER_AGENT") or DEFAULT_UA
        env_delay = int(os.getenv("API_REQUEST_DELAY_MS", "1000"))
        self.delay_s = (env_delay if delay_ms is None else delay_ms) / 1000
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            headers={"User-Agent": self.user_agent, "Accept": "application/json"},
            follow_redirects=True,
            transport=transport,
        )
        self._last_request_at: float = 0.0

    async def __aenter__(self) -> ApiClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self._client.aclose()

    async def get_json(self, path: str, params: dict[str, Any] | None = None) -> Any:
        url = path if path.startswith("http") else f"{self.base_url}{path}"
        for attempt in range(5):
            await self._respect_delay()
            resp = await self._client.get(url, params=params)
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code in (429, 502, 503, 504):
                await asyncio.sleep(2**attempt)
                continue
            resp.raise_for_status()
        raise RuntimeError(f"failed to fetch {url} after retries")

    async def get_bytes(self, path: str) -> bytes:
        """Fetch a binary file (e.g. a member photo). Same throttle/backoff as get_json."""
        url = path if path.startswith("http") else f"{self.base_url}{path}"
        for attempt in range(5):
            await self._respect_delay()
            resp = await self._client.get(url, headers={"Accept": "*/*"})
            if resp.status_code == 200:
                return resp.content
            if resp.status_code in (429, 502, 503, 504):
                await asyncio.sleep(2**attempt)
                continue
            resp.raise_for_status()
        raise RuntimeError(f"failed to fetch {url} after retries")

    async def _respect_delay(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.delay_s:
            await asyncio.sleep(self.delay_s - elapsed)
        self._last_request_at = time.monotonic()
