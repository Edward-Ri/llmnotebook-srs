import { Router, type IRouter } from "express";
import healthRouter from "./health";
import documentsRouter from "./documents";
import cardsRouter from "./cards";
import reviewsRouter from "./reviews";
import analyticsRouter from "./analytics";
import authRouter from "./auth";
import decksRouter from "./decks";
import referencesRouter from "./references";
import notesRouter from "./notes";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use(referencesRouter);
router.use(notesRouter);
router.use("/documents", documentsRouter);
router.use("/cards", cardsRouter);
router.use("/reviews", reviewsRouter);
router.use("/analytics", analyticsRouter);
router.use("/decks", decksRouter);

export default router;
