import { Router, type IRouter } from "express";
import healthRouter from "./health";
import weatherRouter from "./weather";
import locationsRouter from "./locations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(weatherRouter);
router.use(locationsRouter);

export default router;
