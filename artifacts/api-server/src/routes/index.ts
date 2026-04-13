import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import hospitalsRouter from "./hospitals";
import whatsappRouter from "./whatsapp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(hospitalsRouter);
router.use(whatsappRouter);

export default router;
