"""Synthetic training data generator.

WARNING: data produced here is SIMULATED. It exists so the training pipeline can
run end-to-end without a real landslide inventory. A model trained on it learns
the hand-written generating process below, not real-world landslide behaviour,
and its evaluation metrics say nothing about real predictive skill.

Generating process (all parameters are assumptions, fixed by GENERATOR_VERSION):

    slope_deg        ~ clip(Normal(24, 11), 0, 65)
    soil_type        ~ Categorical(rock .20, sandy .20, loamy .35, clay .25)
    vegetation_ndvi  ~ clip(Beta(4, 2.2), 0.05, 0.95)
    slope_modified   ~ Bernoulli(0.30)
    rainfall_72h_mm  ~ clip(Gamma(shape=1.2, scale=80), 0, 1200)
    rainfall_24h_mm  = rainfall_72h_mm * Beta(2, 3)
    soil_moisture    = clip(0.12 + 0.30 * (1 - exp(-rain72 / 150)) + Normal(0, 0.04), 0.05, 0.55)

    steep = sigmoid((slope_deg - 22) / 5)
    z = -6.5 + 3.0*steep + 0.018*rain24 + 0.006*rain72 + 4.0*(soil_moisture - 0.25)
        + soil_effect[soil_type] - 1.5*(ndvi - 0.5) + 0.9*slope_modified
        + 0.01*steep*rain24 + Normal(0, 0.5)
    soil_effect = {rock: -0.8, sandy: 0.0, loamy: 0.2, clay: 0.6}
    landslide ~ Bernoulli(sigmoid(z))
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.services.features import FEATURE_COLUMNS, LABEL_COLUMN, SOIL_TYPES

GENERATOR_VERSION = "synthetic-v1"

_SOIL_PROBS = [0.20, 0.20, 0.35, 0.25]
_SOIL_EFFECT = {"rock": -0.8, "sandy": 0.0, "loamy": 0.2, "clay": 0.6}


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def generate_synthetic_dataset(n_samples: int = 6000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    slope = np.clip(rng.normal(24, 11, n_samples), 0, 65)
    soil = rng.choice(np.array(SOIL_TYPES), size=n_samples, p=_SOIL_PROBS)
    ndvi = np.clip(rng.beta(4, 2.2, n_samples), 0.05, 0.95)
    modified = rng.binomial(1, 0.30, n_samples)
    rain72 = np.clip(rng.gamma(1.2, 80, n_samples), 0, 1200)
    rain24 = rain72 * rng.beta(2, 3, n_samples)
    moisture = np.clip(0.12 + 0.30 * (1 - np.exp(-rain72 / 150)) + rng.normal(0, 0.04, n_samples), 0.05, 0.55)

    steep = _sigmoid((slope - 22) / 5)
    soil_effect = np.vectorize(_SOIL_EFFECT.get)(soil)
    z = (
        -6.5
        + 3.0 * steep
        + 0.018 * rain24
        + 0.006 * rain72
        + 4.0 * (moisture - 0.25)
        + soil_effect
        - 1.5 * (ndvi - 0.5)
        + 0.9 * modified
        + 0.01 * steep * rain24
        + rng.normal(0, 0.5, n_samples)
    )
    label = rng.binomial(1, _sigmoid(z))

    df = pd.DataFrame(
        {
            "rainfall_24h_mm": rain24.round(1),
            "rainfall_72h_mm": rain72.round(1),
            "soil_moisture": moisture.round(3),
            "slope_deg": slope.round(1),
            "vegetation_ndvi": ndvi.round(3),
            "slope_modified": modified.astype(int),
            "soil_type": soil,
            LABEL_COLUMN: label.astype(int),
        }
    )
    return df[FEATURE_COLUMNS + [LABEL_COLUMN]]
