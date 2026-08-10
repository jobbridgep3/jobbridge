"""Flat skill-keyword list used by unrelated non-resume features.

Historically re-exported from services.resume_parsing (the old Vision-OCR resume
field-mapper), but that package was removed when resume extraction moved to Gemini.
The list itself is still needed here as-is by:
  - services/dashboard_service.py — vacancy-analytics keyword-frequency widget
  - blueprints/employer.py's suggest_skills() — job-posting skill suggestions
Neither of those is part of resume parsing, so the list is kept verbatim in this
module rather than removed along with the rest of the old parser.
"""

TECHNICAL_SKILL_KEYWORDS = [
    "microsoft office", "excel", "word", "powerpoint", "data entry", "python", "java",
    "javascript", "sql", "web development", "graphic design", "photoshop",
    "video editing", "social media", "carpentry", "welding", "electrical", "plumbing",
    "cooking", "baking", "driving", "typing", "cashiering", "inventory management",
    "warehousing", "housekeeping", "caregiving", "nursing", "teaching", "tutoring",
    "accounting", "bookkeeping", "sales", "marketing",
]

SOFT_SKILL_KEYWORDS = [
    "customer service", "communication", "teamwork", "leadership", "time management",
    "problem solving", "adaptability", "work ethic", "attention to detail",
    "multitasking", "interpersonal skills", "critical thinking", "patience", "flexibility",
]

SKILL_KEYWORDS = TECHNICAL_SKILL_KEYWORDS + SOFT_SKILL_KEYWORDS
