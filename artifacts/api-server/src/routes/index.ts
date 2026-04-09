import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import weatherRouter from "./renderWeather.js";
import locationsRouter from "./renderLocations.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(weatherRouter);
router.use(locationsRouter);

export default router;
