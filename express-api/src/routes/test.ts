import { Router, Request, Response } from "express";
import sequelize from "@/lib/sequelize";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    await sequelize.authenticate();
    return res.json({ success: true, message: "Database connected" });
  } catch (error) {
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

export default router;
