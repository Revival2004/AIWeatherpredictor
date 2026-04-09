import app from "./app.js";
import { logger } from "./lib/logger.js";
import { startScheduler } from "./lib/schedulerRuntime.js";

const port = Number(process.env.PORT || 5000);

const server = app.listen(port, async () => {
  logger.info({ port }, "Server listening");

  // Start hourly collection scheduler
  startScheduler(logger);
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
