import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.all(["/due", "/log"], (_req, res) => {
  res.status(501).json({
    error: "NOT_IMPLEMENTED",
    message: "Review endpoints are deprecated in the SQL-new schema.",
  });
});

export default router;
