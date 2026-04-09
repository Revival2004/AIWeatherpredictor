import type { Logger } from "pino";

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

export interface EnsembleModel {
  version: string;
  trainedAt: string;
  trainingSamples: number;
  accuracy: number;
  lrAccuracy: number;
  rfAccuracy: number;
  gbAccuracy: number;
  modelUsed: string;
  mode: "mocked";
}

export interface MockWeatherPrediction {
  temperature: number;
  rain: boolean;
  advice: string;
}

export interface MLPrediction {
  predictionValue: "yes" | "no";
  confidence: number;
  probability: number;
  modelVersion: string;
  modelUsed: string;
  modelProbabilities: {
    lr: number;
    rf: number;
    gb: number;
  };
  mock: MockWeatherPrediction;
}

export interface TrainResult {
  trainingSamples: number;
  accuracy: number;
  lrAccuracy: number;
  rfAccuracy: number;
  gbAccuracy: number;
  message: string;
}

const MOCK_MODEL: EnsembleModel = {
  version: "mock-render-v1",
  trainedAt: new Date().toISOString(),
  trainingSamples: 0,
  accuracy: 82,
  lrAccuracy: 78,
  rfAccuracy: 82,
  gbAccuracy: 80,
  modelUsed: "mock-weather-model",
  mode: "mocked",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildProbability(humidity: number, pressure: number, weathercode: number): number {
  let probability = 0.2;

  if (RAIN_CODES.has(weathercode)) {
    probability += 0.35;
  }

  if (humidity >= 85) {
    probability += 0.2;
  } else if (humidity >= 70) {
    probability += 0.1;
  }

  if (pressure <= 1000) {
    probability += 0.15;
  } else if (pressure <= 1008) {
    probability += 0.08;
  }

  return clamp(Number(probability.toFixed(3)), 0.05, 0.95);
}

export function loadModel(): EnsembleModel {
  return { ...MOCK_MODEL };
}

export async function trainModel(logger?: Logger): Promise<TrainResult> {
  logger?.info("Mock ML mode enabled - skipping Python training");

  return {
    trainingSamples: 0,
    accuracy: MOCK_MODEL.accuracy,
    lrAccuracy: MOCK_MODEL.lrAccuracy,
    rfAccuracy: MOCK_MODEL.rfAccuracy,
    gbAccuracy: MOCK_MODEL.gbAccuracy,
    message: "ML training is mocked for Render deployment. Python execution is disabled.",
  };
}

export function getMockWeatherPrediction(input: {
  temperature: number;
  humidity: number;
  pressure: number;
  weathercode: number;
}): MockWeatherPrediction {
  const probability = buildProbability(input.humidity, input.pressure, input.weathercode);
  const rain = probability >= 0.5;

  let advice = "Good day for farming";
  if (rain) {
    advice = "Rain is possible soon. Delay spraying and protect seedlings.";
  } else if (input.temperature >= 30) {
    advice = "Warm and mostly dry. Irrigate early and watch for heat stress.";
  } else if (input.humidity >= 80) {
    advice = "Humidity is high. Monitor crops closely for disease pressure.";
  }

  return {
    temperature: Math.round(input.temperature),
    rain,
    advice,
  };
}

export async function predictRain(
  temperature: number,
  humidity: number,
  pressure: number,
  _windspeed: number,
  weathercode: number,
): Promise<MLPrediction> {
  const probability = buildProbability(humidity, pressure, weathercode);
  const confidence = clamp(Number((0.55 + Math.abs(probability - 0.5) * 0.9).toFixed(2)), 0.55, 0.95);
  const mock = getMockWeatherPrediction({
    temperature,
    humidity,
    pressure,
    weathercode,
  });

  return {
    predictionValue: mock.rain ? "yes" : "no",
    confidence,
    probability,
    modelVersion: MOCK_MODEL.version,
    modelUsed: MOCK_MODEL.modelUsed,
    modelProbabilities: {
      lr: Number((probability * 0.95).toFixed(3)),
      rf: probability,
      gb: Number(clamp(probability * 1.03, 0.05, 0.95).toFixed(3)),
    },
    mock,
  };
}
