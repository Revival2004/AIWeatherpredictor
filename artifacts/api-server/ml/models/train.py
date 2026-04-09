from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

try:
    from xgboost import XGBRegressor

    HAS_XGBOOST = True
except ImportError:  # pragma: no cover - optional dependency
    HAS_XGBOOST = False
    XGBRegressor = None


MODEL_DISPLAY_NAMES = {
    "linear_regression": "LinearRegression",
    "random_forest": "RandomForest",
    "xgboost": "XGBoost",
    "weighted_ensemble": "WeightedEnsemble",
}


def _rmse(y_true: pd.Series | np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))


def _clip_prediction(values: np.ndarray) -> np.ndarray:
    return np.clip(np.asarray(values, dtype=float), 0.0, 1.0)


def _score_predictions(y_true: pd.Series | np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    clipped = _clip_prediction(y_pred)
    return {
        "rmse": _rmse(y_true, clipped),
        "mae": float(mean_absolute_error(y_true, clipped)),
        "accuracy": float(np.mean((clipped >= 0.5) == (np.asarray(y_true) >= 0.5))),
    }


def _build_candidates() -> dict[str, list[Any]]:
    candidates: dict[str, list[Any]] = {
        "linear_regression": [
            Pipeline(
                [
                    ("scaler", StandardScaler()),
                    ("model", LinearRegression()),
                ]
            )
        ],
        "random_forest": [
            RandomForestRegressor(
                n_estimators=200,
                max_depth=10,
                min_samples_leaf=3,
                random_state=42,
                n_jobs=1,
            ),
            RandomForestRegressor(
                n_estimators=300,
                max_depth=14,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=1,
            ),
        ],
    }
    if HAS_XGBOOST and XGBRegressor is not None:
        candidates["xgboost"] = [
            XGBRegressor(
                n_estimators=250,
                learning_rate=0.05,
                max_depth=4,
                subsample=0.9,
                colsample_bytree=0.9,
                reg_alpha=0.0,
                reg_lambda=1.0,
                objective="reg:squarederror",
                random_state=42,
                n_jobs=1,
                verbosity=0,
            ),
            XGBRegressor(
                n_estimators=400,
                learning_rate=0.04,
                max_depth=6,
                subsample=0.85,
                colsample_bytree=0.85,
                reg_alpha=0.1,
                reg_lambda=1.0,
                objective="reg:squarederror",
                random_state=42,
                n_jobs=1,
                verbosity=0,
            ),
        ]
    return candidates


def _cross_validate_candidate(
    estimator: Any,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    cv_folds: int,
) -> dict[str, float]:
    if cv_folds < 2 or len(X_train) < 100:
        return {"rmse": np.nan, "mae": np.nan}

    effective_folds = min(cv_folds, max(2, len(X_train) // 100))
    splitter = TimeSeriesSplit(n_splits=effective_folds)
    rmses: list[float] = []
    maes: list[float] = []

    for train_idx, valid_idx in splitter.split(X_train):
        candidate = clone(estimator)
        candidate.fit(X_train.iloc[train_idx], y_train.iloc[train_idx])
        prediction = _clip_prediction(candidate.predict(X_train.iloc[valid_idx]))
        rmses.append(_rmse(y_train.iloc[valid_idx], prediction))
        maes.append(float(mean_absolute_error(y_train.iloc[valid_idx], prediction)))

    return {
        "rmse": float(np.mean(rmses)),
        "mae": float(np.mean(maes)),
    }


def _time_based_split(
    X: pd.DataFrame,
    y: pd.Series,
    dataset: pd.DataFrame,
    test_ratio: float = 0.2,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    ordered = dataset.sort_values("created_at").reset_index(drop=True)
    split_index = max(int(len(ordered) * (1 - test_ratio)), 1)
    split_index = min(split_index, len(ordered) - 1)
    train_index = ordered.index[:split_index]
    test_index = ordered.index[split_index:]
    return X.loc[train_index], X.loc[test_index], y.loc[train_index], y.loc[test_index]


def train_model_bundle(
    *,
    X: pd.DataFrame,
    y: pd.Series,
    dataset: pd.DataFrame,
    feature_columns: list[str],
    cv_folds: int = 3,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Train and evaluate the FarmPal regressors, then build a persisted bundle."""
    if len(X) < 150:
        raise ValueError(f"Need at least 150 labelled samples to train reliably, found {len(X)}.")

    X_train, X_test, y_train, y_test = _time_based_split(X, y, dataset)

    candidates = _build_candidates()
    fitted_models: dict[str, Any] = {}
    metrics: dict[str, dict[str, float]] = {}
    cv_metrics: dict[str, dict[str, float]] = {}

    for model_name, model_candidates in candidates.items():
        best_estimator = None
        best_score = float("inf")
        best_cv = {"rmse": np.nan, "mae": np.nan}

        for estimator in model_candidates:
            candidate_cv = _cross_validate_candidate(estimator, X_train, y_train, cv_folds=cv_folds)
            candidate_score = candidate_cv["rmse"]
            if np.isnan(candidate_score):
                candidate_score = float("inf")
            if best_estimator is None or candidate_score < best_score:
                best_estimator = estimator
                best_score = candidate_score
                best_cv = candidate_cv

        if best_estimator is None:
            raise ValueError(f"No estimator candidates were available for {model_name}.")

        fitted_model = clone(best_estimator)
        fitted_model.fit(X_train, y_train)
        prediction = _clip_prediction(fitted_model.predict(X_test))
        fitted_models[model_name] = fitted_model
        metrics[model_name] = _score_predictions(y_test, prediction)
        cv_metrics[model_name] = best_cv

    weight_source = {
        name: (cv_metrics[name]["rmse"] if not np.isnan(cv_metrics[name]["rmse"]) else metrics[name]["rmse"])
        for name in fitted_models
    }
    inverse_errors = {name: 1.0 / max(value, 1e-6) for name, value in weight_source.items()}
    total_inverse_error = sum(inverse_errors.values())
    ensemble_weights = {name: score / total_inverse_error for name, score in inverse_errors.items()}

    test_predictions = {
        name: _clip_prediction(model.predict(X_test))
        for name, model in fitted_models.items()
    }
    ensemble_prediction = np.zeros(len(X_test), dtype=float)
    for model_name, model_prediction in test_predictions.items():
        ensemble_prediction += model_prediction * ensemble_weights[model_name]

    ensemble_metrics = _score_predictions(y_test, ensemble_prediction)
    metrics["weighted_ensemble"] = ensemble_metrics
    cv_metrics["weighted_ensemble"] = {
        "rmse": float(
            np.average(
                [weight_source[name] for name in fitted_models],
                weights=[ensemble_weights[name] for name in fitted_models],
            )
        ),
        "mae": float(
            np.average(
                [
                    cv_metrics[name]["mae"] if not np.isnan(cv_metrics[name]["mae"]) else metrics[name]["mae"]
                    for name in fitted_models
                ],
                weights=[ensemble_weights[name] for name in fitted_models],
            )
        ),
    }

    best_single_name = min((name for name in fitted_models), key=lambda name: metrics[name]["rmse"])
    selected_model_name = (
        "weighted_ensemble"
        if ensemble_metrics["rmse"] <= metrics[best_single_name]["rmse"]
        else best_single_name
    )

    per_model_metrics = {
        name: {
            "rmse": round(values["rmse"], 6),
            "mae": round(values["mae"], 6),
            "accuracy": round(values["accuracy"], 6),
            "cv_rmse": round(cv_metrics[name]["rmse"], 6) if not np.isnan(cv_metrics[name]["rmse"]) else None,
            "cv_mae": round(cv_metrics[name]["mae"], 6) if not np.isnan(cv_metrics[name]["mae"]) else None,
        }
        for name, values in metrics.items()
    }

    selected_metrics = metrics[selected_model_name]
    bundle = {
        "version": "v5_regression_pipeline",
        "trainedAt": datetime.now(UTC).isoformat(),
        "trainingSamples": int(len(X)),
        "featureNames": feature_columns,
        "models": fitted_models,
        "ensembleWeights": ensemble_weights,
        "selectedModel": selected_model_name,
        "selectedModelDisplay": MODEL_DISPLAY_NAMES[selected_model_name],
        "bestSingleModel": best_single_name,
        "accuracy": round(selected_metrics["accuracy"] * 100, 2),
        "rmse": round(selected_metrics["rmse"], 6),
        "mae": round(selected_metrics["mae"], 6),
        "perModel": per_model_metrics,
        "hasXGBoost": HAS_XGBOOST,
    }

    train_result = {
        "version": bundle["version"],
        "trainingSamples": bundle["trainingSamples"],
        "accuracy": bundle["accuracy"],
        "rmse": bundle["rmse"],
        "mae": bundle["mae"],
        "perModel": per_model_metrics,
        "selectedModel": selected_model_name,
        "selectedModelDisplay": bundle["selectedModelDisplay"],
        "message": (
            f"Trained {bundle['version']} on {bundle['trainingSamples']:,} samples. "
            f"Selected {bundle['selectedModelDisplay']} with RMSE {bundle['rmse']:.4f} "
            f"and MAE {bundle['mae']:.4f}."
        ),
    }
    return bundle, train_result


def save_model_bundle(bundle: dict[str, Any], model_path: str) -> None:
    joblib.dump(bundle, model_path)
