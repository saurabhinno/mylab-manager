import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { LabSettings } from "@/models/LabSettings";

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

router.put("/", async (req: Request, res: Response) => {
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

    // Handle logo upload
    if (logo_image === null) {
      if (settings.logo_path) {
        const oldPath = path.join(__dirname, "../../uploads", settings.logo_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      settings.logo_path = null;
    } else if (logo_image && logo_image.startsWith("data:image/")) {
      const uploadsDir = path.join(__dirname, "../../uploads/logos");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const matches = logo_image.match(/^data:image\/(png|jpeg|webp|jpg);base64,(.+)$/);
      if (matches) {
        const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
        const buffer = Buffer.from(matches[2], "base64");
        const filename = `logo_${Date.now()}.${ext}`;
        if (settings.logo_path) {
          const oldPath = path.join(__dirname, "../../uploads", settings.logo_path);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        fs.writeFileSync(path.join(uploadsDir, filename), buffer);
        settings.logo_path = `logos/${filename}`;
      }
    }

    await settings.save();
    return res.json(settings);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
