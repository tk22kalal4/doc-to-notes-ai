import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ttsRouter from "./tts";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/tts", ttsRouter);

export default router;

