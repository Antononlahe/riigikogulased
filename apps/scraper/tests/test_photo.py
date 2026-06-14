import io

from PIL import Image

from parteidistsipliin_scraper.photo import compress_thumbnail


def _png_bytes(w: int, h: int) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (200, 30, 30)).save(buf, format="PNG")
    return buf.getvalue()


def test_compress_thumbnail_shrinks_and_outputs_webp():
    out = compress_thumbnail(_png_bytes(640, 480), max_edge=160)
    assert len(out) > 0
    img = Image.open(io.BytesIO(out))
    assert img.format == "WEBP"
    assert max(img.size) <= 160


def test_compress_thumbnail_does_not_upscale_small_images():
    out = compress_thumbnail(_png_bytes(80, 100), max_edge=160)
    img = Image.open(io.BytesIO(out))
    assert img.size == (80, 100)
