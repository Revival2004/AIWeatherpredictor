/**
 * AI Service — rule-based microclimate prediction engine.
 * Structured for future ML upgrade: replace the `predict` function
 * with a model inference call when training data is sufficient.
 */

export interface WeatherInput {
  temperature: number;
  windspeed: number;
  humidity: number;
  pressure: number;
  weathercode: number;
}

export interface PredictionResult {
  prediction: string;
  confidence: number;
  reasoning: string;
}

/**
 * WMO weather codes above 50 indicate precipitation.
 * Codes 80+ indicate showers, 95+ indicate thunderstorms.
 */
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

/**
 * Main prediction function.
 * Rule priority (highest → lowest):
 *  1. Thunderstorm code     → Storm imminent
 *  2. High humidity + low pressure → Rain likely
 *  3. High windspeed        → Storm possible
 *  4. Precipitation code    → Active precipitation
 *  5. Moderate risk signals → Changing conditions
 *  6. Default               → Stable weather
 */
export function predict(input: WeatherInput): PredictionResult {
  const { temperature, windspeed, humidity, pressure, weathercode } = input;
  const codeDesc = weatherCodeDescription(weathercode);

  // Rule 1: Active thunderstorm conditions
  if (weathercode >= 95) {
    return {
      prediction: "Thunderstorm in progress",
      confidence: 0.97,
      reasoning: `WMO code ${weathercode} indicates ${codeDesc}. Immediate shelter advised.`,
    };
  }

  // Rule 2: Classic pre-rain microclimate signature
  if (humidity > 80 && pressure < 1000) {
    const confidenceBoost = Math.min(
      0.92,
      0.7 + (humidity - 80) * 0.01 + (1000 - pressure) * 0.005
    );
    return {
      prediction: "Rain likely soon",
      confidence: Math.round(confidenceBoost * 100) / 100,
      reasoning: `High humidity (${humidity.toFixed(1)}%) combined with low pressure (${pressure.toFixed(1)} hPa) is a strong indicator of incoming precipitation.`,
    };
  }

  // Rule 3: Storm-force winds
  if (windspeed > 20) {
    const stormConf = Math.min(0.88, 0.65 + (windspeed - 20) * 0.01);
    return {
      prediction: "Storm possible",
      confidence: Math.round(stormConf * 100) / 100,
      reasoning: `Wind speed of ${windspeed.toFixed(1)} km/h exceeds storm threshold. Monitor conditions closely.`,
    };
  }

  // Rule 4: Active precipitation from weather code
  if (weathercode >= 50) {
    return {
      prediction: "Active precipitation",
      confidence: 0.93,
      reasoning: `Current conditions show ${codeDesc} (WMO code ${weathercode}). Expect continued precipitation.`,
    };
  }

  // Rule 5: Moderate risk — some instability present
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

  // Rule 6: Stable weather
  const stableConf = Math.min(
    0.95,
    0.75 + Math.max(0, (pressure - 1010) * 0.005) + Math.max(0, (80 - humidity) * 0.002)
  );
  return {
    prediction: "Stable weather",
    confidence: Math.round(stableConf * 100) / 100,
    reasoning: `${codeDesc.charAt(0).toUpperCase() + codeDesc.slice(1)} with temperature ${temperature.toFixed(1)}°C, comfortable humidity (${humidity.toFixed(1)}%), and steady pressure (${pressure.toFixed(1)} hPa).`,
  };
}
