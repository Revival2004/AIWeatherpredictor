import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { generateAlerts } from "../lib/alertsService.js";
import { requireAdminAuth } from "../lib/adminAuth.js";
import { requireFarmerOrAdminAuth, type AuthenticatedActor } from "../lib/farmerAuth.js";
import { fetchForecast } from "../lib/forecastService.js";
import {
  loadModel,
  predictRain,
  trainModel,
} from "../lib/mlService.js";
import { collectAllLocations } from "../lib/schedulerRuntime.js";
import {
  addFeedbackRecord,
  addPredictionRecord,
  addWeatherRecord,
  getLatestWeatherRecordNear,
  getWeatherStats,
  listFeedbackRecords,
  listPredictionRecords,
  listWeatherRecords,
} from "../lib/store.js";
import { fetchWeather } from "../lib/weatherService.js";

const router: IRouter = Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://127.0.0.1:5001";
const ML_MODE = process.env.ML_SERVICE_URL ? "remote-python" : "fallback";
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

router.use(requireFarmerOrAdminAuth);

const weatherQuerySchema = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  localPressure: z.coerce.number().optional(),
});

const weatherHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(20),
  lat: z.coerce.number().optional(),
  lon: z.coerce.number().optional(),
});

const feedbackBodySchema = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  question: z.enum(["rain", "cloudy", "wind"]),
  answer: z.enum(["yes", "no", "almost"]),
  locationName: z.string().optional(),
});

function getSeason(month: number): "long-rains" | "short-rains" | "off-season" {
  if (month >= 3 && month <= 5) {
    return "long-rains";
  }

  if (month >= 10 && month <= 12) {
    return "short-rains";
  }

  return "off-season";
}

function roundMaybe(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  return Number(value.toFixed(2));
}

function getNearbyRecords<T extends { latitude: number; longitude: number }>(
  rows: T[],
  lat: number,
  lon: number,
  radiusDegrees: number,
): T[] {
  return rows.filter((row) => (
    row.latitude >= lat - radiusDegrees &&
    row.latitude <= lat + radiusDegrees &&
    row.longitude >= lon - radiusDegrees &&
    row.longitude <= lon + radiusDegrees
  ));
}

function toPercent(value: number | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (value <= 1) {
    return Number((value * 100).toFixed(1));
  }

  return Number(value.toFixed(1));
}

function buildPredictionLabel(predictionValue: "yes" | "no"): string {
  return predictionValue === "yes" ? "Rain expected" : "No rain expected";
}

function buildPredictionReasoning(
  weather: Awaited<ReturnType<typeof fetchWeather>>,
  probability: number,
): string {
  const chance = Math.round(probability * 100);
  const notes = [`The Python ML model estimates a ${chance}% chance of rain in the next 2 hours.`];

  if (RAIN_CODES.has(weather.weathercode)) {
    notes.push("Current conditions already show active rain signals.");
  } else if (weather.humidity >= 80) {
    notes.push("Humidity is elevated, which supports rainfall development.");
  } else if (weather.pressure <= 1005) {
    notes.push("Pressure is relatively low, which can support unstable weather.");
  } else {
    notes.push("Current conditions look fairly stable at the moment.");
  }

  return notes.join(" ");
}

type AuthenticatedRequest = Request & { authenticatedActor?: AuthenticatedActor };

function getAuthenticatedActorFromRequest(req: AuthenticatedRequest): AuthenticatedActor {
  return req.authenticatedActor as AuthenticatedActor;
}

function buildFarmingAdvice(
  weather: Awaited<ReturnType<typeof fetchWeather>>,
  predictionValue: "yes" | "no",
  probability: number,
): string {
  if (predictionValue === "yes") {
    if (probability >= 0.7) {
      return "Rain looks likely soon. Delay spraying, protect inputs, and prepare for wet field conditions.";
    }
    return "A rain window is possible soon. Be cautious with spraying and avoid leaving inputs exposed.";
  }

  if (weather.temperature >= 30) {
    return "Conditions look mostly dry. Irrigate early and watch crops for heat stress.";
  }

  if (weather.humidity >= 80) {
    return "Rain is not the most likely outcome right now, but humidity is high. Monitor crops for disease pressure.";
  }

  return "Conditions look stable for routine farm work.";
}

router.get("/weather", async (req, res): Promise<void> => {
  const parsed = weatherQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { lat, lon, localPressure } = parsed.data;

  let weather: Awaited<ReturnType<typeof fetchWeather>> | null = null;
  let source: "open-meteo" | "cached" = "open-meteo";

  try {
    weather = await fetchWeather(lat, lon);
  } catch (error) {
    req.log?.warn({ err: error }, "Open-Meteo fetch failed, using cached weather");
    const cached = await getLatestWeatherRecordNear(lat, lon, 2.7);
    if (!cached) {
      res.status(500).json({ error: "Failed to fetch weather data." });
      return;
    }

    weather = {
      temperature: cached.temperature,
      windspeed: cached.windspeed,
      humidity: cached.humidity,
      pressure: cached.pressure,
      weathercode: cached.weathercode,
      time: cached.createdAt.toISOString(),
      estimated: true,
    };
    source = "cached";
  }

  if (localPressure && localPressure > 850 && localPressure < 1100) {
    weather.pressure = localPressure * 0.8 + weather.pressure * 0.2;
  }

  const rainPrediction = await predictRain(
    weather.temperature,
    weather.humidity,
    weather.pressure,
    weather.windspeed,
    weather.weathercode,
    new Date(weather.time),
    lat,
    lon,
    weather.elevation,
  );
  const predictionLabel = buildPredictionLabel(rainPrediction.predictionValue);
  const reasoning = buildPredictionReasoning(weather, rainPrediction.probability);
  const advice = buildFarmingAdvice(weather, rainPrediction.predictionValue, rainPrediction.probability);

  const nearbyHistory = await listWeatherRecords({ lat, lon, radiusDegrees: 2.7, limit: 100 });
  const record = await addWeatherRecord({
    latitude: lat,
    longitude: lon,
    temperature: weather.temperature,
    windspeed: weather.windspeed,
    humidity: weather.humidity,
    pressure: weather.pressure,
    weathercode: weather.weathercode,
    prediction: predictionLabel,
    confidence: rainPrediction.confidence,
    reasoning,
  });

  res.json({
    weather: {
      temperature: weather.temperature,
      windspeed: weather.windspeed,
      humidity: weather.humidity,
      pressure: weather.pressure,
      weathercode: weather.weathercode,
      time: weather.time,
    },
    prediction: {
      prediction: record.prediction,
      confidence: rainPrediction.confidence,
      reasoning,
      advice,
      probability: rainPrediction.probability,
      dataPoints: nearbyHistory.length,
      modelVersion: rainPrediction.modelVersion,
      modelUsed: rainPrediction.modelUsed,
    },
    location: { lat, lon },
    recordId: record.id,
    mlMode: ML_MODE,
    source,
  });
});

router.get("/weather/history", async (req, res): Promise<void> => {
  const parsed = weatherHistoryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const records = await listWeatherRecords({
    limit: parsed.data.limit,
    lat: parsed.data.lat,
    lon: parsed.data.lon,
    radiusDegrees: 0.5,
  });

  res.json(records);
});

router.get("/weather/forecast", async (req, res): Promise<void> => {
  const parsed = weatherQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const forecast = await fetchForecast(parsed.data.lat, parsed.data.lon);
    res.json(forecast);
  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch forecast");
    res.status(500).json({ error: "Failed to fetch forecast data." });
  }
});

router.get("/weather/alerts", async (req, res): Promise<void> => {
  const parsed = weatherQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const forecast = await fetchForecast(parsed.data.lat, parsed.data.lon);
    res.json(generateAlerts(forecast));
  } catch (error) {
    req.log?.error({ err: error }, "Failed to generate alerts");
    res.status(500).json({ error: "Failed to generate weather alerts." });
  }
});

router.get("/weather/stats", async (_req, res): Promise<void> => {
  const stats = await getWeatherStats();
  res.json({
    totalReadings: stats.totalReadings,
    avgTemperature: roundMaybe(stats.avgTemperature),
    avgWindspeed: roundMaybe(stats.avgWindspeed),
    avgHumidity: roundMaybe(stats.avgHumidity),
    predictionBreakdown: stats.predictionBreakdown,
    lastReading: stats.lastReading ? stats.lastReading.toISOString() : null,
  });
});

router.post("/collect", async (req, res): Promise<void> => {
  try {
    const results = await collectAllLocations(req.log);
    res.json({
      collected: results.filter((result) => result.success).length,
      total: results.length,
      results,
    });
  } catch (error) {
    req.log?.error({ err: error }, "Manual collection failed");
    res.status(500).json({ error: "Failed to collect weather data." });
  }
});

router.get("/metrics", requireAdminAuth, async (_req, res): Promise<void> => {
  const model = loadModel();
  const predictions = await listPredictionRecords();
  const resolved = predictions.filter((prediction) => prediction.isCorrect !== null);
  const correct = resolved.filter((prediction) => prediction.isCorrect === true).length;
  const accuracy = resolved.length > 0
    ? Number(((correct / resolved.length) * 100).toFixed(1))
    : null;

  res.json({
    predictions: {
      total: predictions.length,
      resolved: resolved.length,
      correct,
      accuracy,
    },
    model: model
      ? {
          version: model.version,
          trainedAt: model.trainedAt,
          trainingSamples: model.trainingSamples,
          accuracy: toPercent(model.accuracy) ?? 0,
          lrAccuracy: toPercent(model.lrAccuracy),
          rfAccuracy: toPercent(model.rfAccuracy),
          gbAccuracy: toPercent(model.gbAccuracy),
        }
      : null,
    observations: (await listWeatherRecords()).length,
  });
});

router.post("/train", requireAdminAuth, async (req, res): Promise<void> => {
  try {
    const result = await trainModel(req.log);
    res.json({
      ...result,
      accuracy: toPercent(result.accuracy) ?? 0,
      lrAccuracy: toPercent(result.lrAccuracy) ?? 0,
      rfAccuracy: toPercent(result.rfAccuracy) ?? 0,
      gbAccuracy: toPercent(result.gbAccuracy) ?? 0,
    });
  } catch (error) {
    req.log?.error({ err: error }, "Model training failed");
    res.status(500).json({ error: "Model training failed." });
  }
});

router.post("/bootstrap", requireAdminAuth, async (req, res): Promise<void> => {
  try {
    const body = req.body && Object.keys(req.body).length ? req.body : {};
    const response = await fetch(`${ML_SERVICE_URL}/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json(data);
      return;
    }

    res.json({
      ...data,
      mlMode: ML_MODE,
    });
  } catch (error) {
    req.log?.error({ err: error }, "Bootstrap failed");
    res.status(500).json({ error: "Bootstrap failed. Check ML service and network access." });
  }
});

router.get("/weather/rain", async (req, res): Promise<void> => {
  const parsed = weatherQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const weather = await fetchWeather(parsed.data.lat, parsed.data.lon);
    const prediction = await predictRain(
      weather.temperature,
      weather.humidity,
      weather.pressure,
      weather.windspeed,
      weather.weathercode,
      new Date(weather.time),
      parsed.data.lat,
      parsed.data.lon,
      weather.elevation,
    );
    const advice = buildFarmingAdvice(weather, prediction.predictionValue, prediction.probability);

    const targetTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await addPredictionRecord({
      latitude: parsed.data.lat,
      longitude: parsed.data.lon,
      predictedAt: new Date(),
      targetTime,
      predictionType: "rain_2h",
      predictionValue: prediction.predictionValue,
      confidence: prediction.confidence,
      probability: prediction.probability,
      modelVersion: prediction.modelVersion,
      isCorrect: null,
    });

    res.json({
      predictionValue: prediction.predictionValue,
      confidence: prediction.confidence,
      probability: prediction.probability,
      modelVersion: prediction.modelVersion,
      modelProbabilities: prediction.modelProbabilities,
      lat: parsed.data.lat,
      lon: parsed.data.lon,
      targetTime: targetTime.toISOString(),
      currentConditions: {
        temperature: weather.temperature,
        humidity: weather.humidity,
        pressure: weather.pressure,
        windspeed: weather.windspeed,
        weathercode: weather.weathercode,
      },
      temperature: Math.round(weather.temperature),
      rain: prediction.predictionValue === "yes",
      advice,
      model_used: prediction.modelUsed,
      mlMode: ML_MODE,
    });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to build rain prediction");
    res.status(500).json({ error: "Failed to fetch current weather." });
  }
});

router.post("/feedback", async (req, res): Promise<void> => {
  const parsed = feedbackBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const actor = getAuthenticatedActorFromRequest(req);
    await addFeedbackRecord({
      farmerId: actor.role === "farmer" ? actor.farmerSession.id : null,
      latitude: parsed.data.lat,
      longitude: parsed.data.lon,
      question: parsed.data.question,
      answer: parsed.data.answer,
      locationName: parsed.data.locationName ?? null,
    });

    res.json({
      success: true,
      autoRetrained: false,
      mlMode: ML_MODE,
    });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to store feedback");
    res.status(500).json({ error: "Failed to store feedback." });
  }
});

router.get("/weather/storm-timeline", async (req, res): Promise<void> => {
  const parsed = weatherQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "lat and lon are required" });
    return;
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${parsed.data.lat}&longitude=${parsed.data.lon}` +
      `&minutely_15=precipitation_probability,precipitation` +
      `&forecast_days=1&timezone=auto`;

    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      throw new Error(`Open-Meteo ${response.status}`);
    }

    const data = (await response.json()) as {
      minutely_15?: {
        time: string[];
        precipitation_probability: number[];
        precipitation: number[];
      };
    };

    const minuteData = data.minutely_15;
    if (!minuteData || minuteData.time.length === 0) {
      res.json({ slots: [], stormArrivalMinutes: null, stormDetected: false });
      return;
    }

    const now = Date.now();
    const slots = minuteData.time
      .map((time, index) => ({
        time,
        probability: minuteData.precipitation_probability[index] ?? 0,
        precipitation: minuteData.precipitation[index] ?? 0,
      }))
      .filter((slot) => new Date(slot.time).getTime() >= now - 60_000)
      .slice(0, 24);

    const firstRain = slots.find((slot) => slot.probability >= 40);
    const stormArrivalMinutes = firstRain
      ? Math.round((new Date(firstRain.time).getTime() - now) / 60_000)
      : null;

    res.json({
      slots,
      stormArrivalMinutes,
      stormDetected: stormArrivalMinutes !== null && stormArrivalMinutes >= 0,
      stormSoon: stormArrivalMinutes !== null && stormArrivalMinutes <= 30,
    });
  } catch (error) {
    req.log?.error({ err: error }, "Storm timeline fetch failed");
    res.status(500).json({ error: "Failed to fetch storm timeline." });
  }
});

router.get("/weather/today-timeline", async (req, res): Promise<void> => {
  const parsed = weatherQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "lat and lon are required" });
    return;
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${parsed.data.lat}&longitude=${parsed.data.lon}` +
      `&hourly=temperature_2m,weathercode,precipitation_probability` +
      `&forecast_days=2&timezone=auto`;

    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      throw new Error(`Open-Meteo ${response.status}`);
    }

    const data = (await response.json()) as {
      hourly: {
        time: string[];
        temperature_2m: number[];
        weathercode: number[];
        precipitation_probability: number[];
      };
    };

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

    const slots = data.hourly.time
      .map((time, index) => {
        const probability = data.hourly.precipitation_probability[index] ?? 0;
        const weathercode = data.hourly.weathercode[index] ?? 0;
        const willRain = probability >= 50 || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weathercode);
        const slotTime = new Date(time);

        return {
          time,
          hour: slotTime.getHours(),
          label: slotTime.toLocaleTimeString("en-KE", { hour: "numeric", hour12: true }),
          temperature: Math.round(data.hourly.temperature_2m[index] ?? 20),
          probability: willRain ? Math.max(probability, 60) : probability,
          willRain,
          weathercode,
          isNow: slotTime.getHours() === now.getHours() && time.slice(0, 10) === today,
          date: time.slice(0, 10),
        };
      })
      .filter((slot) => new Date(slot.time) >= currentHour && slot.date === today)
      .map(({ date: _date, ...slot }) => slot);

    res.json({ slots });
  } catch (error) {
    req.log?.error({ err: error }, "Today timeline fetch failed");
    res.status(500).json({ error: "Failed to fetch today timeline." });
  }
});

router.get("/weather/community", async (req, res): Promise<void> => {
  const parsed = weatherQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "lat and lon query params required" });
    return;
  }

  const { lat, lon } = parsed.data;
  const radiusDegrees = 0.135;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  const feedback = getNearbyRecords(await listFeedbackRecords(), lat, lon, radiusDegrees)
    .filter((entry) => entry.createdAt.getTime() >= thirtyDaysAgo);

  const uniqueZones = new Set(
    feedback.map((entry) => `${Math.round(entry.latitude * 100) / 100},${Math.round(entry.longitude * 100) / 100}`),
  );

  const recent = feedback.filter((entry) => entry.createdAt.getTime() >= oneDayAgo);
  const predictions = getNearbyRecords(await listPredictionRecords(), lat, lon, radiusDegrees)
    .filter((entry) => entry.isCorrect !== null);

  const correct = predictions.filter((entry) => entry.isCorrect === true).length;
  const zoneAccuracy = predictions.length > 0
    ? Number(((correct / predictions.length) * 100).toFixed(1))
    : null;

  res.json({
    farmerCount: uniqueZones.size,
    feedbackCount: feedback.length,
    recentReports: {
      rain: recent.filter((entry) => entry.answer === "yes").length,
      dry: recent.filter((entry) => entry.answer === "no").length,
      cloudy: recent.filter((entry) => entry.answer === "almost").length,
      total: recent.length,
    },
    zoneAccuracy,
    communityBoost: feedback.length >= 3,
    zoneRadiusKm: 15,
  });
});

router.get("/weather/planting-advisory", async (req, res): Promise<void> => {
  const parsed = weatherQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const forecast = await fetchForecast(parsed.data.lat, parsed.data.lon);
    const rainDaysAhead = forecast.days.filter((day) => day.precipitationProbability >= 40 || day.precipitationSum >= 2).length;
    let longestDryGap = 0;
    let currentDryGap = 0;

    for (const day of forecast.days) {
      const isDry = day.precipitationProbability < 30 && day.precipitationSum < 1.5;
      currentDryGap = isDry ? currentDryGap + 1 : 0;
      longestDryGap = Math.max(longestDryGap, currentDryGap);
    }

    const season = getSeason(new Date().getMonth() + 1);
    const historicalRainRate = season === "off-season" ? 25 : season === "long-rains" ? 58 : 48;

    let status: "safe" | "watch" | "caution" | "danger" = "watch";
    if (rainDaysAhead >= 5 && longestDryGap <= 2 && season !== "off-season") {
      status = "safe";
    } else if (rainDaysAhead <= 1 || longestDryGap >= 5) {
      status = "danger";
    } else if (longestDryGap >= 3 || season === "off-season") {
      status = "caution";
    }

    const messages = {
      safe: {
        headlineEn: "Rains look established. Planting conditions are favorable.",
        headlineSw: "Mvua zinaonekana kuanza vizuri. Kupanda kunafaa.",
        headlineKi: "Mbura nicioonekanagia ciambiririe wega. Guthiga nikwega.",
        reasonEn: "Multiple wet days are forecast with no long dry break, which lowers the risk of a false onset.",
        reasonSw: "Siku kadhaa za mvua zinatarajiwa bila pengo refu la ukame, hivyo hatari ya mvua ya uongo ni ndogo.",
        reasonKi: "Matuku maingi ma mbura ni magurukirwo na gutiri gapu ndaihu ya ukau.",
        actionEn: "Plant now and prioritize seedbed preparation, fertilizer placement, and early weed control.",
        actionSw: "Panda sasa na uanze maandalizi ya shamba, kuweka mbolea, na kudhibiti magugu mapema.",
        actionKi: "Thiga riu na utegere guhanda, guhe mbembe, na kugura thangu.",
      },
      watch: {
        headlineEn: "Promising rain signal, but wait for more confirmation.",
        headlineSw: "Dalili za mvua ni nzuri, lakini subiri uthibitisho zaidi.",
        headlineKi: "Hariri na kimenyetio kiega gia mbura, no urie mbere.",
        reasonEn: "Some rain is forecast, but the pattern is not yet strong enough to rule out a short dry pause.",
        reasonSw: "Mvua fulani zinatarajiwa, lakini mtiririko wake bado haujathibitisha kuwa wa kudumu.",
        reasonKi: "Mbura ni ikurukirwo, no muthirigu wayo ndurikiria muno kugia ndangithia.",
        actionEn: "Prepare land and inputs now, and plant only short-season crops if you must move early.",
        actionSw: "Andaa shamba na pembejeo sasa, na panda mazao ya muda mfupi pekee ukilazimika kuanza mapema.",
        actionKi: "Tegera mugunda na indo ciaku riu, na wikie maciaro ma ihinda inini.",
      },
      caution: {
        headlineEn: "Rain pattern is patchy. Plant carefully.",
        headlineSw: "Mvua si thabiti. Panda kwa tahadhari.",
        headlineKi: "Muthirigu wa mbura nduri kimwe. Thiga na uhoro.",
        reasonEn: "Forecast rain is fragmented or the season is weak, which raises the risk of seedlings drying out.",
        reasonSw: "Mvua zinazotarajiwa zimegawanyika au msimu bado ni dhaifu, hivyo miche inaweza kukauka.",
        reasonKi: "Mbura iria itarikirwo ni igaanite kana mwaka nduhinya.",
        actionEn: "Wait if possible. If planting is urgent, use drought-tolerant crops and conserve soil moisture.",
        actionSw: "Subiri ikiwezekana. Ikiwa lazima upande, tumia mazao yanayostahimili ukame na hifadhi unyevu wa udongo.",
        actionKi: "Rinda kana no uhotane. Angikorwo no nginya uthige, huthura maciaro maria magutiga ukau.",
      },
      danger: {
        headlineEn: "Do not plant yet. False onset risk is high.",
        headlineSw: "Usipande bado. Hatari ya mvua ya uongo ni kubwa.",
        headlineKi: "Ndugithige riu. Hatari ya mbura ya maheani ni nene.",
        reasonEn: "Very few rain days are expected or a long dry gap is likely, so young crops may fail after emergence.",
        reasonSw: "Siku chache sana za mvua zinatarajiwa au kuna pengo refu la ukame mbele, hivyo miche inaweza kufa baada ya kuota.",
        reasonKi: "Matuku manini ma mbura ni marikirwo kana hari na gapu ndaihu ya ukau.",
        actionEn: "Hold seed in store, monitor the next forecast update, and avoid exposing seedlings to a dry spell.",
        actionSw: "Hifadhi mbegu kwanza, fuatilia utabiri unaofuata, na usiweke miche kwenye hatari ya ukame.",
        actionKi: "Ruta mbembe mbere na urore utabiri uku, na ndukahe mbembe hari ukau.",
      },
    } as const;

    res.json({
      status,
      rainDaysAhead,
      longestDryGap,
      historicalRainRate,
      season,
      ...messages[status],
    });
  } catch (error) {
    req.log?.error({ err: error }, "Planting advisory failed");
    res.status(500).json({ error: "Failed to compute planting advisory." });
  }
});

export default router;
