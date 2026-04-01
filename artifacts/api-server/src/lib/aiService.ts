/**
 * AI Service — adaptive microclimate prediction engine.
 *
 * Two modes:
 *  - Rule-based (cold start): deterministic rules when < 5 historical records exist.
 *  - Pattern-learned (kNN blend): as readings accumulate, the k-nearest-neighbor
 *    algorithm finds the most similar past conditions and uses their historical
 *    consensus to validate or override the rule result.
 *
 * Model progression:
 *  < 5  records  → "rules"           (pure deterministic)
 *  5–19 records  → "rules+patterns"  (rules primary, kNN adjusts confidence)
 *  20+ records   → "pattern-learned" (kNN can override rules when consensus > 70%)
 */

export interface WeatherInput {
  temperature: number;
  windspeed: number;
  humidity: number;
  pressure: number;
  weathercode: number;
}

export interface HistoricalRecord extends WeatherInput {
  prediction: string;
  confidence: number;
}

export interface PredictionResult {
  prediction: string;
  confidence: number;
  reasoning: string;
  dataPoints: number;
  modelVersion: string;
}

// ─── Feature normalization ────────────────────────────────────────────────────
// Fixed domain ranges based on global weather knowledge.
// These keep distance calculations numerically stable across features.
const FEATURE_RANGES = {
  temperature: { min: -20, max: 50 },   // °C
  windspeed:   { min: 0,   max: 80 },   // km/h
  humidity:    { min: 0,   max: 100 },  // %
  pressure:    { min: 950, max: 1060 }, // hPa
} as const;

function normalize(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function euclideanDistance(a: WeatherInput, b: WeatherInput): number {
  const dT = normalize(a.temperature, FEATURE_RANGES.temperature.min, FEATURE_RANGES.temperature.max)
           - normalize(b.temperature, FEATURE_RANGES.temperature.min, FEATURE_RANGES.temperature.max);
  const dW = normalize(a.windspeed, FEATURE_RANGES.windspeed.min, FEATURE_RANGES.windspeed.max)
           - normalize(b.windspeed, FEATURE_RANGES.windspeed.min, FEATURE_RANGES.windspeed.max);
  const dH = normalize(a.humidity, FEATURE_RANGES.humidity.min, FEATURE_RANGES.humidity.max)
           - normalize(b.humidity, FEATURE_RANGES.humidity.min, FEATURE_RANGES.humidity.max);
  const dP = normalize(a.pressure, FEATURE_RANGES.pressure.min, FEATURE_RANGES.pressure.max)
           - normalize(b.pressure, FEATURE_RANGES.pressure.min, FEATURE_RANGES.pressure.max);

  return Math.sqrt(dT * dT + dW * dW + dH * dH + dP * dP);
}

// ─── WMO code helpers ─────────────────────────────────────────────────────────
function weatherCodeDescription(code: number): string {
  if (code === 0) return "clear sky";
  if (code <= 3) return "partly cloudy";
  if (code <= 9) return "fog conditions";
  if (code <= 19) return "drizzle";
  if (code <= 29) return "rain";
  if (code <= 39) return "snow";
  if (code <= 49) return "fog";
  if (code <= 59) return "drizzle";
  if (code <= 69) return "rain";
  if (code <= 79) return "snow";
  if (code <= 84) return "rain showers";
  if (code <= 94) return "snow showers";
  return "thunderstorm";
}

// ─── Rule-based engine (unchanged core logic) ─────────────────────────────────
function rulePredict(input: WeatherInput): Omit<PredictionResult, "dataPoints" | "modelVersion"> {
  const { temperature, windspeed, humidity, pressure, weathercode } = input;
  const codeDesc = weatherCodeDescription(weathercode);

  if (weathercode >= 95) {
    return {
      prediction: "Thunderstorm in progress",
      confidence: 0.97,
      reasoning: `WMO code ${weathercode} indicates ${codeDesc}. Immediate shelter advised.`,
    };
  }

  if (humidity > 80 && pressure < 1000) {
    const conf = Math.min(0.92, 0.7 + (humidity - 80) * 0.01 + (1000 - pressure) * 0.005);
    return {
      prediction: "Rain likely soon",
      confidence: Math.round(conf * 100) / 100,
      reasoning: `High humidity (${humidity.toFixed(1)}%) combined with low pressure (${pressure.toFixed(1)} hPa) is a strong indicator of incoming precipitation.`,
    };
  }

  if (windspeed > 20) {
    const conf = Math.min(0.88, 0.65 + (windspeed - 20) * 0.01);
    return {
      prediction: "Storm possible",
      confidence: Math.round(conf * 100) / 100,
      reasoning: `Wind speed of ${windspeed.toFixed(1)} km/h exceeds storm threshold. Monitor conditions closely.`,
    };
  }

  if (weathercode >= 50) {
    return {
      prediction: "Active precipitation",
      confidence: 0.93,
      reasoning: `Current conditions show ${codeDesc} (WMO code ${weathercode}). Expect continued precipitation.`,
    };
  }

  if (humidity > 70 || pressure < 1010 || windspeed > 15) {
    const reasons: string[] = [];
    if (humidity > 70) reasons.push(`elevated humidity (${humidity.toFixed(1)}%)`);
    if (pressure < 1010) reasons.push(`slightly low pressure (${pressure.toFixed(1)} hPa)`);
    if (windspeed > 15) reasons.push(`moderate winds (${windspeed.toFixed(1)} km/h)`);
    return {
      prediction: "Changing conditions",
      confidence: 0.62,
      reasoning: `Moderate instability detected: ${reasons.join(", ")}. Conditions may deteriorate.`,
    };
  }

  const conf = Math.min(
    0.95,
    0.75 + Math.max(0, (pressure - 1010) * 0.005) + Math.max(0, (80 - humidity) * 0.002)
  );
  return {
    prediction: "Stable weather",
    confidence: Math.round(conf * 100) / 100,
    reasoning: `${codeDesc.charAt(0).toUpperCase() + codeDesc.slice(1)} with temperature ${temperature.toFixed(1)}°C, comfortable humidity (${humidity.toFixed(1)}%), and steady pressure (${pressure.toFixed(1)} hPa).`,
  };
}

// ─── kNN pattern engine ───────────────────────────────────────────────────────
function knnPredict(
  input: WeatherInput,
  history: HistoricalRecord[],
  modelVersion: string
): PredictionResult {
  const ruleResult = rulePredict(input);
  const n = history.length;

  // K = capped square root — grows with data but stays manageable
  const k = Math.min(7, Math.max(3, Math.ceil(Math.sqrt(n))));

  // Sort by distance
  const ranked = history
    .map((record) => ({ record, dist: euclideanDistance(input, record) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, k);

  // Weighted vote (inverse-square weighting, epsilon to avoid /0)
  const votes: Record<string, number> = {};
  let totalWeight = 0;
  for (const { record, dist } of ranked) {
    const w = 1 / (dist * dist + 1e-6);
    votes[record.prediction] = (votes[record.prediction] ?? 0) + w;
    totalWeight += w;
  }

  const sortedVotes = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const knnLabel = sortedVotes[0][0];
  const knnAgreement = sortedVotes[0][1] / totalWeight; // 0–1

  const pct = Math.round(knnAgreement * 100);
  const closestDist = ranked[0].dist.toFixed(3);

  if (knnLabel === ruleResult.prediction) {
    // Agreement: boost confidence proportional to kNN consensus strength
    const boost = knnAgreement * 0.08;
    const blendedConf = Math.min(0.98, ruleResult.confidence + boost);
    return {
      prediction: ruleResult.prediction,
      confidence: Math.round(blendedConf * 100) / 100,
      reasoning: `${ruleResult.reasoning} Confirmed by ${k} similar historical readings (${pct}% consensus, nearest distance ${closestDist}).`,
      dataPoints: n,
      modelVersion,
    };
  }

  // Disagreement: defer to kNN only if strong consensus AND enough data
  if (knnAgreement > 0.7 && n >= 20) {
    const conf = Math.round(knnAgreement * 0.85 * 100) / 100;
    return {
      prediction: knnLabel,
      confidence: conf,
      reasoning: `Pattern analysis of ${k} similar historical conditions shows ${pct}% consensus for "${knnLabel}" (nearest distance ${closestDist}). Rule engine suggested "${ruleResult.prediction}" — deferred to learned patterns with ${n} data points.`,
      dataPoints: n,
      modelVersion,
    };
  }

  // Weak disagreement: keep rules, note mixed signals
  return {
    ...ruleResult,
    reasoning: `${ruleResult.reasoning} Historical patterns show mixed signals at these conditions (kNN: "${knnLabel}" at ${pct}% agreement vs rule result).`,
    dataPoints: n,
    modelVersion,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Pure rule-based prediction (no history).
 * Kept for backward compatibility and cold-start fallback.
 */
export function predict(input: WeatherInput): PredictionResult {
  return { ...rulePredict(input), dataPoints: 0, modelVersion: "rules" };
}

/**
 * Adaptive prediction that blends rule-based logic with k-NN pattern matching.
 * Call this when historical records are available — it will improve automatically
 * as the database accumulates more readings.
 *
 * @param input   Current weather conditions
 * @param history Historical weather records from the database
 */
export function predictWithHistory(
  input: WeatherInput,
  history: HistoricalRecord[]
): PredictionResult {
  const n = history.length;

  if (n < 5) {
    // Not enough data for meaningful pattern matching — use rules only
    return { ...rulePredict(input), dataPoints: n, modelVersion: "rules" };
  }

  const modelVersion = n >= 20 ? "pattern-learned" : "rules+patterns";
  return knnPredict(input, history, modelVersion);
}
