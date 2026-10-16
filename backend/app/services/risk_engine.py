"""Transparent, rule-based landslide risk index.

The index follows the common hazard formulation  risk = susceptibility x trigger:

    S (susceptibility, 0-1) = weighted sum of static terrain factor scores
    T (trigger, 0-1)        = weighted sum of rainfall / soil-moisture scores
    score (0-100)           = 100 * S * (BASELINE + (1 - BASELINE) * T)

S sets the ceiling a site can reach; T decides how close to that ceiling it is
right now. Every weight and threshold below is an explicit, documented
assumption chosen for this prototype. They are NOT calibrated against a
landslide inventory and must be reviewed by domain experts before operational use.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

from .features import FEATURE_SPECS, SOIL_TYPES

METHOD_VERSION = "heuristic-v1"

DISCLAIMER = (
    "LandslideGuard AI is a decision-support prototype, not an official warning service. "
    "Always follow advisories from IMD, GSI, NDMA and your State / District Disaster "
    "Management Authority. In an emergency call 112."
)

SUSCEPTIBILITY_WEIGHTS: dict[str, float] = {
    "slope_deg": 0.45,
    "soil_type": 0.20,
    "slope_modified": 0.20,
    "vegetation_ndvi": 0.15,
}
TRIGGER_WEIGHTS: dict[str, float] = {
    "rainfall_24h_mm": 0.40,
    "rainfall_72h_mm": 0.40,
    "soil_moisture": 0.20,
}

# Fraction of susceptibility expressed even with no rainfall trigger.
BASELINE_TRIGGER = 0.25

# Slope score rises linearly from SLOPE_MIN to SLOPE_FULL degrees.
SLOPE_MIN_DEG = 5.0
SLOPE_FULL_DEG = 40.0
# Rainfall amounts at which the rainfall sub-scores saturate at 1.0.
RAIN_24H_FULL_MM = 150.0
RAIN_72H_FULL_MM = 300.0
# Soil moisture score rises linearly between these volumetric water contents.
SOIL_MOISTURE_DRY = 0.15
SOIL_MOISTURE_WET = 0.45
SOIL_SCORES: dict[str, float] = {"rock": 0.2, "sandy": 0.5, "loamy": 0.6, "clay": 0.9}

LEVELS: list[tuple[float, str]] = [(75.0, "Very High"), (50.0, "High"), (25.0, "Moderate"), (0.0, "Low")]
LEVEL_ORDER = ["Low", "Moderate", "High", "Very High"]

GUIDANCE: dict[str, str] = {
    "Low": "No specific action needed. Stay informed about local weather advisories.",
    "Moderate": (
        "Watch slopes for new cracks, tilting trees or muddy seepage. "
        "Limit non-essential travel on hill roads during heavy rain."
    ),
    "High": (
        "Be ready to move to a safer place. Keep away from steep slopes, stream channels "
        "and road cuts. Follow your District Disaster Management Authority (DDMA)."
    ),
    "Very High": (
        "Follow evacuation instructions from local authorities immediately. Move away from "
        "slopes and drainage channels. In an emergency call 112."
    ),
}

assert abs(sum(SUSCEPTIBILITY_WEIGHTS.values()) - 1.0) < 1e-9
assert abs(sum(TRIGGER_WEIGHTS.values()) - 1.0) < 1e-9


@dataclass(frozen=True)
class RiskInputs:
    rainfall_24h_mm: float
    rainfall_72h_mm: float
    soil_moisture: float
    slope_deg: float
    vegetation_ndvi: float
    soil_type: str
    slope_modified: bool

    def as_feature_dict(self) -> dict:
        d = asdict(self)
        d["slope_modified"] = int(bool(d["slope_modified"]))
        return d


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _linear(value: float, lo: float, hi: float) -> float:
    return _clamp01((value - lo) / (hi - lo))


def factor_scores(inputs: RiskInputs) -> dict[str, float]:
    """Map each raw input to a 0-1 hazard sub-score (1 = most hazardous)."""
    if inputs.soil_type not in SOIL_SCORES:
        raise ValueError(f"soil_type must be one of {SOIL_TYPES}")
    return {
        "slope_deg": _linear(inputs.slope_deg, SLOPE_MIN_DEG, SLOPE_FULL_DEG),
        "soil_type": SOIL_SCORES[inputs.soil_type],
        "slope_modified": 1.0 if inputs.slope_modified else 0.0,
        "vegetation_ndvi": _clamp01(1.0 - inputs.vegetation_ndvi),
        "rainfall_24h_mm": _linear(inputs.rainfall_24h_mm, 0.0, RAIN_24H_FULL_MM),
        "rainfall_72h_mm": _linear(inputs.rainfall_72h_mm, 0.0, RAIN_72H_FULL_MM),
        "soil_moisture": _linear(inputs.soil_moisture, SOIL_MOISTURE_DRY, SOIL_MOISTURE_WET),
    }


def level_for_score(score: float) -> str:
    for threshold, name in LEVELS:
        if score >= threshold:
            return name
    return "Low"


def compute_heuristic(inputs: RiskInputs) -> dict:
    scores = factor_scores(inputs)
    raw = inputs.as_feature_dict()

    factors = []
    for group, weights in (("susceptibility", SUSCEPTIBILITY_WEIGHTS), ("trigger", TRIGGER_WEIGHTS)):
        for name, weight in weights.items():
            spec = FEATURE_SPECS[name]
            factors.append(
                {
                    "name": name,
                    "label": spec["label"],
                    "group": group,
                    "value": raw[name],
                    "unit": spec["unit"],
                    "sub_score": round(scores[name], 4),
                    "weight": weight,
                    "weighted": round(weight * scores[name], 4),
                }
            )

    susceptibility = sum(SUSCEPTIBILITY_WEIGHTS[k] * scores[k] for k in SUSCEPTIBILITY_WEIGHTS)
    trigger = sum(TRIGGER_WEIGHTS[k] * scores[k] for k in TRIGGER_WEIGHTS)
    score = 100.0 * susceptibility * (BASELINE_TRIGGER + (1.0 - BASELINE_TRIGGER) * trigger)
    level = level_for_score(score)

    drivers = sorted(factors, key=lambda f: f["weighted"], reverse=True)[:3]
    return {
        "method": METHOD_VERSION,
        "score": round(score, 1),
        "level": level,
        "susceptibility": round(susceptibility, 4),
        "trigger": round(trigger, 4),
        "factors": factors,
        "top_drivers": [d["label"] for d in drivers if d["weighted"] > 0],
        "guidance": GUIDANCE[level],
        "formula": f"score = 100 x S x ({BASELINE_TRIGGER} + {1 - BASELINE_TRIGGER} x T)",
    }


def methodology() -> dict:
    """Machine-readable description of the heuristic, served by the API."""
    return {
        "method": METHOD_VERSION,
        "formula": f"score = 100 x S x ({BASELINE_TRIGGER} + {1 - BASELINE_TRIGGER} x T)",
        "susceptibility_weights": SUSCEPTIBILITY_WEIGHTS,
        "trigger_weights": TRIGGER_WEIGHTS,
        "baseline_trigger": BASELINE_TRIGGER,
        "thresholds": {
            "slope_deg": {"zero_at": SLOPE_MIN_DEG, "full_at": SLOPE_FULL_DEG},
            "rainfall_24h_mm": {"zero_at": 0.0, "full_at": RAIN_24H_FULL_MM},
            "rainfall_72h_mm": {"zero_at": 0.0, "full_at": RAIN_72H_FULL_MM},
            "soil_moisture": {"zero_at": SOIL_MOISTURE_DRY, "full_at": SOIL_MOISTURE_WET},
            "vegetation_ndvi": "sub_score = 1 - NDVI",
            "slope_modified": "1 if road cut / excavation nearby, else 0",
        },
        "soil_scores": SOIL_SCORES,
        "levels": [{"level": name, "min_score": t} for t, name in sorted(LEVELS)],
        "guidance": GUIDANCE,
        "calibration_status": (
            "Uncalibrated expert-style heuristic. Weights and thresholds are documented "
            "assumptions, not values fitted to an observed landslide inventory."
        ),
        "features": FEATURE_SPECS,
    }
