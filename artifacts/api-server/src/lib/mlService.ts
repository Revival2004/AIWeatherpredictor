/**
 * ML Service — Multi-model ensemble for rain prediction.
 *
 * Three independent models are trained on the same historical data:
 *   1. Logistic Regression   — linear boundary, fast, interpretable
 *   2. Random Forest         — bagged decision trees, handles non-linearity
 *   3. Gradient Boosting     — sequential trees on residuals, often highest accuracy
 *
 * Final prediction uses SOFT VOTING: average the probability from each model.
 * This reduces variance and usually outperforms any single model.
 *
 * All models are implemented from scratch in TypeScript so the system has
 * zero external ML dependencies and trains entirely inside Node.js.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, weatherDataTable } from "@workspace/db";
import { asc } from "drizzle-orm";
import type { Logger } from "pino";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = path.join(__dirname, "../../ml_model.json");

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

// ─────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────

interface TreeNode {
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  value?: number; // leaf value
}

interface LRModel {
  weights: number[];
  bias: number;
  featureMeans: number[];
  featureStds: number[];
}

interface RFModel {
  trees: TreeNode[];
  featureMeans: number[];
  featureStds: number[];
}

interface GBModel {
  trees: TreeNode[];
  initialPrediction: number; // log-odds of base rate
  learningRate: number;
  featureMeans: number[];
  featureStds: number[];
}

export interface EnsembleModel {
  lr: LRModel;
  rf: RFModel;
  gb: GBModel;
  trainedAt: string;
  trainingSamples: number;
  accuracy: number; // ensemble accuracy on training set
  lrAccuracy: number;
  rfAccuracy: number;
  gbAccuracy: number;
  version: "ensemble_v1";
}

export interface MLPrediction {
  predictionValue: "yes" | "no";
  confidence: number;
  probability: number;
  modelVersion: string;
  modelProbabilities?: { lr: number; rf: number; gb: number };
}

// ─────────────────────────────────────────────────────────────
// Math helpers
// ─────────────────────────────────────────────────────────────

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-Math.max(-50, Math.min(50, z))));
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[], m: number): number {
  if (arr.length < 2) return 1;
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
  return Math.sqrt(v) || 1;
}

function normalize(values: number[], means: number[], stds: number[]): number[] {
  return values.map((v, i) => (stds[i] > 0 ? (v - means[i]) / stds[i] : 0));
}

function computeStats(X: number[][]): { featureMeans: number[]; featureStds: number[] } {
  const nFeatures = X[0].length;
  const featureMeans = Array.from({ length: nFeatures }, (_, j) => mean(X.map((r) => r[j])));
  const featureStds = Array.from({ length: nFeatures }, (_, j) =>
    stddev(X.map((r) => r[j]), featureMeans[j])
  );
  return { featureMeans, featureStds };
}

/** Bootstrap sample with replacement */
function bootstrap<T>(arr: T[]): T[] {
  return Array.from({ length: arr.length }, () => arr[Math.floor(Math.random() * arr.length)]);
}

/** Fisher-Yates shuffle, returns indices */
function shuffleIndices(n: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

function computeAccuracy(probs: number[], y: number[]): number {
  let correct = 0;
  for (let i = 0; i < probs.length; i++) {
    if ((probs[i] >= 0.5 ? 1 : 0) === y[i]) correct++;
  }
  return Math.round((correct / y.length) * 1000) / 10;
}

// ─────────────────────────────────────────────────────────────
// Decision tree (shared by RF and GB)
// ─────────────────────────────────────────────────────────────

function giniImpurity(leftY: number[], rightY: number[]): number {
  const n = leftY.length + rightY.length;
  const giniGroup = (g: number[]) => {
    if (g.length === 0) return 0;
    const p = g.reduce((s, v) => s + v, 0) / g.length;
    return 1 - p * p - (1 - p) * (1 - p);
  };
  return (leftY.length / n) * giniGroup(leftY) + (rightY.length / n) * giniGroup(rightY);
}

function buildClassificationTree(
  X: number[][],
  y: number[],
  depth: number,
  maxDepth: number,
  maxFeatures: number,
  minSamples: number
): TreeNode {
  const n = X.length;
  const leafValue = mean(y);

  if (depth >= maxDepth || n < minSamples || new Set(y).size === 1) {
    return { value: leafValue };
  }

  // Random feature subset (key to RF diversity)
  const featureIndices = shuffleIndices(X[0].length).slice(0, maxFeatures);

  let bestGini = Infinity;
  let bestFi = -1;
  let bestThreshold = 0;

  for (const fi of featureIndices) {
    const colValues = X.map((r) => r[fi]);
    const sorted = [...new Set(colValues)].sort((a, b) => a - b);

    for (let k = 0; k < sorted.length - 1; k++) {
      const threshold = (sorted[k] + sorted[k + 1]) / 2;
      const leftY: number[] = [];
      const rightY: number[] = [];
      for (let i = 0; i < n; i++) {
        (X[i][fi] <= threshold ? leftY : rightY).push(y[i]);
      }
      if (leftY.length < 2 || rightY.length < 2) continue;
      const g = giniImpurity(leftY, rightY);
      if (g < bestGini) {
        bestGini = g;
        bestFi = fi;
        bestThreshold = threshold;
      }
    }
  }

  if (bestFi === -1) return { value: leafValue };

  const leftX: number[][] = [];
  const leftY: number[] = [];
  const rightX: number[][] = [];
  const rightY: number[] = [];
  for (let i = 0; i < n; i++) {
    if (X[i][bestFi] <= bestThreshold) {
      leftX.push(X[i]);
      leftY.push(y[i]);
    } else {
      rightX.push(X[i]);
      rightY.push(y[i]);
    }
  }

  return {
    featureIndex: bestFi,
    threshold: bestThreshold,
    left: buildClassificationTree(leftX, leftY, depth + 1, maxDepth, maxFeatures, minSamples),
    right: buildClassificationTree(rightX, rightY, depth + 1, maxDepth, maxFeatures, minSamples),
  };
}

/** Regression tree for gradient boosting (predicts real-valued residuals) */
function buildRegressionTree(
  X: number[][],
  residuals: number[],
  depth: number,
  maxDepth: number,
  minSamples: number
): TreeNode {
  const n = X.length;
  const leafValue = mean(residuals);

  if (depth >= maxDepth || n < minSamples) {
    return { value: leafValue };
  }

  let bestMSE = Infinity;
  let bestFi = -1;
  let bestThreshold = 0;
  const nFeatures = X[0].length;

  for (let fi = 0; fi < nFeatures; fi++) {
    const sorted = [...new Set(X.map((r) => r[fi]))].sort((a, b) => a - b);
    for (let k = 0; k < sorted.length - 1; k++) {
      const threshold = (sorted[k] + sorted[k + 1]) / 2;
      const leftR: number[] = [];
      const rightR: number[] = [];
      for (let i = 0; i < n; i++) {
        (X[i][fi] <= threshold ? leftR : rightR).push(residuals[i]);
      }
      if (leftR.length < 2 || rightR.length < 2) continue;
      const mLeft = mean(leftR);
      const mRight = mean(rightR);
      const mse =
        leftR.reduce((s, v) => s + (v - mLeft) ** 2, 0) +
        rightR.reduce((s, v) => s + (v - mRight) ** 2, 0);
      if (mse < bestMSE) {
        bestMSE = mse;
        bestFi = fi;
        bestThreshold = threshold;
      }
    }
  }

  if (bestFi === -1) return { value: leafValue };

  const leftX: number[][] = [];
  const leftR: number[] = [];
  const rightX: number[][] = [];
  const rightR: number[] = [];
  for (let i = 0; i < n; i++) {
    if (X[i][bestFi] <= bestThreshold) {
      leftX.push(X[i]);
      leftR.push(residuals[i]);
    } else {
      rightX.push(X[i]);
      rightR.push(residuals[i]);
    }
  }

  return {
    featureIndex: bestFi,
    threshold: bestThreshold,
    left: buildRegressionTree(leftX, leftR, depth + 1, maxDepth, minSamples),
    right: buildRegressionTree(rightX, rightR, depth + 1, maxDepth, minSamples),
  };
}

function predictTree(node: TreeNode, x: number[]): number {
  if (node.value !== undefined) return node.value;
  const go = x[node.featureIndex!] <= node.threshold! ? node.left! : node.right!;
  return predictTree(go, x);
}

// ─────────────────────────────────────────────────────────────
// Model 1: Logistic Regression
// ─────────────────────────────────────────────────────────────

function trainLR(XNorm: number[][], y: number[]): Pick<LRModel, "weights" | "bias"> {
  const nFeatures = XNorm[0].length;
  const n = XNorm.length;
  let weights = new Array(nFeatures).fill(0);
  let bias = 0;
  const lr = 0.1;
  const epochs = 600;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const dw = new Array(nFeatures).fill(0);
    let db = 0;
    for (let i = 0; i < n; i++) {
      const yHat = sigmoid(bias + XNorm[i].reduce((s, f, j) => s + f * weights[j], 0));
      const err = yHat - y[i];
      for (let j = 0; j < nFeatures; j++) dw[j] += err * XNorm[i][j];
      db += err;
    }
    for (let j = 0; j < nFeatures; j++) weights[j] -= (lr / n) * dw[j];
    bias -= (lr / n) * db;
  }
  return { weights, bias };
}

function predictLR(model: LRModel, xRaw: number[]): number {
  const x = normalize(xRaw, model.featureMeans, model.featureStds);
  return sigmoid(model.bias + x.reduce((s, f, j) => s + f * model.weights[j], 0));
}

// ─────────────────────────────────────────────────────────────
// Model 2: Random Forest
// ─────────────────────────────────────────────────────────────

const RF_N_TREES = 30;
const RF_MAX_DEPTH = 5;
const RF_MIN_SAMPLES = 3;

function trainRF(XNorm: number[][], y: number[]): Pick<RFModel, "trees"> {
  const nFeatures = XNorm[0].length;
  const maxFeatures = Math.max(2, Math.round(Math.sqrt(nFeatures)));
  const paired = XNorm.map((x, i) => ({ x, y: y[i] }));

  const trees: TreeNode[] = [];
  for (let t = 0; t < RF_N_TREES; t++) {
    const bag = bootstrap(paired);
    const X = bag.map((d) => d.x);
    const Y = bag.map((d) => d.y);
    trees.push(buildClassificationTree(X, Y, 0, RF_MAX_DEPTH, maxFeatures, RF_MIN_SAMPLES));
  }
  return { trees };
}

function predictRF(model: RFModel, xRaw: number[]): number {
  const x = normalize(xRaw, model.featureMeans, model.featureStds);
  const probs = model.trees.map((t) => predictTree(t, x));
  return mean(probs);
}

// ─────────────────────────────────────────────────────────────
// Model 3: Gradient Boosting
// ─────────────────────────────────────────────────────────────

const GB_N_TREES = 60;
const GB_MAX_DEPTH = 4;
const GB_LEARNING_RATE = 0.08;
const GB_MIN_SAMPLES = 3;

function trainGB(XNorm: number[][], y: number[]): Pick<GBModel, "trees" | "initialPrediction" | "learningRate"> {
  const n = XNorm.length;
  const baseRate = mean(y);
  // Initial log-odds
  const initialPrediction = Math.log((baseRate + 1e-7) / (1 - baseRate + 1e-7));

  // Running additive prediction (in log-odds space)
  const F = new Array(n).fill(initialPrediction);
  const trees: TreeNode[] = [];

  for (let t = 0; t < GB_N_TREES; t++) {
    // Pseudo-residuals: negative gradient of log-loss = y - sigmoid(F)
    const residuals = F.map((f, i) => y[i] - sigmoid(f));

    // Fit a regression tree to the residuals
    const tree = buildRegressionTree(XNorm, residuals, 0, GB_MAX_DEPTH, GB_MIN_SAMPLES);
    trees.push(tree);

    // Update F
    for (let i = 0; i < n; i++) {
      F[i] += GB_LEARNING_RATE * predictTree(tree, XNorm[i]);
    }
  }

  return { trees, initialPrediction, learningRate: GB_LEARNING_RATE };
}

function predictGB(model: GBModel, xRaw: number[]): number {
  const x = normalize(xRaw, model.featureMeans, model.featureStds);
  let F = model.initialPrediction;
  for (const tree of model.trees) {
    F += model.learningRate * predictTree(tree, x);
  }
  return sigmoid(F);
}

// ─────────────────────────────────────────────────────────────
// Feature engineering (shared by all models)
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Ensemble: load / save / train / predict
// ─────────────────────────────────────────────────────────────

let cachedModel: EnsembleModel | null = null;

export function loadModel(): EnsembleModel | null {
  if (cachedModel) return cachedModel;
  try {
    if (fs.existsSync(MODEL_PATH)) {
      cachedModel = JSON.parse(fs.readFileSync(MODEL_PATH, "utf8")) as EnsembleModel;
      return cachedModel;
    }
  } catch {
    /* corrupt model */
  }
  return null;
}

function saveModel(model: EnsembleModel): void {
  try {
    fs.writeFileSync(MODEL_PATH, JSON.stringify(model), "utf8");
    cachedModel = model;
  } catch {
    /* non-fatal */
  }
}

export async function trainModel(logger?: Logger): Promise<{
  trainingSamples: number;
  accuracy: number;
  lrAccuracy: number;
  rfAccuracy: number;
  gbAccuracy: number;
  message: string;
}> {
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
      lrAccuracy: 0,
      rfAccuracy: 0,
      gbAccuracy: 0,
      message: `Insufficient data (${records.length} records). Need at least 10. Keep collecting.`,
    };
  }

  // Build labeled pairs: current conditions → will it rain 2h from now?
  const X_raw: number[][] = [];
  const y: number[] = [];

  for (let i = 0; i < records.length - 1; i++) {
    const cur = records[i];
    const tCur = new Date(cur.createdAt).getTime();
    let future = null;
    for (let j = i + 1; j < records.length; j++) {
      const dt = new Date(records[j].createdAt).getTime() - tCur;
      if (dt >= 3_600_000 && dt <= 14_400_000) { // 1h to 4h ahead
        future = records[j];
        break;
      }
    }
    if (!future) continue;
    X_raw.push(extractFeatures(cur.temperature, cur.humidity, cur.pressure, cur.windspeed, cur.weathercode, new Date(cur.createdAt)));
    y.push(RAIN_CODES.has(future.weathercode) ? 1 : 0);
  }

  if (X_raw.length < 5) {
    return {
      trainingSamples: X_raw.length,
      accuracy: 0,
      lrAccuracy: 0,
      rfAccuracy: 0,
      gbAccuracy: 0,
      message: `Only ${X_raw.length} labeled pairs — need more consecutive hourly observations.`,
    };
  }

  logger?.info({ pairs: X_raw.length }, "Training ensemble on labeled pairs");

  // Normalize once, share stats across all models
  const { featureMeans, featureStds } = computeStats(X_raw);
  const XNorm = X_raw.map((x) => normalize(x, featureMeans, featureStds));

  // Train all three models
  const lrParams = trainLR(XNorm, y);
  const lr: LRModel = { ...lrParams, featureMeans, featureStds };

  const rfParams = trainRF(XNorm, y);
  const rf: RFModel = { ...rfParams, featureMeans, featureStds };

  const gbParams = trainGB(XNorm, y);
  const gb: GBModel = { ...gbParams, featureMeans, featureStds };

  // Evaluate each model and the ensemble on training data
  const lrProbs = X_raw.map((x) => predictLR(lr, x));
  const rfProbs = X_raw.map((x) => predictRF(rf, x));
  const gbProbs = X_raw.map((x) => predictGB(gb, x));
  const ensProbs = lrProbs.map((p, i) => (p + rfProbs[i] + gbProbs[i]) / 3);

  const lrAccuracy = computeAccuracy(lrProbs, y);
  const rfAccuracy = computeAccuracy(rfProbs, y);
  const gbAccuracy = computeAccuracy(gbProbs, y);
  const accuracy = computeAccuracy(ensProbs, y);

  const model: EnsembleModel = {
    lr,
    rf,
    gb,
    trainedAt: new Date().toISOString(),
    trainingSamples: X_raw.length,
    accuracy,
    lrAccuracy,
    rfAccuracy,
    gbAccuracy,
    version: "ensemble_v1",
  };

  saveModel(model);

  logger?.info({ accuracy, lrAccuracy, rfAccuracy, gbAccuracy, pairs: X_raw.length }, "Ensemble trained");

  return {
    trainingSamples: X_raw.length,
    accuracy,
    lrAccuracy,
    rfAccuracy,
    gbAccuracy,
    message: `Ensemble trained on ${X_raw.length} labeled pairs. Training accuracy: ${accuracy}% (LR: ${lrAccuracy}%, RF: ${rfAccuracy}%, GB: ${gbAccuracy}%)`,
  };
}

// ─────────────────────────────────────────────────────────────
// Public prediction API
// ─────────────────────────────────────────────────────────────

export function predictRain(
  temperature: number,
  humidity: number,
  pressure: number,
  windspeed: number,
  weathercode: number,
  timestamp: Date = new Date()
): MLPrediction {
  const model = loadModel();
  const xRaw = extractFeatures(temperature, humidity, pressure, windspeed, weathercode, timestamp);

  if (!model) {
    const ruleProb = ruleBasedProb(humidity, pressure, weathercode);
    return {
      predictionValue: ruleProb >= 0.5 ? "yes" : "no",
      confidence: Math.round(Math.abs(ruleProb - 0.5) * 2 * 100) / 100,
      probability: Math.round(ruleProb * 1000) / 1000,
      modelVersion: "rules_heuristic",
    };
  }

  const lrProb = predictLR(model.lr, xRaw);
  const rfProb = predictRF(model.rf, xRaw);
  const gbProb = predictGB(model.gb, xRaw);
  const ensembleProb = (lrProb + rfProb + gbProb) / 3;

  return {
    predictionValue: ensembleProb >= 0.5 ? "yes" : "no",
    confidence: Math.round(Math.abs(ensembleProb - 0.5) * 2 * 100) / 100,
    probability: Math.round(ensembleProb * 1000) / 1000,
    modelVersion: `ensemble_v1_acc${model.accuracy}`,
    modelProbabilities: {
      lr: Math.round(lrProb * 1000) / 1000,
      rf: Math.round(rfProb * 1000) / 1000,
      gb: Math.round(gbProb * 1000) / 1000,
    },
  };
}

function ruleBasedProb(humidity: number, pressure: number, weathercode: number): number {
  let p = 0.2;
  if (RAIN_CODES.has(weathercode)) p += 0.5;
  if (humidity > 85) p += 0.2;
  else if (humidity > 70) p += 0.1;
  if (pressure < 1000) p += 0.15;
  else if (pressure < 1010) p += 0.05;
  return Math.min(0.95, Math.max(0.05, p));
}
