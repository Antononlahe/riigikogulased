from __future__ import annotations

import asyncio
import os
import time

import httpx

DEFAULT_BASE = "https://www.riigikogu.ee"
DEFAULT_UA = "parteidistsipliin-scraper/0.1 (+https://github.com/antononlahe/parteidistsipliin)"


class RiigikoguClient:
    """Polite httpx wrapper: enforces a minimum delay between requests, identifies
    itself via User-Agent, and retries transient failures."""

    def __init__(
        self,
        base_url: str | None = None,
        user_agent: str | None = None,
        delay_ms: int | None = None,
    ) -> None:
        self.base_url = (base_url or os.getenv("RIIGIKOGU_BASE_URL") or DEFAULT_BASE).rstrip("/")
        self.user_agent = user_agent or os.getenv("SCRAPER_USER_AGENT") or DEFAULT_UA
        self.delay_s = (delay_ms or int(os.getenv("SCRAPER_REQUEST_DELAY_MS", "250"))) / 1000
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            headers={"User-Agent": self.user_agent, "Accept-Language": "et,en;q=0.5"},
            follow_redirects=True,
        )
        self._last_request_at: float = 0.0

    async def __aenter__(self) -> RiigikoguClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self._client.aclose()

    async def get(self, path: str) -> str:
        url = path if path.startswith("http") else f"{self.base_url}{path}"
        await self._respect_delay()
        for attempt in range(3):
            try:
                resp = await self._client.get(url)
                if resp.status_code == 200:
                    return resp.text
                if resp.status_code in (429, 502, 503, 504):
                    await asyncio.sleep(2 ** attempt)
                    continue
                resp.raise_for_status()
            except httpx.HTTPError:
                if attempt == 2:
                    raise
                await asyncio.sleep(2 ** attempt)
        raise RuntimeError(f"unreachable: failed to fetch {url}")

    async def _respect_delay(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.delay_s:
            await asyncio.sleep(self.delay_s - elapsed)
        self._last_request_at = time.monotonic()
