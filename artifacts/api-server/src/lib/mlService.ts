/**
 * ML Service — thin HTTP client that delegates to the Python sklearn ensemble.
 *
 * The Python microservice (artifacts/api-server/ml/app.py) runs on port 5000
 * and implements three scikit-learn models with soft-voting:
 *   1. Logistic Regression  (Pipeline: StandardScaler + LogisticRegression)
 *   2. Random Forest        (100 trees, sqrt features, max_depth 8)
 *   3. Gradient Boosting    (100 trees, lr=0.08, max_depth 4)
 *
 * This file is the only TypeScript code that talks to that service.
 * All other modules import from here as before.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Logger } from "pino";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** JSON metadata sidecar written by the Python service after each train run. */
const META_PATH = path.join(__dirname, "../../ml_model_meta.json");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://127.0.0.1:5000";

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

// ─────────────────────────────────────────────────────────────
// Shared types (kept for compatibility with consuming routes)
// ─────────────────────────────────────────────────────────────

export interface EnsembleModel {
  version: string;
  trainedAt: string;
  trainingSamples: number;
  accuracy: number;
  lrAccuracy: number;
  rfAccuracy: number;
  gbAccuracy: number;
}

export interface MLPrediction {
  predictionValue: "yes" | "no";
  confidence: number;
  probability: number;
  modelVersion: string;
  modelProbabilities?: { lr: number; rf: number; gb: number };
}

// ─────────────────────────────────────────────────────────────
// Model metadata (read from JSON sidecar on disk)
// ─────────────────────────────────────────────────────────────

export function loadModel(): EnsembleModel | null {
  try {
    if (!fs.existsSync(META_PATH)) return null;
    return JSON.parse(fs.readFileSync(META_PATH, "utf8")) as EnsembleModel;
  } catch {
    return null;
  }
}

function saveMetadata(meta: EnsembleModel): void {
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), "utf8");
}

// ─────────────────────────────────────────────────────────────
// Training — delegates to Python /train
// ─────────────────────────────────────────────────────────────

export async function trainModel(logger?: Logger): Promise<{
  trainingSamples: number;
  accuracy: number;
  lrAccuracy: number;
  rfAccuracy: number;
  gbAccuracy: number;
  message: string;
}> {
  logger?.info("Forwarding train request to Python sklearn service");
  let res: Response;
  try {
    res = await fetch(`${ML_SERVICE_URL}/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    logger?.warn({ err }, "Python ML service unreachable — falling back to message");
    return {
      trainingSamples: 0,
      accuracy: 0,
      lrAccuracy: 0,
      rfAccuracy: 0,
      gbAccuracy: 0,
      message: "Python ML service is not reachable. Make sure the ML Service workflow is running.",
    };
  }

  const data = (await res.json()) as {
    trainingSamples: number;
    accuracy: number;
    lrAccuracy: number;
    rfAccuracy: number;
    gbAccuracy: number;
    message: string;
    trainedAt?: string;
    version?: string;
  };

  if (res.ok && data.trainingSamples >= 5 && data.accuracy > 0) {
    // Persist metadata so loadModel() works synchronously
    saveMetadata({
      version: data.version ?? "sklearn_ensemble_v1",
      trainedAt: data.trainedAt ?? new Date().toISOString(),
      trainingSamples: data.trainingSamples,
      accuracy: data.accuracy,
      lrAccuracy: data.lrAccuracy,
      rfAccuracy: data.rfAccuracy,
      gbAccuracy: data.gbAccuracy,
    });
    logger?.info(
      { accuracy: data.accuracy, lrAccuracy: data.lrAccuracy, rfAccuracy: data.rfAccuracy, gbAccuracy: data.gbAccuracy },
      "sklearn ensemble trained"
    );
  }

  return {
    trainingSamples: data.trainingSamples ?? 0,
    accuracy: data.accuracy ?? 0,
    lrAccuracy: data.lrAccuracy ?? 0,
    rfAccuracy: data.rfAccuracy ?? 0,
    gbAccuracy: data.gbAccuracy ?? 0,
    message: data.message ?? "Unknown response from Python service.",
  };
}

// ─────────────────────────────────────────────────────────────
// Prediction — delegates to Python /predict
// ─────────────────────────────────────────────────────────────

export async function predictRain(
  temperature: number,
  humidity: number,
  pressure: number,
  windspeed: number,
  weathercode: number,
  timestamp: Date = new Date(),
  lat?: number,
  lon?: number,
): Promise<MLPrediction> {
  const hour = timestamp.getHours();
  const month = timestamp.getMonth() + 1;
  const isRainingNow = RAIN_CODES.has(weathercode);

  let res: Response;
  try {
    res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        temperature,
        humidity,
        pressure,
        windspeed,
        is_raining_now: isRainingNow,
        hour,
        month,
        lat: lat ?? 0.0,
        lon: lon ?? 37.5,
      }),
    });
  } catch {
    // Python service unreachable — fall back to heuristic
    return ruleFallback(humidity, pressure, weathercode);
  }

  if (res.status === 404) {
    // No model trained yet — use heuristic
    return ruleFallback(humidity, pressure, weathercode);
  }

  if (!res.ok) {
    return ruleFallback(humidity, pressure, weathercode);
  }

  const data = (await res.json()) as {
    probability: number;
    modelProbabilities: { lr: number; rf: number; gb: number };
    version: string;
    accuracy: number;
    lrAccuracy?: number;
    rfAccuracy?: number;
    gbAccuracy?: number;
    trainingSamples?: number;
    trainedAt?: string;
    modelTrained?: boolean;
  };

  const prob = data.probability;
  const confidence = Math.round(Math.abs(prob - 0.5) * 2 * 100) / 100;

  // Keep metadata in sync if the response carries it
  if (data.trainedAt && data.trainingSamples) {
    saveMetadata({
      version: data.version ?? "sklearn_ensemble_v1",
      trainedAt: data.trainedAt,
      trainingSamples: data.trainingSamples,
      accuracy: data.accuracy,
      lrAccuracy: data.lrAccuracy ?? 0,
      rfAccuracy: data.rfAccuracy ?? 0,
      gbAccuracy: data.gbAccuracy ?? 0,
    });
  }

  return {
    predictionValue: prob >= 0.5 ? "yes" : "no",
    confidence,
    probability: Math.round(prob * 1000) / 1000,
    modelVersion: `sklearn_${data.version ?? "ensemble_v1"}_acc${data.accuracy ?? 0}`,
    modelProbabilities: data.modelProbabilities,
  };
}

// ─────────────────────────────────────────────────────────────
// Heuristic fallback (when no Python model is available)
// ─────────────────────────────────────────────────────────────

function ruleFallback(humidity: number, pressure: number, weathercode: number): MLPrediction {
  let p = 0.2;
  if (RAIN_CODES.has(weathercode)) p += 0.5;
  if (humidity > 85) p += 0.2;
  else if (humidity > 70) p += 0.1;
  if (pressure < 1000) p += 0.15;
  else if (pressure < 1010) p += 0.05;
  p = Math.min(0.95, Math.max(0.05, p));
  return {
    predictionValue: p >= 0.5 ? "yes" : "no",
    confidence: Math.round(Math.abs(p - 0.5) * 2 * 100) / 100,
    probability: Math.round(p * 1000) / 1000,
    modelVersion: "rules_heuristic",
  };
}
