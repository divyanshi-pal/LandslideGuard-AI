"""Loads the trained model (if any) and produces explained probabilities."""

from __future__ import annotations

import json
import threading
from pathlib import Path

import joblib
import pandas as pd

from .features import FEATURE_COLUMNS, FEATURE_SPECS
from .risk_engine import RiskInputs

MODEL_FILENAME = "model.joblib"
CARD_FILENAME = "model_card.json"
NOT_TRAINED_MESSAGE = (
    "No trained model found. Run `python -m ml.train` in the backend folder to train one."
)
EXPLANATION_METHOD = (
    "Occlusion: change in predicted probability when the feature is replaced by its "
    "training-set median (most common value for soil type). Positive = pushes risk up."
)


class MLModelService:
    """Lazily loads ml/artifacts and reloads automatically when they are retrained."""

    def __init__(self, model_dir: Path):
        self.model_dir = Path(model_dir)
        self._lock = threading.Lock()
        self._model = None
        self._card: dict | None = None
        self._loaded_mtime: float | None = None
        self._error: str | None = None

    @property
    def _model_path(self) -> Path:
        return self.model_dir / MODEL_FILENAME

    @property
    def _card_path(self) -> Path:
        return self.model_dir / CARD_FILENAME

    def _ensure_loaded(self) -> bool:
        if not (self._model_path.exists() and self._card_path.exists()):
            self._model, self._card, self._loaded_mtime = None, None, None
            return False
        mtime = max(self._model_path.stat().st_mtime, self._card_path.stat().st_mtime)
        if self._model is not None and mtime == self._loaded_mtime:
            return True
        with self._lock:
            try:
                self._model = joblib.load(self._model_path)
                self._card = json.loads(self._card_path.read_text(encoding="utf-8"))
                self._loaded_mtime = mtime
                self._error = None
            except Exception as exc:  # corrupt / incompatible artifact
                self._model, self._card = None, None
                self._error = f"Failed to load model artifacts: {exc}"
                return False
        return True

    def status(self) -> dict:
        if not self._ensure_loaded():
            return {"available": False, "message": self._error or NOT_TRAINED_MESSAGE, "card": None}
        return {"available": True, "message": None, "card": self._card}

    def predict(self, inputs: RiskInputs) -> dict:
        if not self._ensure_loaded():
            return {"available": False, "message": self._error or NOT_TRAINED_MESSAGE}

        card = self._card
        ref = card["reference_values"]
        base = inputs.as_feature_dict()
        # Row 0 = actual inputs, row i = inputs with feature i replaced by its reference value.
        rows = [base] + [{**base, col: ref[col]} for col in FEATURE_COLUMNS]
        X = pd.DataFrame(rows)[FEATURE_COLUMNS]
        proba = self._model.predict_proba(X)[:, 1]
        p = float(proba[0])

        contributions = sorted(
            (
                {
                    "feature": col,
                    "label": FEATURE_SPECS[col]["label"],
                    "value": base[col],
                    "reference": ref[col],
                    "delta": round(p - float(proba[i + 1]), 4),
                }
                for i, col in enumerate(FEATURE_COLUMNS)
            ),
            key=lambda c: abs(c["delta"]),
            reverse=True,
        )
        return {
            "available": True,
            "probability": round(p, 4),
            "model_name": card["model_name"],
            "trained_at": card["trained_at"],
            "is_synthetic": card["is_synthetic"],
            "data_source": card["data"]["source"],
            "warning": card["warning"],
            "contributions": contributions,
            "explanation_method": EXPLANATION_METHOD,
        }
