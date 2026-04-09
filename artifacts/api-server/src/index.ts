import app from "./app.js";
import { logger } from "./lib/logger.js";
import { startScheduler } from "./lib/schedulerRuntime.js";
import { addLocation, getActiveLocations } from "./lib/locationService.js";

const port = Number(process.env.PORT || 5000);

const server = app.listen(port, async () => {
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

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
