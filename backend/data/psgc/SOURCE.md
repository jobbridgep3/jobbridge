# PSGC address dataset

Source: https://github.com/isaacdarcilla/philippine-addresses (region.json / province.json / city.json / barangay.json),
a community-maintained JSON mirror of the PSA's Philippine Standard Geographic Code (PSGC) publication. Fetched and
normalized 2026-07-12.

Record counts: 17 regions, 88 provinces, 1,647 cities/municipalities, 42,029 barangays.

Field names were renamed from the upstream dataset to match this codebase's convention (`city_code`/`city_name` ->
`city_municipality_code`/`city_municipality_name`, `brgy_code`/`brgy_name` -> `barangay_code`/`barangay_name`) via
`services/psgc_service.py`. NCR cities/districts carry a pseudo `province_code` (e.g. `1339` for the City of Manila's
districts) exactly as published upstream — there is no separate "no province" case to special-case.

To refresh: re-fetch the four upstream files, re-run the same field-rename mapping, and replace the four JSON files in
this directory. No code changes should be needed unless PSGC codes themselves are restructured upstream.
