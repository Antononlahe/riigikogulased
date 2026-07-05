"""Estonian place -> (lat, lon) for the birthplace pin map.

Birthplaces are freeform ("Tallinn", "Kihnu", "Taagepera küla, Valgamaa"). coords_for tries an
exact town, then falls back to the county named after a comma (village -> county seat). Unknown
places return None; the writer logs them so they get added rather than silently dropped.
"""

from __future__ import annotations

# 15 counties -> their seat's coordinates (the fallback for villages "..., Xmaa").
COUNTY_COORDS: dict[str, tuple[float, float]] = {
    "Harjumaa": (59.437, 24.754),
    "Hiiumaa": (58.998, 22.749),
    "Ida-Virumaa": (59.359, 27.421),
    "Jõgevamaa": (58.746, 26.394),
    "Järvamaa": (58.886, 25.557),
    "Läänemaa": (58.943, 23.541),
    "Lääne-Virumaa": (59.346, 26.356),
    "Põlvamaa": (58.060, 27.069),
    "Pärnumaa": (58.386, 24.497),
    "Raplamaa": (59.007, 24.792),
    "Saaremaa": (58.253, 22.485),
    "Tartumaa": (58.378, 26.729),
    "Valgamaa": (57.777, 26.047),
    "Viljandimaa": (58.364, 25.590),
    "Võrumaa": (57.834, 27.019),
}

# Towns/cities (extend as new birthplaces appear in the scrape).
TOWN_COORDS: dict[str, tuple[float, float]] = {
    "Tallinn": (59.437, 24.754),
    "Tartu": (58.378, 26.729),
    "Narva": (59.377, 28.190),
    "Pärnu": (58.386, 24.497),
    "Kohtla-Järve": (59.399, 27.273),
    "Viljandi": (58.364, 25.590),
    "Rakvere": (59.346, 26.356),
    "Maardu": (59.476, 25.025),
    "Kuressaare": (58.253, 22.485),
    "Sillamäe": (59.400, 27.760),
    "Valga": (57.777, 26.047),
    "Võru": (57.834, 27.019),
    "Jõhvi": (59.359, 27.421),
    "Haapsalu": (58.943, 23.541),
    "Keila": (59.303, 24.413),
    "Paide": (58.886, 25.557),
    "Elva": (58.222, 26.421),
    "Tapa": (59.259, 25.958),
    "Põlva": (58.060, 27.069),
    "Jõgeva": (58.746, 26.394),
    "Türi": (58.808, 25.432),
    "Rapla": (59.007, 24.792),
    "Kärdla": (58.998, 22.749),
    "Tõrva": (58.004, 25.933),
    "Kihnu": (58.135, 24.000),
    "Kilingi-Nõmme": (58.148, 25.070),
    "Antsla": (57.824, 26.541),
    "Põltsamaa": (58.653, 25.972),
    "Rapina": (58.101, 27.457),
    "Räpina": (58.101, 27.457),
    "Saue": (59.322, 24.552),
    "Sindi": (58.401, 24.665),
    "Paldiski": (59.356, 24.048),
    "Mustvee": (58.848, 26.945),
    "Kiviõli": (59.353, 26.969),
    "Orissaare": (58.562, 23.080),
    "Vändra": (58.651, 25.031),
    "Võhma": (58.632, 25.551),
}

_COUNTY_ALIASES = {"maakond": "maa"}


def _norm(s: str) -> str:
    return s.strip().strip(".")


def coords_for(place: str | None) -> tuple[float, float] | None:
    if not place:
        return None
    segments = [_norm(seg) for seg in place.split(",")]
    # 1) exact town on any segment (usually the first)
    for seg in segments:
        if seg in TOWN_COORDS:
            return TOWN_COORDS[seg]
    # 2) county fallback on any segment ("Valgamaa", or "Valga maakond" -> "Valgamaa")
    for seg in segments:
        key = seg.replace(" maakond", "maa")
        if key in COUNTY_COORDS:
            return COUNTY_COORDS[key]
    return None
