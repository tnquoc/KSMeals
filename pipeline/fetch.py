"""Polite async HTTP client for the Quang Ich school CMS (*.hcm.edu.vn).

All school and ward sites are served by the same backend, so we cap global
concurrency low and retry slow responses instead of hammering it.
"""
import asyncio
import random

import httpx

USER_AGENT = "KSMealsBot/0.1 (school meal menu survey)"
BASE_DOMAIN = "hcm.edu.vn"


def site_url(code: str, path: str = "/") -> str:
    return f"https://{code}.{BASE_DOMAIN}{path}"


class Fetcher:
    def __init__(self, concurrency: int = 4, timeout: float = 60.0, retries: int = 2):
        self._sem = asyncio.Semaphore(concurrency)
        self._retries = retries
        self._client = httpx.AsyncClient(
            headers={"User-Agent": USER_AGENT},
            timeout=timeout,
            follow_redirects=True,
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        await self._client.aclose()

    async def _get(self, url: str) -> httpx.Response | None:
        """Return a 200 response, or None on 404 / after exhausting retries."""
        for attempt in range(self._retries + 1):
            try:
                async with self._sem:
                    resp = await self._client.get(url)
                if resp.status_code == 200:
                    return resp
                if resp.status_code == 404:
                    return None
            except httpx.HTTPError:
                pass
            await asyncio.sleep(2 ** attempt + random.random())
        return None

    async def get_text(self, url: str) -> str | None:
        resp = await self._get(url)
        return resp.text if resp else None

    async def get_bytes(self, url: str) -> bytes | None:
        resp = await self._get(url)
        return resp.content if resp else None
