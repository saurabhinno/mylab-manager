import { Router, Request, Response } from "express";
import { Op } from "sequelize";
import { Patient } from "@/models/Patient";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || "";
    const patients = await Patient.findAll({
      where: {
        name: {
          [Op.like]: `%${query}%`,
        },
      },
      limit: 10,
    });
    return res.json(patients);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
