import { Router, type IRouter } from "express";
import { getAdminAuthStatus } from "../lib/adminAuth.js";
import { getFarmerAuthStatus } from "../lib/farmerAuth.js";
import { getStoreHealth } from "../lib/store.js";

const router: IRouter = Router();
const ML_MODE = process.env.ML_SERVICE_URL ? "remote-python" : "fallback";

router.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    service: "farmpal-api-server",
    mlMode: ML_MODE,
    auth: {
      admin: getAdminAuthStatus(),
      farmer: getFarmerAuthStatus(),
    },
    store: getStoreHealth(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
