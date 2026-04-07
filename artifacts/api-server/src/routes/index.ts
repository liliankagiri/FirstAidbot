import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import hospitalsRouter from "./hospitals";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(hospitalsRouter);

export default router;
