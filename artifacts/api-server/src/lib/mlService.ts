/**
 * ML Service — HTTP client that delegates all prediction and training
 * to the Python Flask microservice (artifacts/api-server/ml/app.py).
 *
 * This file owns the TypeScript contract for the ML boundary.
 * The Python service is the single source of truth for model files.
 *
 * Changes in v4:
 * - EnsembleModel includes auc, brierScore, perModel, rainPercent
 * - predictRain sends pressure_tendency and all 19 features
 * - saveMetadata writes full v4 schema (no partial corruption)
 * - trainModel polls /train/status instead of fire-and-forget
 * - getRainPrediction is the full-featured call used by the weather route
 */

import fs   from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Logger } from "pino";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** JSON sidecar written by Python after each /train completion. */
const META_PATH = path.join(__dirname, "../../ml_model_meta.json");

const ML_URL = process.env.ML_SERVICE_URL ?? "http://127.0.0.1:5001";

const RAIN_CODES = new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnsembleModel {
  version:         string;
  trainedAt:       string;
  trainingSamples: number;
  accuracy:        number;
  rmse?:           number;
  mae?:            number;
  auc?:            number;
  brierScore?:     number;
  rainPercent?:    number;
  // Flat fields (v3 compat)
  lrAccuracy?:     number;
  rfAccuracy?:     number;
  gbAccuracy?:     number;
  // v4 per-model breakdown
  perModel?: Record<string, { accuracy?: number; auc?: number; brier?: number; rmse?: number; mae?: number }>;
}

export interface MLPrediction {
  predictionValue:   "yes" | "no";
  confidence:        number;
  probability:       number;
  modelVersion:      string;
  modelUsed?:        string;
  confidenceInterval?: { low: number; high: number };
  modelAgreement?:     number;
  modelProbabilities?: Record<string, number>;
}

export interface TrainResult {
  trainingSamples: number;
  accuracy:        number;
  rmse?:           number;
  mae?:            number;
  auc?:            number;
  brierScore?:     number;
  lrAccuracy?:     number;
  rfAccuracy?:     number;
  gbAccuracy?:     number;
  perModel?:       Record<string, { accuracy?: number; auc?: number; rmse?: number; mae?: number }>;
  message:         string;
  version?:        string;
}

// ── Metadata helpers ──────────────────────────────────────────────────────────

export function loadModel(): EnsembleModel | null {
  try {
    if (!fs.existsSync(META_PATH)) return null;
    return JSON.parse(fs.readFileSync(META_PATH, "utf8")) as EnsembleModel;
  } catch {
    return null;
  }
}

function saveMetadata(meta: EnsembleModel): void {
  try {
    fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), "utf8");
  } catch (err) {
    console.warn("[mlService] Could not write model metadata:", err);
  }
}

function getAccuracyBreakdown(
  perModel?: Record<string, { accuracy?: number; auc?: number; brier?: number; rmse?: number; mae?: number }>,
): Pick<EnsembleModel, "lrAccuracy" | "rfAccuracy" | "gbAccuracy"> {
  return {
    lrAccuracy: perModel?.["linear_regression"]?.accuracy ?? perModel?.["lr"]?.accuracy,
    rfAccuracy: perModel?.["random_forest"]?.accuracy ?? perModel?.["rf"]?.accuracy,
    gbAccuracy: perModel?.["xgboost"]?.accuracy ?? perModel?.["gb"]?.accuracy ?? perModel?.["hgb"]?.accuracy,
  };
}

function normalizeModelProbabilities(probabilities?: Record<string, number>): Record<string, number> | undefined {
  if (!probabilities) {
    return undefined;
  }

  const normalized: Record<string, number> = {};

  for (const [key, value] of Object.entries(probabilities)) {
    if (key === "linear_regression") {
      normalized.lr = value;
      continue;
    }
    if (key === "random_forest") {
      normalized.rf = value;
      continue;
    }
    if (key === "xgboost" || key === "gradient_boosting" || key === "hist_gradient_boosting") {
      normalized.gb = value;
      continue;
    }
    if (key === "weighted_ensemble") {
      normalized.ensemble = value;
      continue;
    }
    normalized[key] = value;
  }

  return normalized;
}

// ── Training ──────────────────────────────────────────────────────────────────

/**
 * POST /train — starts async training, returns immediately.
 * Polls /train/status until done or timeout.
 */
export async function trainModel(logger?: Logger): Promise<TrainResult> {
  logger?.info("Starting ML model training...");

  try {
    const startResp = await fetch(`${ML_URL}/train`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      signal:  AbortSignal.timeout(10_000),
    });

    if (!startResp.ok && startResp.status !== 202) {
      const err = `ML service returned ${startResp.status}`;
      logger?.warn(err);
      return { trainingSamples: 0, accuracy: 0, message: err };
    }

    const startData = await startResp.json() as { status: string };
    if (startData.status === "already_running") {
      return { trainingSamples: 0, accuracy: 0, message: "Training already in progress" };
    }

    // Poll /train/status (up to 15 min)
    const deadline     = Date.now() + 15 * 60 * 1000;
    let   pollInterval = 5_000;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, pollInterval));
      pollInterval = Math.min(30_000, pollInterval + 2_000);

      try {
        const statusResp = await fetch(`${ML_URL}/train/status`, {
          signal: AbortSignal.timeout(5_000),
        });
        if (!statusResp.ok) continue;

        const status = await statusResp.json() as {
          running: boolean;
          lastResult?: {
            trainingSamples?: number;
            accuracy?: number;
            rmse?: number;
            mae?: number;
            auc?: number;
            brierScore?: number;
            perModel?: Record<string, { accuracy?: number; auc?: number; rmse?: number; mae?: number }>;
            version?: string;
            message?: string;
            error?: string;
          };
        };

        if (!status.running && status.lastResult) {
          const r = status.lastResult;
          if (r.error) {
            logger?.error({ err: r.error }, "ML training failed");
            return { trainingSamples: 0, accuracy: 0, message: r.error };
          }

          const breakdown = getAccuracyBreakdown(r.perModel);

          const result: TrainResult = {
            trainingSamples: r.trainingSamples ?? 0,
            accuracy:        r.accuracy        ?? 0,
            rmse:            r.rmse,
            mae:             r.mae,
            auc:             r.auc,
            brierScore:      r.brierScore,
            lrAccuracy:      breakdown.lrAccuracy,
            rfAccuracy:      breakdown.rfAccuracy,
            gbAccuracy:      breakdown.gbAccuracy,
            perModel:        r.perModel,
            version:         r.version,
            message:         r.message ?? "Training complete",
          };

          // Persist full metadata
          if (result.trainingSamples > 0) {
            saveMetadata({
              version:         r.version ?? "v4",
              trainedAt:       new Date().toISOString(),
              trainingSamples: result.trainingSamples,
              accuracy:        result.accuracy,
              rmse:            result.rmse,
              mae:             result.mae,
              auc:             result.auc,
              brierScore:      result.brierScore,
              lrAccuracy:      breakdown.lrAccuracy,
              rfAccuracy:      breakdown.rfAccuracy,
              gbAccuracy:      breakdown.gbAccuracy,
              perModel:        r.perModel,
            });
          }

          logger?.info(
            { accuracy: result.accuracy, auc: result.auc, samples: result.trainingSamples },
            "ML training complete"
          );
          return result;
        }
      } catch {
        // Poll error — keep trying
      }
    }

    return { trainingSamples: 0, accuracy: 0, message: "Training timed out after 15 min" };

  } catch (err) {
    const msg = "Python ML service unreachable — is the ML service running?";
    logger?.warn({ err }, msg);
    return { trainingSamples: 0, accuracy: 0, message: msg };
  }
}

// ── Prediction ────────────────────────────────────────────────────────────────

/**
 * Call /predict with all 19 features.
 * Returns full ensemble result including CI and per-model breakdown.
 */
export async function predictRain(
  temperature:      number,
  humidity:         number,
  pressure:         number,
  windspeed:        number,
  weathercode:      number,
  timestamp:        Date    = new Date(),
  lat?:             number,
  lon?:             number,
  elevation?:       number,
  pressureTendency: number  = 0,
): Promise<MLPrediction> {
  const hour         = timestamp.getHours();
  const month        = timestamp.getMonth() + 1;
  const isRainingNow = RAIN_CODES.has(weathercode);

  try {
    const resp = await fetch(`${ML_URL}/predict`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        temperature,
        humidity,
        pressure,
        windspeed,
        is_raining_now:    isRainingNow,
        pressure_tendency: pressureTendency,
        hour,
        month,
        lat:       lat       ?? 0.0,
        lon:       lon       ?? 37.5,
        elevation: elevation ?? 1000.0,
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (resp.status === 404) return ruleFallback(humidity, pressure, weathercode);
    if (!resp.ok)            return ruleFallback(humidity, pressure, weathercode);

    const data = await resp.json() as {
      probability:          number;
      model_used?:          string;
      modelUsed?:           string;
      confidenceInterval?:  { low: number; high: number };
      modelAgreement?:      number;
      modelProbabilities?:  Record<string, number>;
      version?:             string;
      accuracy?:            number;
      rmse?:                number;
      mae?:                 number;
      auc?:                 number;
      brierScore?:          number;
      perModel?:            Record<string, { accuracy?: number; auc?: number; rmse?: number; mae?: number }>;
      trainingSamples?:     number;
      trainedAt?:           string;
      modelTrained?:        boolean;
    };

    if (data.modelTrained === false) return ruleFallback(humidity, pressure, weathercode);

    const prob       = data.probability;
    const confidence = +(Math.min(0.98, 0.5 + Math.abs(prob - 0.5) * 0.96)).toFixed(2);
    const breakdown  = getAccuracyBreakdown(data.perModel);

    // Sync metadata sidecar if the response carries fresh training info
    if (data.trainedAt && data.trainingSamples && data.trainingSamples > 0) {
      saveMetadata({
        version:         data.version         ?? "v4",
        trainedAt:       data.trainedAt,
        trainingSamples: data.trainingSamples,
        accuracy:        data.accuracy        ?? 0,
        rmse:            data.rmse,
        mae:             data.mae,
        auc:             data.auc,
        brierScore:      data.brierScore,
        perModel:        data.perModel,
        lrAccuracy:      breakdown.lrAccuracy,
        rfAccuracy:      breakdown.rfAccuracy,
        gbAccuracy:      breakdown.gbAccuracy,
      });
    }

    return {
      predictionValue:    prob >= 0.5 ? "yes" : "no",
      confidence,
      probability:        +prob.toFixed(4),
      modelVersion:       `sklearn_${data.version ?? "ensemble"}`,
      modelUsed:          data.model_used ?? data.modelUsed,
      confidenceInterval: data.confidenceInterval,
      modelAgreement:     data.modelAgreement,
      modelProbabilities: normalizeModelProbabilities(data.modelProbabilities),
    };

  } catch {
    return ruleFallback(humidity, pressure, weathercode);
  }
}

// ── Heuristic fallback ────────────────────────────────────────────────────────

function ruleFallback(humidity: number, pressure: number, weathercode: number): MLPrediction {
  let p = 0.2;
  if (RAIN_CODES.has(weathercode)) p += 0.5;
  if (humidity   > 85)   p += 0.20;
  else if (humidity > 70) p += 0.10;
  if (pressure   < 1000) p += 0.15;
  else if (pressure < 1010) p += 0.05;
  p = Math.min(0.95, Math.max(0.05, p));
  return {
    predictionValue: p >= 0.5 ? "yes" : "no",
    confidence:      +(Math.abs(p - 0.5) * 2).toFixed(2),
    probability:     +p.toFixed(3),
    modelVersion:    "rules_heuristic",
  };
}
