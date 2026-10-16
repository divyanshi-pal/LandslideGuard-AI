import pytest

from app.services.risk_engine import (
    SUSCEPTIBILITY_WEIGHTS,
    TRIGGER_WEIGHTS,
    RiskInputs,
    compute_heuristic,
    level_for_score,
)


def make(**overrides) -> RiskInputs:
    base = dict(
        rainfall_24h_mm=60.0, rainfall_72h_mm=150.0, soil_moisture=0.30, slope_deg=28.0,
        vegetation_ndvi=0.6, soil_type="loamy", slope_modified=True,
    )
    return RiskInputs(**{**base, **overrides})


def test_weights_sum_to_one():
    assert sum(SUSCEPTIBILITY_WEIGHTS.values()) == pytest.approx(1.0)
    assert sum(TRIGGER_WEIGHTS.values()) == pytest.approx(1.0)


@pytest.mark.parametrize(
    "score,level",
    [(0, "Low"), (24.9, "Low"), (25, "Moderate"), (49.9, "Moderate"), (50, "High"), (75, "Very High"), (100, "Very High")],
)
def test_level_thresholds(score, level):
    assert level_for_score(score) == level


def test_worst_case_is_very_high_and_bounded():
    r = compute_heuristic(make(rainfall_24h_mm=600, rainfall_72h_mm=1500, soil_moisture=0.6,
                               slope_deg=70, vegetation_ndvi=0.0, soil_type="clay"))
    # Every sub-score is 1 except clay (0.9), so S = 0.45 + 0.2*0.9 + 0.2 + 0.15 = 0.98 and T = 1.
    assert r["score"] == pytest.approx(98.0)
    assert r["trigger"] == pytest.approx(1.0)
    assert r["level"] == "Very High"


def test_flat_terrain_stays_low_even_in_extreme_rain():
    r = compute_heuristic(make(rainfall_24h_mm=600, rainfall_72h_mm=1500, soil_moisture=0.6,
                               slope_deg=0, vegetation_ndvi=0.9, soil_type="rock", slope_modified=False))
    assert r["level"] == "Low"
    assert 0 <= r["score"] < 10


def test_dry_conditions_reduce_risk_on_same_slope():
    wet = compute_heuristic(make(rainfall_24h_mm=200, rainfall_72h_mm=400, soil_moisture=0.5))
    dry = compute_heuristic(make(rainfall_24h_mm=0, rainfall_72h_mm=0, soil_moisture=0.1))
    assert wet["score"] > dry["score"]
    assert dry["trigger"] == 0


@pytest.mark.parametrize("field,values", [
    ("rainfall_24h_mm", [0, 50, 100, 200, 400]),
    ("rainfall_72h_mm", [0, 100, 250, 500]),
    ("soil_moisture", [0.05, 0.2, 0.35, 0.55]),
    ("slope_deg", [0, 10, 25, 40, 60]),
])
def test_score_is_monotonic_in_hazard_factors(field, values):
    scores = [compute_heuristic(make(**{field: v}))["score"] for v in values]
    assert scores == sorted(scores)


def test_more_vegetation_lowers_score():
    assert compute_heuristic(make(vegetation_ndvi=0.9))["score"] < compute_heuristic(make(vegetation_ndvi=0.1))["score"]


def test_breakdown_is_consistent_with_totals():
    r = compute_heuristic(make())
    s = sum(f["weighted"] for f in r["factors"] if f["group"] == "susceptibility")
    t = sum(f["weighted"] for f in r["factors"] if f["group"] == "trigger")
    assert s == pytest.approx(r["susceptibility"], abs=1e-3)
    assert t == pytest.approx(r["trigger"], abs=1e-3)
    assert r["score"] == pytest.approx(100 * s * (0.25 + 0.75 * t), abs=0.1)
    assert len(r["factors"]) == 7
    assert r["guidance"]


def test_invalid_soil_type_rejected():
    with pytest.raises(ValueError):
        compute_heuristic(make(soil_type="lava"))
