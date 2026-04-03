import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/schedulerService.js";
import { addLocation, getActiveLocations } from "./lib/locationService.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Seed a default Nakuru Farm location if no locations exist yet.
  // This ensures the hourly scheduler has somewhere to collect data from
  // on a fresh deployment.
  try {
    const locations = await getActiveLocations();
    if (locations.length === 0) {
      await addLocation("Nakuru Farm", -0.3031, 36.08);
      logger.info("Seeded default location: Nakuru Farm");
    }
  } catch (seedErr) {
    logger.warn({ err: seedErr }, "Could not seed default location");
  }

  // Start hourly collection scheduler
  startScheduler(logger);
});
