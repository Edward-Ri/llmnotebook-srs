import { Router, type IRouter } from "express";
import healthRouter from "./health";
import documentsRouter from "./documents";
import cardsRouter from "./cards";
import reviewsRouter from "./reviews";
import analyticsRouter from "./analytics";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/documents", documentsRouter);
router.use("/cards", cardsRouter);
router.use("/reviews", reviewsRouter);
router.use("/analytics", analyticsRouter);

export default router;
