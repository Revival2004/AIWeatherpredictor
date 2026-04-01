/**
 * Alerts Service — generates prioritized crop and weather warnings from
 * forecast data. Alerts are designed to give farmers enough lead time
 * to take protective action (apply frost spray, cover crops, etc.)
 */

import type { ForecastResult, DailyForecast } from "./forecastService.js";

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType =
  | "frost"
  | "heat"
  | "heavy_rain"
  | "strong_wind"
  | "disease"
  | "irrigation"
  | "spray_window"
  | "harvest_window";

export interface WeatherAlert {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  message: string;
  actionRequired: string;
  validFrom: string;   // ISO date
  validUntil: string;  // ISO date
  daysAhead: number;   // How many days until this event
}

export interface AlertsResult {
  alerts: WeatherAlert[];
  activeCount: number;
  criticalCount: number;
}

function makeId(type: string, date: string): string {
  return `${type}-${date}`;
}

function frostAlert(day: DailyForecast, daysAhead: number): WeatherAlert | null {
  if (day.frostRisk === "none") return null;

  const severity: AlertSeverity =
    day.frostRisk === "severe" || day.frostRisk === "high" ? "critical" : "warning";

  const messages: Record<DailyForecast["frostRisk"], { title: string; message: string; action: string }> = {
    severe: {
      title: "Severe Frost — Crop Damage Likely",
      message: `Temperature expected to drop to ${day.tempMin}°C on ${day.date}. Severe frost will damage or destroy exposed crops.`,
      action: "Move tender plants indoors immediately. Cover all crops with frost cloth. Drain irrigation lines.",
    },
    high: {
      title: "Hard Frost Alert",
      message: `Temperature forecast: ${day.tempMin}°C on ${day.date}. Hard frost will damage unprotected crops.`,
      action: "Apply frost protection spray before sunset. Cover frost-sensitive crops. Protect seedlings.",
    },
    moderate: {
      title: "Frost Risk",
      message: `Low of ${day.tempMin}°C expected on ${day.date}. Young plants and sensitive crops at risk.`,
      action: "Prepare frost cloth. Monitor overnight temperatures. Avoid planting tender crops.",
    },
    low: {
      title: "Light Frost Possible",
      message: `Temperature may approach ${day.tempMin}°C on ${day.date}. Early-season crops at risk.`,
      action: "Watch overnight temperatures for early-season crops.",
    },
    none: { title: "", message: "", action: "" },
  };

  const { title, message, action } = messages[day.frostRisk];
  if (!title) return null;

  return {
    id: makeId("frost", day.date),
    severity,
    type: "frost",
    title,
    message,
    actionRequired: action,
    validFrom: day.date,
    validUntil: day.date,
    daysAhead,
  };
}

function heatAlert(day: DailyForecast, daysAhead: number): WeatherAlert | null {
  if (day.heatRisk === "none") return null;

  const severity: AlertSeverity = day.heatRisk === "high" ? "critical" : "warning";

  return {
    id: makeId("heat", day.date),
    severity,
    type: "heat",
    title:
      day.heatRisk === "high"
        ? `Extreme Heat — ${day.tempMax}°C on ${day.date}`
        : `High Heat Warning — ${day.tempMax}°C`,
    message: `Maximum temperature of ${day.tempMax}°C expected on ${day.date}. Risk of heat stress, crop scorch, and wilting.`,
    actionRequired:
      day.heatRisk === "high"
        ? "Irrigate before 8am. Deploy shade nets. Harvest heat-sensitive crops early."
        : "Schedule irrigation for early morning. Monitor crops for heat stress signs.",
    validFrom: day.date,
    validUntil: day.date,
    daysAhead,
  };
}

function rainAlert(day: DailyForecast, daysAhead: number): WeatherAlert | null {
  if (day.precipitationSum < 15) return null;

  const severity: AlertSeverity = day.precipitationSum > 30 ? "critical" : "warning";

  return {
    id: makeId("rain", day.date),
    severity,
    type: "heavy_rain",
    title: `Heavy Rain — ${day.precipitationSum}mm on ${day.date}`,
    message: `${day.precipitationSum}mm of rain forecast on ${day.date}. Field operations and spraying will not be possible. Risk of waterlogging.`,
    actionRequired: "Delay harvest and spraying. Ensure drainage channels are clear. Protect standing crops from lodging.",
    validFrom: day.date,
    validUntil: day.date,
    daysAhead,
  };
}

function windAlert(day: DailyForecast, daysAhead: number): WeatherAlert | null {
  if (day.windspeedMax < 35) return null;

  return {
    id: makeId("wind", day.date),
    severity: "warning",
    type: "strong_wind",
    title: `Strong Winds — ${day.windspeedMax} km/h on ${day.date}`,
    message: `Winds gusting to ${day.windspeedMax} km/h expected. Spraying operations must be suspended.`,
    actionRequired: "Secure polytunnels, shade nets, and loose structures. Suspend aerial and ground spraying.",
    validFrom: day.date,
    validUntil: day.date,
    daysAhead,
  };
}

function diseaseAlert(days: DailyForecast[]): WeatherAlert | null {
  // Trigger if 2+ consecutive high-pressure days in the forecast window
  const highPressureDays = days.filter((d) => d.diseasePressure === "high");
  if (highPressureDays.length < 2) return null;

  const first = highPressureDays[0];
  return {
    id: makeId("disease", first.date),
    severity: "warning",
    type: "disease",
    title: "Extended High Disease Pressure",
    message: `Conditions favorable for fungal disease for ${highPressureDays.length} consecutive days (high humidity + warm temperatures). Risk of blight, mildew, and botrytis.`,
    actionRequired: "Apply protective fungicide now. Remove infected plant material. Improve air circulation in polytunnels.",
    validFrom: first.date,
    validUntil: highPressureDays[highPressureDays.length - 1].date,
    daysAhead: 0,
  };
}

function irrigationAlert(forecast: ForecastResult): WeatherAlert | null {
  if (forecast.irrigationDeficit < 20) return null;

  return {
    id: "irrigation-deficit",
    severity: forecast.irrigationDeficit > 35 ? "critical" : "warning",
    type: "irrigation",
    title: `Irrigation Deficit — ${forecast.irrigationDeficit.toFixed(0)}mm`,
    message: `Water demand exceeds rainfall by ${forecast.irrigationDeficit.toFixed(0)}mm over the forecast period. Crops will experience moisture stress without supplemental irrigation.`,
    actionRequired: "Schedule irrigation in early morning (5–9am) to minimize evaporation losses. Prioritize fruiting and flowering stages.",
    validFrom: forecast.days[0]?.date ?? "",
    validUntil: forecast.days[forecast.days.length - 1]?.date ?? "",
    daysAhead: 0,
  };
}

function sprayWindowAlert(days: DailyForecast[]): WeatherAlert | null {
  // Highlight the best spray window in the next 4 days
  const candidate = days
    .slice(0, 4)
    .find((d) => d.sprayWindowOpen && d.diseasePressure !== "low" && d.frostRisk === "none");
  if (!candidate) return null;

  const daysAhead = days.indexOf(candidate);
  return {
    id: makeId("spray", candidate.date),
    severity: "info",
    type: "spray_window",
    title: `Spray Window Open — ${candidate.date}`,
    message: `Ideal spraying conditions on ${candidate.date}: wind < 15 km/h, < 20% rain probability, moderate humidity. Disease pressure is ${candidate.diseasePressure}.`,
    actionRequired: "Apply fungicides, pesticides, or foliar feeds early in the morning (before 10am).",
    validFrom: candidate.date,
    validUntil: candidate.date,
    daysAhead,
  };
}

function harvestWindowAlert(days: DailyForecast[]): WeatherAlert | null {
  const candidate = days
    .slice(0, 5)
    .find(
      (d) =>
        d.precipitationSum < 1 &&
        d.windspeedMax < 15 &&
        d.tempMax > 15 &&
        d.tempMax < 33 &&
        d.frostRisk === "none" &&
        d.fieldDayScore >= 8
    );
  if (!candidate) return null;

  return {
    id: makeId("harvest", candidate.date),
    severity: "info",
    type: "harvest_window",
    title: `Excellent Harvest Window — ${candidate.date}`,
    message: `Near-perfect harvest conditions forecast on ${candidate.date}: dry, calm winds, comfortable temperatures (${candidate.tempMin}–${candidate.tempMax}°C). Field Day Score: ${candidate.fieldDayScore}/10.`,
    actionRequired: "Prioritize harvesting mature crops. Ideal for grain drying and hay making.",
    validFrom: candidate.date,
    validUntil: candidate.date,
    daysAhead: days.indexOf(candidate),
  };
}

export function generateAlerts(forecast: ForecastResult): AlertsResult {
  const alerts: WeatherAlert[] = [];

  // Per-day alerts (first 3 days get priority)
  forecast.days.forEach((day, i) => {
    const frost = frostAlert(day, i);
    if (frost) alerts.push(frost);

    const heat = heatAlert(day, i);
    if (heat) alerts.push(heat);

    if (i < 4) {
      const rain = rainAlert(day, i);
      if (rain) alerts.push(rain);

      const wind = windAlert(day, i);
      if (wind) alerts.push(wind);
    }
  });

  // Multi-day pattern alerts
  const disease = diseaseAlert(forecast.days);
  if (disease) alerts.push(disease);

  const irrigation = irrigationAlert(forecast);
  if (irrigation) alerts.push(irrigation);

  const spray = sprayWindowAlert(forecast.days);
  if (spray) alerts.push(spray);

  const harvest = harvestWindowAlert(forecast.days);
  if (harvest) alerts.push(harvest);

  // Sort: critical first, then warning, then info; within same severity, sooner first
  const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => {
    const sev = severityOrder[a.severity] - severityOrder[b.severity];
    if (sev !== 0) return sev;
    return a.daysAhead - b.daysAhead;
  });

  return {
    alerts,
    activeCount: alerts.length,
    criticalCount: alerts.filter((a) => a.severity === "critical").length,
  };
}
