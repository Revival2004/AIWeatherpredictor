from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from models.train import MODEL_DISPLAY_NAMES


def _clip(values: np.ndarray) -> np.ndarray:
    return np.clip(np.asarray(values, dtype=float), 0.0, 1.0)


def _predict_all_models(bundle: dict[str, Any], feature_frame: pd.DataFrame) -> dict[str, np.ndarray]:
    return {
        name: _clip(model.predict(feature_frame))
        for name, model in bundle["models"].items()
    }


def _weighted_ensemble_prediction(
    predictions: dict[str, np.ndarray],
    weights: dict[str, float],
) -> np.ndarray:
    total = np.zeros(len(next(iter(predictions.values()))), dtype=float)
    for model_name, values in predictions.items():
        total += values * float(weights.get(model_name, 0.0))
    return _clip(total)


def _confidence_from_spread(spread: np.ndarray, model_rmse: float) -> np.ndarray:
    confidence = 1.0 - np.minimum(0.95, spread * 1.5 + model_rmse * 0.5)
    return np.clip(confidence, 0.05, 0.99)


def predict_with_bundle(bundle: dict[str, Any], feature_frame: pd.DataFrame) -> list[dict[str, Any]]:
    per_model_predictions = _predict_all_models(bundle, feature_frame)
    ensemble_prediction = _weighted_ensemble_prediction(per_model_predictions, bundle.get("ensembleWeights", {}))
    selected_model_key = bundle.get("selectedModel", "weighted_ensemble")

    prediction_matrix = np.vstack(list(per_model_predictions.values()) + [ensemble_prediction])
    spread = prediction_matrix.std(axis=0)

    selected_rmse = float(
        bundle.get("perModel", {}).get(selected_model_key, {}).get("rmse", bundle.get("rmse", 0.25))
    )
    confidence = _confidence_from_spread(spread, selected_rmse)

    results: list[dict[str, Any]] = []
    for index in range(len(feature_frame)):
        per_model = {name: round(float(values[index]), 6) for name, values in per_model_predictions.items()}
        final_prediction = float(
            ensemble_prediction[index]
            if selected_model_key == "weighted_ensemble"
            else per_model_predictions[selected_model_key][index]
        )
        interval_low = max(0.0, final_prediction - float(spread[index]))
        interval_high = min(1.0, final_prediction + float(spread[index]))
        results.append(
            {
                "prediction": round(final_prediction, 6),
                "probability": round(final_prediction, 6),
                "confidence": round(float(confidence[index]), 6),
                "model_used": MODEL_DISPLAY_NAMES.get(selected_model_key, selected_model_key),
                "selectedModel": selected_model_key,
                "predictionValue": "yes" if final_prediction >= 0.5 else "no",
                "willRain": final_prediction >= 0.5,
                "confidenceInterval": {
                    "low": round(interval_low, 6),
                    "high": round(interval_high, 6),
                },
                "modelAgreement": round(float(max(0.0, 1.0 - spread[index] * 2.0)), 6),
                "modelPredictions": per_model,
            }
        )
    return results
