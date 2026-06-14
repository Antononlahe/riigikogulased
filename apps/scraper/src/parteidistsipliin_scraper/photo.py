"""Member photo thumbnails: download via the API, compress, write into the web app."""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image

# Thumbnails are committed and served statically by Next.js from apps/web/public.
THUMB_DIR = (
    Path(__file__).resolve().parents[4] / "apps" / "web" / "public" / "members"
)
THUMB_PUBLIC_PREFIX = "/members"  # URL path the web app references


def compress_thumbnail(data: bytes, max_edge: int = 160) -> bytes:
    """Downscale (never upscale) to fit max_edge and re-encode as WebP."""
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img.thumbnail((max_edge, max_edge))  # in place; preserves aspect, no upscale
    out = io.BytesIO()
    img.save(out, format="WEBP", quality=80, method=6)
    return out.getvalue()


def write_thumbnail(member_uuid: str, data: bytes, max_edge: int = 160) -> str:
    """Compress and write apps/web/public/members/<uuid>.webp; return its public path."""
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    (THUMB_DIR / f"{member_uuid}.webp").write_bytes(compress_thumbnail(data, max_edge))
    return f"{THUMB_PUBLIC_PREFIX}/{member_uuid}.webp"
