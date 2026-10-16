"""Feature definitions shared by the heuristic engine, the ML pipeline and the API."""

from __future__ import annotations

SOIL_TYPES: tuple[str, ...] = ("rock", "sandy", "loamy", "clay")

NUMERIC_FEATURES: list[str] = [
    "rainfall_24h_mm",
    "rainfall_72h_mm",
    "soil_moisture",
    "slope_deg",
    "vegetation_ndvi",
    "slope_modified",
]
CATEGORICAL_FEATURES: list[str] = ["soil_type"]
FEATURE_COLUMNS: list[str] = NUMERIC_FEATURES + CATEGORICAL_FEATURES
LABEL_COLUMN = "landslide"

# Human-readable metadata and valid ranges (used for validation and the UI).
FEATURE_SPECS: dict[str, dict] = {
    "rainfall_24h_mm": {
        "label": "Rainfall, last 24 h",
        "unit": "mm",
        "min": 0.0,
        "max": 600.0,
        "group": "trigger",
        "description": "Accumulated precipitation over the previous 24 hours.",
    },
    "rainfall_72h_mm": {
        "label": "Rainfall, last 72 h",
        "unit": "mm",
        "min": 0.0,
        "max": 1500.0,
        "group": "trigger",
        "description": "Antecedent rainfall over the previous 3 days (includes the last 24 h).",
    },
    "soil_moisture": {
        "label": "Soil moisture",
        "unit": "m³/m³",
        "min": 0.0,
        "max": 0.6,
        "group": "trigger",
        "description": "Volumetric water content of the upper soil layer.",
    },
    "slope_deg": {
        "label": "Slope angle",
        "unit": "°",
        "min": 0.0,
        "max": 70.0,
        "group": "susceptibility",
        "description": "Terrain slope, ideally derived from a DEM (e.g. SRTM / Cartosat).",
    },
    "vegetation_ndvi": {
        "label": "Vegetation cover (NDVI)",
        "unit": "",
        "min": 0.0,
        "max": 1.0,
        "group": "susceptibility",
        "description": "Normalised Difference Vegetation Index; dense forest ~0.7-0.9.",
    },
    "slope_modified": {
        "label": "Road cut / excavation nearby",
        "unit": "",
        "min": 0,
        "max": 1,
        "group": "susceptibility",
        "description": "Whether the slope has been cut for roads, buildings or quarrying.",
    },
    "soil_type": {
        "label": "Soil / material type",
        "unit": "",
        "choices": list(SOIL_TYPES),
        "group": "susceptibility",
        "description": "Dominant surface material.",
    },
}
