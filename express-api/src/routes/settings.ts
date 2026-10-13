import { Router, Request, Response } from "express";
import { LabSettings } from "@/models/LabSettings";
import { requireDoctor } from "@/lib/auth";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const settings = await LabSettings.findOne();
    return res.json(settings || {});
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", requireDoctor, async (req: Request, res: Response) => {
  try {
    const { lab_name, address, phone, email, header_text, footer_text, logo_image } = req.body;
    let settings = await LabSettings.findOne();
    if (!settings) {
      settings = await LabSettings.create({ lab_name: lab_name || "MyLab" });
    }

    if (lab_name !== undefined) settings.lab_name = lab_name;
    if (address !== undefined) settings.address = address;
    if (phone !== undefined) settings.phone = phone;
    if (email !== undefined) settings.email = email;
    if (header_text !== undefined) settings.header_text = header_text;
    if (footer_text !== undefined) settings.footer_text = footer_text;

    // Handle logo - store as base64 directly in DB
    if (logo_image === null) {
      settings.logo_path = null;
    } else if (logo_image && logo_image.startsWith("data:image/")) {
      settings.logo_path = logo_image;
    }

    await settings.save();
    return res.json(settings);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
