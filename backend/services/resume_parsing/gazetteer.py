"""Static Philippine location lists used for confident (not guessed) address extraction.

This is a municipal PESO (Public Employment Service Office) system for Pila, Laguna —
jobseekers registering are overwhelmingly Pila residents, and the rest are almost all
from elsewhere in Laguna province. Lists are intentionally biased toward that
population (CALABARZON/Laguna) rather than a full 81-province gazetteer: a false
negative here just means the address field stays blank (safe, matches the "leave
blank rather than guess" rule), so there's no correctness cost to starting narrow and
extending only if real resumes surface a miss.
"""

# Laguna's cities/municipalities (all 30) — matched first since it's the most specific
# and most useful signal for this system's population.
LAGUNA_MUNICIPALITIES = [
    "Alaminos", "Bay", "Biñan", "Binan", "Cabuyao", "Calamba", "Calauan", "Cavinti",
    "Famy", "Kalayaan", "Liliw", "Los Baños", "Los Banos", "Luisiana", "Lumban",
    "Mabitac", "Magdalena", "Majayjay", "Nagcarlan", "Paete", "Pagsanjan", "Pakil",
    "Pangil", "Pila", "Rizal", "San Pablo", "San Pedro", "Santa Cruz", "Santa Maria",
    "Santa Rosa", "Siniloan", "Victoria",
]

# Pila's own barangays — used only for a same-line adjacent match next to a "Pila"
# municipality hit, since barangay names alone are too generic/common a word to
# confidently match anywhere else in a document.
PILA_BARANGAYS = [
    "Bagong Pook", "Bagumbayan", "Balanac", "Bepench", "Bukal", "Concepcion",
    "Linga", "Masico", "Pansol", "Pinagbayanan", "Poblacion I", "Poblacion II",
    "Poblacion III", "Poblacion IV", "Poblacion V", "Poblacion VI", "Poblacion VII",
    "San Antonio", "San Miguel", "Santa Catalina Norte", "Santa Catalina Sur",
    "Santo Angel Central", "Santo Angel Norte", "Santo Angel Sur", "Saytan", "Tubuan I",
    "Tubuan II",
]

# Short, CALABARZON-biased province list — extend only if testing shows real misses.
PH_PROVINCES = [
    "Laguna", "Batangas", "Cavite", "Rizal", "Quezon",
    "Metro Manila", "Metro Manila (NCR)", "NCR",
]
