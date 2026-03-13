import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.all(["/", "/:id"], (_req, res) => {
  res.status(501).json({
    error: "NOT_IMPLEMENTED",
    message: "Deck endpoints are deprecated in the SQL-new schema. Use decks tree + flashcards.",
  });
});

export default router;
