from __future__ import annotations

import asyncio
import os
import time

import httpx

DEFAULT_BASE = "https://ariregister.rik.ee/est/political_party"
DEFAULT_UA = (
    "parteidistsipliin-scraper/0.2 "
    "(+https://github.com/antononlahe/parteidistsipliin; data RIK avaandmed)"
)


class AriregisterClient:
    """Polite async HTML client for the ariregister political-party registry.

    Same throttle/backoff discipline as ApiClient. Returns raw HTML text.
    """

    def __init__(
        self,
        base_url: str | None = None,
        user_agent: str | None = None,
        delay_ms: int | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.base_url = (base_url or os.getenv("ARIREGISTER_BASE") or DEFAULT_BASE).rstrip("/")
        self.user_agent = user_agent or os.getenv("SCRAPER_USER_AGENT") or DEFAULT_UA
        env_delay = int(os.getenv("ARIREGISTER_DELAY_MS", "1000"))
        self.delay_s = (env_delay if delay_ms is None else delay_ms) / 1000
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            headers={"User-Agent": self.user_agent, "Accept": "text/html"},
            follow_redirects=True,
            transport=transport,
        )
        self._last_request_at = 0.0

    async def __aenter__(self) -> AriregisterClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self._client.aclose()

    async def search(self, person_name: str) -> str:
        return await self._get("/members_search", {"person_name": person_name})

    async def history(self, person_id: str) -> str:
        return await self._get(f"/member_history/{person_id}", None)

    async def _get(self, path: str, params: dict | None) -> str:
        url = f"{self.base_url}{path}"
        # Retry on transient HTTP statuses AND transport errors, matching ApiClient. A bare
        # ConnectTimeout/ReadTimeout (httpx.RequestError) would otherwise propagate uncaught and
        # abort the whole multi-minute erakond run on one slow response from the registry.
        last_exc: httpx.RequestError | None = None
        for attempt in range(5):
            await self._respect_delay()
            try:
                resp = await self._client.get(url, params=params)
            except httpx.RequestError as exc:
                last_exc = exc
                await asyncio.sleep(2**attempt)
                continue
            if resp.status_code == 200:
                return resp.text
            if resp.status_code in (429, 502, 503, 504):
                await asyncio.sleep(2**attempt)
                continue
            resp.raise_for_status()
        if last_exc is not None:
            raise last_exc
        raise RuntimeError(f"failed to fetch {url} after retries")

    async def _respect_delay(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.delay_s:
            await asyncio.sleep(self.delay_s - elapsed)
        self._last_request_at = time.monotonic()
