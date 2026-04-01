import { Router, type IRouter } from "express";
import { db, weatherDataTable } from "@workspace/db";
import { desc, eq, and, gte, lte, sql, count, avg } from "drizzle-orm";
import { fetchWeather } from "../lib/weatherService.js";
import { predictWithHistory, type HistoricalRecord } from "../lib/aiService.js";
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

export default router;
