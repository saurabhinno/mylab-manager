import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { User } from "@/models/User";
import { verifyPassword, hashPassword, setSessionCookie, clearSessionCookie } from "@/lib/session";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    setSessionCookie(res, user.id);
    return res.json({ 
      success: true, 
      redirect: user.role === "doctor" ? "/doctor/dashboard" : "/compounder/reports" 
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/register", async (req: Request, res: Response) => {
  const { email, password, role } = req.body;
  
  if (!email || !password || !role) {
    return res.status(400).json({ error: "Email, password, and role are required." });
  }

  try {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Email already registered." });
    }

    const password_hash = await hashPassword(password);
    await User.create({ email, password_hash, role, signature_image: null });
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (req: Request, res: Response) => {
  clearSessionCookie(res);
  return res.json({ success: true });
});

// Get all users (staff list)
router.get("/users", async (req: Request, res: Response) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "email", "name", "role", "createdAt"],
      order: [["createdAt", "DESC"]],
    });
    return res.json(users);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update profile (name + signature)
router.put("/profile/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, signature_image } = req.body;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    if (name !== undefined) user.name = name;

    // Handle signature file upload (base64 → file on disk)
    if (signature_image === null) {
      // Remove old file if exists
      if (user.signature_image) {
        const oldPath = path.join(__dirname, "../../uploads", user.signature_image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      user.signature_image = null;
    } else if (signature_image && signature_image.startsWith("data:image/")) {
      // Save base64 to file
      const uploadsDir = path.join(__dirname, "../../uploads/signatures");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const matches = signature_image.match(/^data:image\/(png|jpeg|webp|jpg);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ error: "Invalid image format." });
      }
      const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      const filename = `signature_${id}_${Date.now()}.${ext}`;
      const filePath = path.join(uploadsDir, filename);

      // Remove old file
      if (user.signature_image) {
        const oldPath = path.join(__dirname, "../../uploads", user.signature_image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      fs.writeFileSync(filePath, buffer);
      user.signature_image = `signatures/${filename}`;
    }

    await user.save();
    return res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, signature_image: user.signature_image },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get single user profile
router.get("/profile/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      attributes: ["id", "email", "name", "role", "signature_image"],
    });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Reset password (admin resets staff password)
router.put("/users/:id/password", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters." });
    }
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    user.password_hash = await hashPassword(password);
    await user.save();
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete user (staff)
router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    if (user.role === "doctor") {
      return res.status(400).json({ error: "Cannot delete doctor account." });
    }
    await user.destroy();
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
