import app from "./app.js";
import { logger } from "./lib/logger.js";
import { startScheduler } from "./lib/schedulerRuntime.js";
import { initializeStore } from "./lib/store.js";

const port = Number(process.env.PORT || 5000);

async function bootstrap(): Promise<void> {
  const server = app.listen(port, async () => {
    logger.info({ port }, "Server listening");

    try {
      const store = await initializeStore();
      logger.info({ store }, "Data store ready");
      startScheduler(logger);
    } catch (err) {
      logger.error({ err }, "Failed to initialize data store");
    }
  });

  server.on("error", (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
}

void bootstrap();
