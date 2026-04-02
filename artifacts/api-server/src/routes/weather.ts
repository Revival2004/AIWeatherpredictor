import { Router, type IRouter } from "express";
import { db, weatherDataTable, weatherPredictionsTable, farmerFeedbackTable } from "@workspace/db";
import { desc, eq, and, gte, lte, sql, count, avg } from "drizzle-orm";
import { fetchWeather } from "../lib/weatherService.js";
import { predictWithHistory, type HistoricalRecord } from "../lib/aiService.js";
import { fetchForecast } from "../lib/forecastService.js";
import { generateAlerts } from "../lib/alertsService.js";
import { collectAllLocations } from "../lib/schedulerService.js";
import { getPredictionAccuracy } from "../lib/feedbackService.js";
import { trainModel, predictRain, loadModel } from "../lib/mlService.js";
import {
  GetWeatherQueryParams,
  GetWeatherResponse,
  GetWeatherHistoryQueryParams,
  GetWeatherHistoryResponse,
  GetWeatherStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * GET /weather
 * Fetches real-time weather, runs adaptive AI prediction (kNN + rules),
 * stores to DB, returns result. The AI learns from accumulated readings.
 */
router.get("/weather", async (req, res): Promise<void> => {
  const parsed = GetWeatherQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { lat, lon } = parsed.data;

  let weatherData;
  try {
    weatherData = await fetchWeather(lat, lon);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch weather from Open-Meteo");
    res.status(500).json({ error: "Failed to fetch weather data. Please try again." });
    return;
  }

  // Fetch recent historical records to enable pattern learning.
  // We use the last 100 readings globally (not location-filtered) so the AI
  // can learn from any accumulated data, even from different locations.
  let history: HistoricalRecord[] = [];
  try {
    const rows = await db
      .select({
        temperature: weatherDataTable.temperature,
        windspeed: weatherDataTable.windspeed,
        humidity: weatherDataTable.humidity,
        pressure: weatherDataTable.pressure,
        weathercode: weatherDataTable.weathercode,
        prediction: weatherDataTable.prediction,
        confidence: weatherDataTable.confidence,
      })
      .from(weatherDataTable)
      .orderBy(desc(weatherDataTable.createdAt))
      .limit(100);

    history = rows.map((r) => ({
      temperature: r.temperature,
      windspeed: r.windspeed,
      humidity: r.humidity,
      pressure: r.pressure,
      weathercode: r.weathercode,
      prediction: r.prediction,
      confidence: r.confidence,
    }));
  } catch (err) {
    // Non-fatal — fall back to pure rule-based if history fetch fails
    req.log.warn({ err }, "Could not fetch history for pattern learning, using rules only");
  }

  // Run adaptive AI prediction (blends rules + kNN patterns from history)
  const aiResult = predictWithHistory(
    {
      temperature: weatherData.temperature,
      windspeed: weatherData.windspeed,
      humidity: weatherData.humidity,
      pressure: weatherData.pressure,
      weathercode: weatherData.weathercode,
    },
    history
  );

  // Store in database
  let recordId: number;
  try {
    const [stored] = await db
      .insert(weatherDataTable)
      .values({
        latitude: lat,
        longitude: lon,
        temperature: weatherData.temperature,
        windspeed: weatherData.windspeed,
        humidity: weatherData.humidity,
        pressure: weatherData.pressure,
        weathercode: weatherData.weathercode,
        prediction: aiResult.prediction,
        confidence: aiResult.confidence,
        reasoning: aiResult.reasoning,
      })
      .returning({ id: weatherDataTable.id });
    recordId = stored.id;
  } catch (err) {
    req.log.error({ err }, "Failed to store weather data");
    res.status(500).json({ error: "Failed to store weather data." });
    return;
  }

  const response = GetWeatherResponse.parse({
    weather: {
      temperature: weatherData.temperature,
      windspeed: weatherData.windspeed,
      humidity: weatherData.humidity,
      pressure: weatherData.pressure,
      weathercode: weatherData.weathercode,
      time: weatherData.time,
    },
    prediction: {
      prediction: aiResult.prediction,
      confidence: aiResult.confidence,
      reasoning: aiResult.reasoning,
      dataPoints: aiResult.dataPoints,
      modelVersion: aiResult.modelVersion,
    },
    location: { lat, lon },
    recordId,
  });

  req.log.info(
    {
      lat,
      lon,
      prediction: aiResult.prediction,
      confidence: aiResult.confidence,
      dataPoints: aiResult.dataPoints,
      modelVersion: aiResult.modelVersion,
    },
    "Weather prediction completed"
  );

  res.json(response);
});

/**
 * GET /weather/history
 * Returns past weather readings from the database.
 */
router.get("/weather/history", async (req, res): Promise<void> => {
  const parsed = GetWeatherHistoryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 20, lat, lon } = parsed.data;

  let query = db
    .select()
    .from(weatherDataTable)
    .orderBy(desc(weatherDataTable.createdAt))
    .limit(limit);

  if (lat !== undefined && lon !== undefined) {
    query = db
      .select()
      .from(weatherDataTable)
      .where(
        and(
          gte(weatherDataTable.latitude, lat - 0.5),
          lte(weatherDataTable.latitude, lat + 0.5),
          gte(weatherDataTable.longitude, lon - 0.5),
          lte(weatherDataTable.longitude, lon + 0.5)
        )
      )
      .orderBy(desc(weatherDataTable.createdAt))
      .limit(limit);
  }

  const records = await query;

  const response = GetWeatherHistoryResponse.parse(
    records.map((r) => ({
      id: r.id,
      latitude: r.latitude,
      longitude: r.longitude,
      temperature: r.temperature,
      windspeed: r.windspeed,
      humidity: r.humidity,
      pressure: r.pressure,
      weathercode: r.weathercode,
      prediction: r.prediction,
      confidence: r.confidence,
      reasoning: r.reasoning,
      createdAt: r.createdAt,
    }))
  );

  res.json(response);
});

/**
 * GET /weather/forecast
 * Returns a 7-day farm forecast with field scores, GDD, and action cards.
 */
router.get("/weather/forecast", async (req, res): Promise<void> => {
  const parsed = GetWeatherQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { lat, lon } = parsed.data;

  try {
    const forecast = await fetchForecast(lat, lon);
    res.json(forecast);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch forecast");
    res.status(500).json({ error: "Failed to fetch forecast data." });
  }
});

/**
 * GET /weather/alerts
 * Returns prioritized crop and weather alerts for the next 72–168 hours.
 */
router.get("/weather/alerts", async (req, res): Promise<void> => {
  const parsed = GetWeatherQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { lat, lon } = parsed.data;

  try {
    const forecast = await fetchForecast(lat, lon);
    const alertsResult = generateAlerts(forecast);
    res.json(alertsResult);
  } catch (err) {
    req.log.error({ err }, "Failed to generate alerts");
    res.status(500).json({ error: "Failed to generate weather alerts." });
  }
});

/**
 * GET /weather/stats
 * Returns aggregated statistics for the analytics dashboard.
 */
router.get("/weather/stats", async (req, res): Promise<void> => {
  const [aggregates] = await db
    .select({
      totalReadings: count(weatherDataTable.id),
      avgTemperature: avg(weatherDataTable.temperature),
      avgWindspeed: avg(weatherDataTable.windspeed),
      avgHumidity: avg(weatherDataTable.humidity),
      lastReading: sql<string | null>`MAX(${weatherDataTable.createdAt})`,
    })
    .from(weatherDataTable);

  const predictionRows = await db
    .select({
      prediction: weatherDataTable.prediction,
      count: count(weatherDataTable.id),
    })
    .from(weatherDataTable)
    .groupBy(weatherDataTable.prediction);

  const predictionBreakdown: Record<string, number> = {};
  for (const row of predictionRows) {
    predictionBreakdown[row.prediction] = row.count;
  }

  const response = GetWeatherStatsResponse.parse({
    totalReadings: aggregates.totalReadings,
    avgTemperature: aggregates.avgTemperature ? Number(aggregates.avgTemperature) : null,
    avgWindspeed: aggregates.avgWindspeed ? Number(aggregates.avgWindspeed) : null,
    avgHumidity: aggregates.avgHumidity ? Number(aggregates.avgHumidity) : null,
    predictionBreakdown,
    lastReading: aggregates.lastReading ?? null,
  });

  res.json(response);
});

/**
 * POST /collect
 * Manually trigger weather collection for all active tracked locations.
 * The hourly scheduler runs this automatically; this endpoint is for on-demand use.
 */
router.post("/collect", async (req, res): Promise<void> => {
  try {
    const results = await collectAllLocations(req.log);
    const successful = results.filter((r) => r.success).length;
    res.json({
      collected: successful,
      total: results.length,
      results,
    });
  } catch (err) {
    req.log.error({ err }, "Manual collection failed");
    res.status(500).json({ error: "Failed to collect weather data." });
  }
});

/**
 * GET /metrics
 * Returns prediction accuracy metrics and model status.
 */
router.get("/metrics", async (req, res): Promise<void> => {
  try {
    const accuracy = await getPredictionAccuracy();
    const model = loadModel();

    // Count total tracked predictions
    const [predCount] = await db
      .select({ count: count(weatherPredictionsTable.id) })
      .from(weatherPredictionsTable);

    const [obsCount] = await db
      .select({ count: count(weatherDataTable.id) })
      .from(weatherDataTable);

    res.json({
      predictions: {
        total: Number(predCount.count),
        resolved: accuracy.total,
        correct: accuracy.correct,
        accuracy: accuracy.accuracy,
      },
      model: model
        ? {
            version: model.version,
            trainedAt: model.trainedAt,
            trainingSamples: model.trainingSamples,
            accuracy: model.accuracy,
            lrAccuracy: model.lrAccuracy ?? null,
            rfAccuracy: model.rfAccuracy ?? null,
            gbAccuracy: model.gbAccuracy ?? null,
          }
        : null,
      observations: Number(obsCount.count),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch metrics");
    res.status(500).json({ error: "Failed to fetch metrics." });
  }
});

/**
 * POST /train
 * Retrain the ML model on all historical data.
 * Returns training summary including samples used and accuracy.
 */
router.post("/train", async (req, res): Promise<void> => {
  try {
    const result = await trainModel(req.log);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Model training failed");
    res.status(500).json({ error: "Model training failed." });
  }
});

/**
 * POST /bootstrap
 * One-time operation: fetch 12 months of Open-Meteo historical data for 8 Kenyan
 * farming regions, build labeled pairs, and train the ensemble — so predictions
 * work from day one before real farm data has been collected.
 */
router.post("/bootstrap", async (req, res): Promise<void> => {
  try {
    const mlUrl = process.env.ML_SERVICE_URL ?? "http://localhost:5000";
    req.log.info({ req: { id: (req as any).id, method: req.method, url: req.path } },
      "Forwarding bootstrap request to Python sklearn service");

    const body = req.body && Object.keys(req.body).length ? req.body : {};
    const response = await fetch(`${mlUrl}/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5 * 60 * 1000),   // 5-min timeout — fetching ~8 locations
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json(data);
      return;
    }
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Bootstrap failed");
    res.status(500).json({ error: "Bootstrap failed. Check ML service and network access." });
  }
});

/**
 * GET /weather/rain
 * Returns a rain prediction (yes/no + confidence) for a given lat/lon
 * using the current weather conditions and the trained ML model.
 */
router.get("/weather/rain", async (req, res): Promise<void> => {
  const parsed = GetWeatherQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { lat, lon } = parsed.data;

  let weatherData;
  try {
    weatherData = await fetchWeather(lat, lon);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch weather for rain prediction");
    res.status(500).json({ error: "Failed to fetch current weather." });
    return;
  }

  const prediction = await predictRain(
    weatherData.temperature,
    weatherData.humidity,
    weatherData.pressure,
    weatherData.windspeed,
    weatherData.weathercode,
    new Date(),
    lat,
    lon,
    weatherData.elevation,
  );

  // Optionally store this prediction for the feedback loop
  const targetTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
  try {
    await db.insert(weatherPredictionsTable).values({
      latitude: lat,
      longitude: lon,
      predictedAt: new Date(),
      targetTime,
      predictionType: "rain_2h",
      predictionValue: prediction.predictionValue,
      confidence: prediction.confidence,
      modelVersion: prediction.modelVersion,
    });
  } catch {
    // Non-fatal: still return the prediction
  }

  res.json({
    ...prediction,
    lat,
    lon,
    targetTime: targetTime.toISOString(),
    currentConditions: {
      temperature: weatherData.temperature,
      humidity: weatherData.humidity,
      pressure: weatherData.pressure,
      windspeed: weatherData.windspeed,
      weathercode: weatherData.weathercode,
    },
  });
});

/**
 * POST /feedback
 * Stores a farmer's ground-truth feedback (did it rain? was it cloudy?)
 * then automatically retrains the ML model in the background.
 * No manual "Train Model" button needed — the model improves after each response.
 */
router.post("/feedback", async (req, res): Promise<void> => {
  const parsed = (await import("zod")).z
    .object({
      lat: (await import("zod")).z.number(),
      lon: (await import("zod")).z.number(),
      question: (await import("zod")).z.enum(["rain", "cloudy", "wind"]),
      answer: (await import("zod")).z.enum(["yes", "no", "almost"]),
      locationName: (await import("zod")).z.string().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { lat, lon, question, answer, locationName } = parsed.data;

  try {
    await db.insert(farmerFeedbackTable).values({
      latitude: lat,
      longitude: lon,
      question,
      answer,
      locationName: locationName ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to store farmer feedback");
    res.status(500).json({ error: "Failed to store feedback." });
    return;
  }

  // Auto-retrain in background — farmer doesn't wait for this
  setImmediate(async () => {
    try {
      await trainModel(req.log);
      req.log.info({ lat, lon, question, answer }, "Auto-retrained after farmer feedback");
    } catch (err) {
      req.log.warn({ err }, "Auto-retrain after feedback failed (non-fatal)");
    }
  });

  res.json({ success: true, autoRetrained: true });
});

/**
 * GET /weather/storm-timeline
 * Returns a 6-hour 15-minute-interval precipitation timeline so the app can show
 * "Storm arriving in ~2h 15min" instead of a single static forecast number.
 */
router.get("/weather/storm-timeline", async (req, res): Promise<void> => {
  const parsed = (await import("zod")).z
    .object({
      lat: (await import("zod")).z.coerce.number(),
      lon: (await import("zod")).z.coerce.number(),
    })
    .safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ error: "lat and lon are required" });
    return;
  }

  const { lat, lon } = parsed.data;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&minutely_15=precipitation_probability,precipitation` +
      `&forecast_days=1&timezone=auto`;

    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);

    const raw = (await r.json()) as {
      minutely_15?: {
        time: string[];
        precipitation_probability: number[];
        precipitation: number[];
      };
    };

    const m = raw.minutely_15;
    if (!m || !m.time.length) {
      res.json({ slots: [], stormArrivalMinutes: null, stormDetected: false });
      return;
    }

    const now = Date.now();
    const THRESHOLD = 40;
    const slots = m.time
      .map((t, i) => ({
        time: t,
        probability: m.precipitation_probability[i] ?? 0,
        precipitation: m.precipitation[i] ?? 0,
      }))
      .filter((s) => new Date(s.time).getTime() >= now - 60_000)
      .slice(0, 24); // next 6 hours

    const firstRain = slots.find((s) => s.probability >= THRESHOLD);
    const stormArrivalMinutes = firstRain
      ? Math.round((new Date(firstRain.time).getTime() - now) / 60_000)
      : null;

    res.json({
      slots,
      stormArrivalMinutes,
      stormDetected: stormArrivalMinutes !== null && stormArrivalMinutes >= 0,
      stormSoon: stormArrivalMinutes !== null && stormArrivalMinutes <= 30,
    });
  } catch (err) {
    req.log.error({ err }, "Storm timeline fetch failed");
    res.status(500).json({ error: "Failed to fetch storm timeline." });
  }
});

export default router;
