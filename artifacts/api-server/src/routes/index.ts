import { Router, type IRouter } from "express";
import adminRouter from "./admin.js";
import healthRouter from "./health.js";
import weatherRouter from "./renderWeather.js";
import locationsRouter from "./renderLocations.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(weatherRouter);
router.use(locationsRouter);

export default router;
