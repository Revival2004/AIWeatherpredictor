import { Router, type IRouter } from "express";
import { db, weatherDataTable } from "@workspace/db";
import { desc, eq, and, gte, lte, sql, count, avg } from "drizzle-orm";
import { fetchWeather } from "../lib/weatherService.js";
import { predict } from "../lib/aiService.js";
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
 * Fetches real-time weather, runs AI prediction, stores to DB, returns result.
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

  // Run AI prediction
  const aiResult = predict({
    temperature: weatherData.temperature,
    windspeed: weatherData.windspeed,
    humidity: weatherData.humidity,
    pressure: weatherData.pressure,
    weathercode: weatherData.weathercode,
  });

  // Store in database for historical analysis and future ML training
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
    },
    location: { lat, lon },
    recordId,
  });

  req.log.info(
    { lat, lon, prediction: aiResult.prediction, confidence: aiResult.confidence },
    "Weather prediction completed"
  );

  res.json(response);
});

/**
 * GET /weather/history
 * Returns past weather readings from the database.
 * Structured for future ML training data extraction.
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

  // Optional location filter (within ~0.5 degree radius)
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
 * Returns aggregated statistics for the weather dashboard.
 * Useful for understanding local climate patterns over time.
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

  // Build prediction breakdown
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
