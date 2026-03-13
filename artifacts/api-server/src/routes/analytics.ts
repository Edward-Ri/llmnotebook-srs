import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/heatmap", (_req, res) => {
  res.status(501).json({
    error: "NOT_IMPLEMENTED",
    message: "Analytics endpoints are deprecated in the SQL-new schema.",
  });
});

export default router;
