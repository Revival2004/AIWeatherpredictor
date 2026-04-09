import { Router, type IRouter } from "express";

const router: IRouter = Router();
const ML_MODE = process.env.ML_SERVICE_URL ? "remote-python" : "fallback";

router.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    service: "farmpal-api-server",
    mlMode: ML_MODE,
    timestamp: new Date().toISOString(),
  });
});

export default router;
