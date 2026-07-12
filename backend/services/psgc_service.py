"""In-memory PSGC (Philippine Standard Geographic Code) address lookup.

Backs the Region -> Province -> City/Municipality -> Barangay cascading address
picker shared by Company Profile, HR Profile, and Vacancy Location. The four
source files (backend/data/psgc/*.json) are loaded once at import time and kept
in memory for the life of the process — this is a read-only reference dataset,
not something any request ever writes to, so there's no DB round-trip cost to
paying for it per-request. See data/psgc/SOURCE.md for provenance/refresh notes.
"""

import json
import os

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "psgc")


def _load(filename):
    with open(os.path.join(_DATA_DIR, filename), encoding="utf-8") as f:
        return json.load(f)


def _dedupe_by_code(items, code_key):
    """The upstream dataset carries one legacy duplicate (province_code 1339 listed
    twice, under an old and a current NCR district name) — keep the first-listed
    entry per code so cascading-dropdown <option> keys/values are always unique."""
    seen = set()
    deduped = []
    for item in items:
        code = item[code_key]
        if code in seen:
            continue
        seen.add(code)
        deduped.append(item)
    return deduped


_REGIONS = _dedupe_by_code(_load("regions.json"), "region_code")
_PROVINCES = _dedupe_by_code(_load("provinces.json"), "province_code")
_CITIES = _dedupe_by_code(_load("cities_municipalities.json"), "city_municipality_code")
_BARANGAYS = _dedupe_by_code(_load("barangays.json"), "barangay_code")

_PROVINCES_BY_REGION = {}
for _p in _PROVINCES:
    _PROVINCES_BY_REGION.setdefault(_p["region_code"], []).append(_p)

_CITIES_BY_PROVINCE = {}
for _c in _CITIES:
    _CITIES_BY_PROVINCE.setdefault(_c["province_code"], []).append(_c)

_BARANGAYS_BY_CITY = {}
for _b in _BARANGAYS:
    _BARANGAYS_BY_CITY.setdefault(_b["city_municipality_code"], []).append(_b)

_REGION_CODES = {r["region_code"] for r in _REGIONS}
_PROVINCE_CODES = {p["province_code"] for p in _PROVINCES}
_CITY_CODES = {c["city_municipality_code"] for c in _CITIES}
_BARANGAY_CODES = {b["barangay_code"] for b in _BARANGAYS}


def get_regions():
    return _REGIONS


def get_provinces(region_code: str):
    return _PROVINCES_BY_REGION.get(region_code, [])


def get_cities(province_code: str):
    return _CITIES_BY_PROVINCE.get(province_code, [])


def get_barangays(city_municipality_code: str):
    return _BARANGAYS_BY_CITY.get(city_municipality_code, [])


def validate_address(region_code=None, province_code=None, city_municipality_code=None, barangay_code=None) -> bool:
    """True if every non-empty code provided actually exists in the PSGC dataset.
    All codes are optional (a partially-filled address is still "valid" here —
    this only catches garbage/mismatched codes, not incompleteness, which is a
    profile-completion concern handled elsewhere)."""
    if region_code and region_code not in _REGION_CODES:
        return False
    if province_code and province_code not in _PROVINCE_CODES:
        return False
    if city_municipality_code and city_municipality_code not in _CITY_CODES:
        return False
    if barangay_code and barangay_code not in _BARANGAY_CODES:
        return False
    return True
