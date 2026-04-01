/**
 * Forecast Service — fetches 7-day daily forecast from Open-Meteo and computes
 * per-day agricultural intelligence: field day scores, frost/heat risk,
 * disease pressure, irrigation needs, and GDD accumulation.
 */

export interface DailyForecast {
  date: string;          // YYYY-MM-DD
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  precipitationProbability: number;
  windspeedMax: number;
  uvIndexMax: number;
  weathercode: number;
  avgHumidity: number;
  fieldDayScore: number;  // 0–10
  farmActions: string[];
  frostRisk: "none" | "low" | "moderate" | "high" | "severe";
  heatRisk: "none" | "low" | "moderate" | "high";
  diseasePressure: "low" | "moderate" | "high";
  irrigationNeeded: boolean;
  sprayWindowOpen: boolean;
  gdd: number;           // Growing Degree Days for this day (base 10°C)
}

export interface ForecastResult {
  days: DailyForecast[];
  cumulativeGDD: number;
  irrigationDeficit: number;  // mm (ET0 - precipitation over 7 days)
  latitude: number;
  longitude: number;
}

interface OpenMeteoForecastResponse {
  latitude: number;
  longitude: number;
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    windspeed_10m_max: number[];
    uv_index_max: number[];
    weathercode: number[];
    et0_fao_evapotranspiration: number[];
  };
  hourly: {
    time: string[];
    relativehumidity_2m: number[];
  };
}

function computeFrostRisk(tempMin: number): DailyForecast["frostRisk"] {
  if (tempMin < -5) return "severe";
  if (tempMin < 0)  return "high";
  if (tempMin < 3)  return "moderate";
  if (tempMin < 5)  return "low";
  return "none";
}

function computeHeatRisk(tempMax: number): DailyForecast["heatRisk"] {
  if (tempMax > 40) return "high";
  if (tempMax > 38) return "moderate";
  if (tempMax > 35) return "low";
  return "none";
}

function computeDiseasePressure(
  avgHumidity: number,
  tempMin: number,
  tempMax: number
): DailyForecast["diseasePressure"] {
  const avgTemp = (tempMax + tempMin) / 2;
  if (avgHumidity >= 80 && avgTemp >= 15 && avgTemp <= 28) return "high";
  if (avgHumidity >= 70 && avgTemp >= 12 && avgTemp <= 30) return "moderate";
  return "low";
}

function computeFieldDayScore(
  tempMax: number,
  tempMin: number,
  precipitationSum: number,
  windspeedMax: number,
  uvIndexMax: number
): number {
  let score = 10;

  // Precipitation penalty
  if (precipitationSum > 15)     score -= 4;
  else if (precipitationSum > 8) score -= 3;
  else if (precipitationSum > 3) score -= 2;
  else if (precipitationSum > 1) score -= 1;

  // Wind penalty
  if (windspeedMax > 35)      score -= 2;
  else if (windspeedMax > 25) score -= 1;

  // Frost penalty
  if (tempMin < -5)      score -= 4;
  else if (tempMin < 0)  score -= 3;
  else if (tempMin < 3)  score -= 2;
  else if (tempMin < 5)  score -= 1;

  // Heat penalty
  if (tempMax > 40)      score -= 3;
  else if (tempMax > 38) score -= 2;
  else if (tempMax > 35) score -= 1;

  // UV penalty
  if (uvIndexMax > 9) score -= 1;

  return Math.max(0, Math.min(10, score));
}

function computeFarmActions(
  tempMax: number,
  tempMin: number,
  precipitationSum: number,
  windspeedMax: number,
  frostRisk: DailyForecast["frostRisk"],
  heatRisk: DailyForecast["heatRisk"],
  diseasePressure: DailyForecast["diseasePressure"],
  irrigationNeeded: boolean,
  sprayWindowOpen: boolean
): string[] {
  const actions: string[] = [];

  if (frostRisk === "severe") {
    actions.push("CRITICAL: Expect crop damage — move tender plants indoors immediately");
    actions.push("Cover all crops with frost cloth tonight");
    actions.push("Drain irrigation lines to prevent pipe damage");
  } else if (frostRisk === "high") {
    actions.push("Apply frost protection spray before sunset");
    actions.push("Cover frost-sensitive crops with fleece or mulch");
    actions.push("Protect seedlings and young transplants");
  } else if (frostRisk === "moderate") {
    actions.push("Monitor temperatures overnight — prepare frost cloth");
    actions.push("Hold off on planting tender crops");
  } else if (frostRisk === "low") {
    actions.push("Watch overnight temps for early-season crops");
  }

  if (heatRisk === "high") {
    actions.push("Irrigate before 8am — evaporation too high after 10am");
    actions.push("Inspect for heat scorch and wilting after noon");
    actions.push("Shade nets recommended for leafy vegetables");
  } else if (heatRisk === "moderate") {
    actions.push("Early morning irrigation to reduce heat stress");
    actions.push("Avoid fertilizer application — risk of leaf burn");
  }

  if (diseasePressure === "high" && windspeedMax < 20) {
    actions.push("Spray fungicide — ideal conditions for disease spread");
  } else if (diseasePressure === "high") {
    actions.push("High disease pressure — apply fungicide when wind drops");
  } else if (diseasePressure === "moderate") {
    actions.push("Monitor crops for early fungal symptoms");
  }

  if (sprayWindowOpen && diseasePressure !== "high") {
    actions.push("Good spray window — low wind, no rain expected");
  }

  if (irrigationNeeded && precipitationSum < 2) {
    actions.push("Irrigation recommended — soil water deficit detected");
  }

  if (precipitationSum > 15) {
    actions.push("Delay harvest and field operations — soil too wet");
    actions.push("Check drainage channels and prevent waterlogging");
  } else if (precipitationSum >= 5 && precipitationSum <= 15) {
    actions.push("Good conditions for fertilizer application after rain");
  }

  if (
    precipitationSum < 1 &&
    windspeedMax < 15 &&
    tempMax > 15 &&
    tempMax < 33 &&
    frostRisk === "none"
  ) {
    actions.push("Excellent harvest window — dry, calm conditions");
  }

  const avgTemp = (tempMax + tempMin) / 2;
  if (avgTemp >= 18 && avgTemp <= 30 && diseasePressure !== "low") {
    actions.push("Check for pest activity — conditions favor insect pressure");
  }

  if (actions.length === 0) {
    actions.push("Favorable conditions — routine field operations");
  }

  return actions;
}

export async function fetchForecast(lat: number, lon: number): Promise<ForecastResult> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "daily",
    [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "windspeed_10m_max",
      "uv_index_max",
      "weathercode",
      "et0_fao_evapotranspiration",
    ].join(",")
  );
  url.searchParams.set("hourly", "relativehumidity_2m");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open-Meteo forecast error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as OpenMeteoForecastResponse;
  const { daily, hourly } = data;

  // Compute daily average humidity from hourly data (24h per day)
  const dailyAvgHumidity: number[] = [];
  for (let d = 0; d < 7; d++) {
    const start = d * 24;
    const end = start + 24;
    const slice = hourly.relativehumidity_2m.slice(start, end).filter((v) => v != null);
    const avg = slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 60;
    dailyAvgHumidity.push(Math.round(avg));
  }

  let cumulativeGDD = 0;
  let irrigationDeficit = 0;

  const days: DailyForecast[] = daily.time.map((date, i) => {
    const tempMax = daily.temperature_2m_max[i] ?? 20;
    const tempMin = daily.temperature_2m_min[i] ?? 10;
    const precipitationSum = daily.precipitation_sum[i] ?? 0;
    const precipProbability = daily.precipitation_probability_max[i] ?? 0;
    const windspeedMax = daily.windspeed_10m_max[i] ?? 10;
    const uvIndexMax = daily.uv_index_max[i] ?? 3;
    const weathercode = daily.weathercode[i] ?? 0;
    const et0 = daily.et0_fao_evapotranspiration[i] ?? 3;
    const avgHumidity = dailyAvgHumidity[i] ?? 60;

    // GDD base 10°C (standard for most crops)
    const gdd = Math.max(0, (tempMax + tempMin) / 2 - 10);
    cumulativeGDD += gdd;

    // Irrigation deficit (positive = more ET than rain = need to irrigate)
    irrigationDeficit += et0 - precipitationSum;

    const frostRisk = computeFrostRisk(tempMin);
    const heatRisk = computeHeatRisk(tempMax);
    const diseasePressure = computeDiseasePressure(avgHumidity, tempMin, tempMax);
    const irrigationNeeded = irrigationDeficit > 10 && precipitationSum < 2;
    const sprayWindowOpen = windspeedMax < 15 && precipProbability < 20 && avgHumidity < 80;
    const fieldDayScore = computeFieldDayScore(tempMax, tempMin, precipitationSum, windspeedMax, uvIndexMax);

    const farmActions = computeFarmActions(
      tempMax,
      tempMin,
      precipitationSum,
      windspeedMax,
      frostRisk,
      heatRisk,
      diseasePressure,
      irrigationNeeded,
      sprayWindowOpen
    );

    return {
      date,
      tempMax: Math.round(tempMax * 10) / 10,
      tempMin: Math.round(tempMin * 10) / 10,
      precipitationSum: Math.round(precipitationSum * 10) / 10,
      precipitationProbability: precipProbability,
      windspeedMax: Math.round(windspeedMax * 10) / 10,
      uvIndexMax: Math.round(uvIndexMax * 10) / 10,
      weathercode,
      avgHumidity,
      fieldDayScore: Math.round(fieldDayScore * 10) / 10,
      farmActions,
      frostRisk,
      heatRisk,
      diseasePressure,
      irrigationNeeded,
      sprayWindowOpen,
      gdd: Math.round(gdd * 10) / 10,
    };
  });

  return {
    days,
    cumulativeGDD: Math.round(cumulativeGDD * 10) / 10,
    irrigationDeficit: Math.round(irrigationDeficit * 10) / 10,
    latitude: data.latitude,
    longitude: data.longitude,
  };
}
