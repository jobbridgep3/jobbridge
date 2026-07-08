"""Shared regex patterns used by more than one field extractor."""

import re

DOB_LABEL_RE = re.compile(r"(?:date of birth|d\.?o\.?b\.?|birth date)\s*[:\-]?\s*(.+)", re.IGNORECASE)
