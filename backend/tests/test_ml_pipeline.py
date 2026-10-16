import json

import joblib
import pandas as pd
import pytest
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

from app.services.features import FEATURE_COLUMNS, LABEL_COLUMN
from app.services.ml_model import MLModelService
from app.services.risk_engine import RiskInputs
from ml.synthetic import generate_synthetic_dataset
from ml.train import DatasetError, train, validate_dataset

INPUTS = RiskInputs(rainfall_24h_mm=120, rainfall_72h_mm=260, soil_moisture=0.42, slope_deg=35,
                    vegetation_ndvi=0.4, soil_type="clay", slope_modified=True)


def test_synthetic_generator_is_reproducible():
    a = generate_synthetic_dataset(500, seed=3)
    b = generate_synthetic_dataset(500, seed=3)
    c = generate_synthetic_dataset(500, seed=4)
    pd.testing.assert_frame_equal(a, b)
    assert not a.equals(c)
    assert list(a.columns) == FEATURE_COLUMNS + [LABEL_COLUMN]
    assert set(a[LABEL_COLUMN].unique()) <= {0, 1}
    assert (a["rainfall_24h_mm"] <= a["rainfall_72h_mm"]).all()


@pytest.mark.parametrize("mutate,message", [
    (lambda d: d.drop(columns=["slope_deg"]), "Missing required columns"),
    (lambda d: d.assign(soil_type="lava"), "Unknown soil_type"),
    (lambda d: d.assign(slope_deg=95.0), "outside"),
    (lambda d: d.assign(landslide=0), "each class"),
    (lambda d: d.head(20), "at least"),
])
def test_validate_dataset_rejects_bad_input(mutate, message):
    df = generate_synthetic_dataset(400, seed=1)
    with pytest.raises(DatasetError, match=message):
        validate_dataset(mutate(df))


def test_training_writes_artifacts_with_computed_metrics(tmp_path):
    df = generate_synthetic_dataset(1000, seed=11)
    card = train(df, is_synthetic=True, source_detail="test", seed=11, cv_folds=3, out_dir=tmp_path)

    assert (tmp_path / "model.joblib").exists()
    assert (tmp_path / "training_data.csv").exists()
    saved = json.loads((tmp_path / "model_card.json").read_text(encoding="utf-8"))
    assert saved["test_metrics"] == card["test_metrics"]
    assert saved["is_synthetic"] is True
    assert "SYNTHETIC" in saved["warning"]
    assert saved["data"]["source"] == "synthetic"
    assert set(saved["candidates"]) == {"logistic_regression", "random_forest", "gradient_boosting"}

    # The reported ROC-AUC must be reproducible from the saved model and the same split.
    clean = validate_dataset(df)
    _, X_test, _, y_test = train_test_split(
        clean[FEATURE_COLUMNS], clean[LABEL_COLUMN], test_size=0.2, stratify=clean[LABEL_COLUMN], random_state=11
    )
    model = joblib.load(tmp_path / "model.joblib")
    recomputed = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
    assert recomputed == pytest.approx(card["test_metrics"]["roc_auc"], abs=1e-4)


def test_training_is_deterministic(tmp_path):
    df = generate_synthetic_dataset(800, seed=5)
    a = train(df, is_synthetic=True, source_detail="t", seed=5, cv_folds=3, out_dir=tmp_path / "a")
    b = train(df, is_synthetic=True, source_detail="t", seed=5, cv_folds=3, out_dir=tmp_path / "b")
    assert a["test_metrics"] == b["test_metrics"]
    assert a["candidates"] == b["candidates"]
    assert a["data"]["sha256"] == b["data"]["sha256"]


def test_user_supplied_data_is_labelled_as_such(tmp_path):
    df = generate_synthetic_dataset(600, seed=9)
    card = train(df, is_synthetic=False, source_detail="inventory.csv", seed=9, cv_folds=3, out_dir=tmp_path)
    assert card["is_synthetic"] is False
    assert card["data"]["source"] == "user-supplied"
    assert "SYNTHETIC" not in card["warning"]


def test_model_service_without_artifacts(tmp_path):
    svc = MLModelService(tmp_path / "missing")
    assert svc.status()["available"] is False
    result = svc.predict(INPUTS)
    assert result["available"] is False
    assert "ml.train" in result["message"]


def test_model_service_predicts_with_explanations(model_dir):
    result = MLModelService(model_dir).predict(INPUTS)
    assert result["available"] is True
    assert 0.0 <= result["probability"] <= 1.0
    assert result["is_synthetic"] is True
    assert {c["feature"] for c in result["contributions"]} == set(FEATURE_COLUMNS)
