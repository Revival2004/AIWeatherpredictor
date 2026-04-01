/**
 * ML Service — implements a logistic regression classifier for short-term
 * rain prediction, trained on historical weather observations stored in
 * PostgreSQL. The model learns thresholds from data rather than using
 * hard-coded rules.
 *
 * Model lifecycle:
 *   1. On startup, load saved weights from ml_model.json (if it exists)
 *   2. /api/train triggers retraining from all historical data
 *   3. Weights are saved back to ml_model.json
 *   4. All predictions use the trained weights (fall back to rules if untrained)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, weatherDataTable } from "@workspace/db";
import { asc, sql, gt } from "drizzle-orm";
import type { Logger } from "pino";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = path.join(__dirname, "../../ml_model.json");

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

export interface MLModelWeights {
  weights: number[];   // [temperature, humidity, pressure, windspeed, weathercode_rain, hour_sin, hour_cos, month_sin, month_cos]
  bias: number;
  featureMeans: number[];
  featureStds: number[];
  trainedAt: string;
  trainingSamples: number;
  accuracy: number;
  version: "logistic_regression_v1";
}

export interface MLPrediction {
  predictionValue: "yes" | "no";
  confidence: number;
  probability: number;
  modelVersion: string;
}

let cachedModel: MLModelWeights | null = null;

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function normalize(values: number[], means: number[], stds: number[]): number[] {
  return values.map((v, i) => (stds[i] > 0 ? (v - means[i]) / stds[i] : 0));
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[], m: number): number {
  if (arr.length < 2) return 1;
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance) || 1;
}

function extractFeatures(
  temperature: number,
  humidity: number,
  pressure: number,
  windspeed: number,
  weathercode: number,
  timestamp: Date
): number[] {
  const hour = timestamp.getUTCHours();
  const month = timestamp.getUTCMonth() + 1;
  const isRainyNow = RAIN_CODES.has(weathercode) ? 1 : 0;
  const hourRad = (2 * Math.PI * hour) / 24;
  const monthRad = (2 * Math.PI * month) / 12;
  return [
    temperature,
    humidity,
    pressure,
    windspeed,
    isRainyNow,
    Math.sin(hourRad),
    Math.cos(hourRad),
    Math.sin(monthRad),
    Math.cos(monthRad),
  ];
}

export function loadModel(): MLModelWeights | null {
  if (cachedModel) return cachedModel;
  try {
    if (fs.existsSync(MODEL_PATH)) {
      const raw = fs.readFileSync(MODEL_PATH, "utf8");
      cachedModel = JSON.parse(raw) as MLModelWeights;
      return cachedModel;
    }
  } catch {
    // model file corrupt or missing
  }
  return null;
}

function saveModel(model: MLModelWeights): void {
  try {
    fs.writeFileSync(MODEL_PATH, JSON.stringify(model, null, 2), "utf8");
    cachedModel = model;
  } catch {
    // non-fatal
  }
}

export async function trainModel(logger?: Logger): Promise<{
  trainingSamples: number;
  accuracy: number;
  message: string;
}> {
  // Fetch all historical records ordered by time
  const records = await db
    .select({
      temperature: weatherDataTable.temperature,
      humidity: weatherDataTable.humidity,
      pressure: weatherDataTable.pressure,
      windspeed: weatherDataTable.windspeed,
      weathercode: weatherDataTable.weathercode,
      createdAt: weatherDataTable.createdAt,
    })
    .from(weatherDataTable)
    .orderBy(asc(weatherDataTable.createdAt));

  if (records.length < 10) {
    return {
      trainingSamples: records.length,
      accuracy: 0,
      message: `Insufficient training data (${records.length} records). Need at least 10. Keep collecting weather to enable training.`,
    };
  }

  // Build training examples: for each record, look 2 hours ahead
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const X: number[][] = [];
  const y: number[] = [];

  for (let i = 0; i < records.length - 1; i++) {
    const current = records[i];
    const tCurrent = new Date(current.createdAt).getTime();

    // Find the first observation that's ~2h ahead (within a 3h window)
    let futureRecord = null;
    for (let j = i + 1; j < records.length; j++) {
      const dt = new Date(records[j].createdAt).getTime() - tCurrent;
      if (dt >= 1 * 60 * 60 * 1000 && dt <= 4 * 60 * 60 * 1000) {
        futureRecord = records[j];
        break;
      }
    }

    if (!futureRecord) continue;

    const features = extractFeatures(
      current.temperature,
      current.humidity,
      current.pressure,
      current.windspeed,
      current.weathercode,
      new Date(current.createdAt)
    );
    const willRain = RAIN_CODES.has(futureRecord.weathercode) ? 1 : 0;

    X.push(features);
    y.push(willRain);
  }

  if (X.length < 5) {
    return {
      trainingSamples: X.length,
      accuracy: 0,
      message: `Not enough labeled pairs (${X.length}). Keep collecting weather data over multiple hours.`,
    };
  }

  const nFeatures = X[0].length;

  // Compute feature means and stds for normalization
  const featureMeans = Array.from({ length: nFeatures }, (_, j) => mean(X.map((row) => row[j])));
  const featureStds = Array.from({ length: nFeatures }, (_, j) =>
    std(X.map((row) => row[j]), featureMeans[j])
  );

  // Normalize X
  const XNorm = X.map((row) => normalize(row, featureMeans, featureStds));

  // Logistic regression via gradient descent
  let weights = new Array(nFeatures).fill(0);
  let bias = 0;
  const learningRate = 0.1;
  const epochs = 500;
  const n = XNorm.length;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const dw = new Array(nFeatures).fill(0);
    let db = 0;

    for (let i = 0; i < n; i++) {
      const yHat = sigmoid(bias + XNorm[i].reduce((sum, f, j) => sum + f * weights[j], 0));
      const error = yHat - y[i];
      for (let j = 0; j < nFeatures; j++) {
        dw[j] += error * XNorm[i][j];
      }
      db += error;
    }

    for (let j = 0; j < nFeatures; j++) {
      weights[j] -= (learningRate / n) * dw[j];
    }
    bias -= (learningRate / n) * db;
  }

  // Evaluate accuracy on training set
  let correct = 0;
  for (let i = 0; i < n; i++) {
    const prob = sigmoid(bias + XNorm[i].reduce((sum, f, j) => sum + f * weights[j], 0));
    const predicted = prob >= 0.5 ? 1 : 0;
    if (predicted === y[i]) correct++;
  }
  const accuracy = Math.round((correct / n) * 1000) / 10;

  const model: MLModelWeights = {
    weights,
    bias,
    featureMeans,
    featureStds,
    trainedAt: new Date().toISOString(),
    trainingSamples: n,
    accuracy,
    version: "logistic_regression_v1",
  };

  saveModel(model);
  logger?.info({ trainingSamples: n, accuracy }, "ML model trained and saved");

  return {
    trainingSamples: n,
    accuracy,
    message: `Model trained on ${n} labeled examples. Training accuracy: ${accuracy}%`,
  };
}

export function predictRain(
  temperature: number,
  humidity: number,
  pressure: number,
  windspeed: number,
  weathercode: number,
  timestamp: Date = new Date()
): MLPrediction {
  const model = loadModel();

  if (!model) {
    // Fall back to rule-based heuristic if no model trained yet
    const ruleProb = computeRuleBasedRainProb(temperature, humidity, pressure, windspeed, weathercode);
    return {
      predictionValue: ruleProb >= 0.5 ? "yes" : "no",
      confidence: Math.abs(ruleProb - 0.5) * 2,
      probability: ruleProb,
      modelVersion: "rules_heuristic",
    };
  }

  const features = extractFeatures(temperature, humidity, pressure, windspeed, weathercode, timestamp);
  const normalized = normalize(features, model.featureMeans, model.featureStds);
  const z = model.bias + normalized.reduce((sum, f, j) => sum + f * model.weights[j], 0);
  const probability = sigmoid(z);

  return {
    predictionValue: probability >= 0.5 ? "yes" : "no",
    confidence: Math.round(Math.abs(probability - 0.5) * 2 * 100) / 100,
    probability: Math.round(probability * 1000) / 1000,
    modelVersion: `logistic_regression_v1_acc${model.accuracy}`,
  };
}

function computeRuleBasedRainProb(
  temperature: number,
  humidity: number,
  pressure: number,
  windspeed: number,
  weathercode: number
): number {
  let prob = 0.2; // base prior

  if (RAIN_CODES.has(weathercode)) prob += 0.5;
  if (humidity > 85) prob += 0.2;
  else if (humidity > 70) prob += 0.1;
  if (pressure < 1000) prob += 0.15;
  else if (pressure < 1010) prob += 0.05;
  if (windspeed > 20) prob += 0.05;

  return Math.min(0.95, Math.max(0.05, prob));
}
