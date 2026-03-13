import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.all(["/generate", "/pending", "/validate/batch", "/batch-assign-deck"], (_req, res) => {
  res.status(501).json({
    error: "NOT_IMPLEMENTED",
    message: "Cards endpoints are deprecated in the SQL-new schema. Use flashcards instead.",
  });
});

export default router;
