import { Router, Request, Response } from "express";
import { User } from "@/models/User";
import { verifyPassword, hashPassword, setSessionCookie, clearSessionCookie, getUserIdFromCookie } from "@/lib/session";
import { requireDoctor } from "@/lib/auth";

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
  const { email, password, role, name } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: "Email, password, and role are required." });
  }
  if (role !== "doctor" && role !== "compounder") {
    return res.status(400).json({ error: "Role must be doctor or compounder." });
  }
  if (String(password).length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters." });
  }

  try {
    // Only a logged-in doctor can create staff accounts
    const actorId = getUserIdFromCookie(req.cookies);
    if (!actorId) return res.status(401).json({ error: "Not authenticated" });
    const actor = await User.findByPk(actorId);
    if (!actor || actor.role !== "doctor") {
      return res.status(403).json({ error: "Only doctors can add staff." });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Email already registered." });
    }

    const password_hash = await hashPassword(password);
    await User.create({
      email,
      password_hash,
      role,
      name: name || null,
      signature_image: null,
    });
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

// Get current logged-in user
router.get("/me", async (req: Request, res: Response) => {
  const userId = getUserIdFromCookie(req.cookies);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  try {
    const user = await User.findByPk(userId, { attributes: ["id", "email", "name", "role"] });
    if (!user) return res.status(401).json({ error: "User not found" });
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get all users (staff list) — doctor only
router.get("/users", requireDoctor, async (req: Request, res: Response) => {
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

    // Handle signature - store as base64 directly in DB
    if (signature_image === null) {
      user.signature_image = null;
    } else if (signature_image && signature_image.startsWith("data:image/")) {
      user.signature_image = signature_image;
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

// Logged-in user changes their own password
router.put("/me/password", async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromCookie(req.cookies);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required." });
    }
    if (String(newPassword).length < 4) {
      return res.status(400).json({ error: "New password must be at least 4 characters." });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }

    user.password_hash = await hashPassword(newPassword);
    await user.save();
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Doctor resets any user's password (forgot-password flow)
router.put("/users/:id/password", async (req: Request, res: Response) => {
  try {
    const actorId = getUserIdFromCookie(req.cookies);
    if (!actorId) return res.status(401).json({ error: "Not authenticated" });
    const actor = await User.findByPk(actorId);
    if (!actor || actor.role !== "doctor") {
      return res.status(403).json({ error: "Only doctors can reset passwords." });
    }

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

// Delete user (staff) — doctors can remove compounders or other doctors (not themselves / last doctor)
router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    const actorId = getUserIdFromCookie(req.cookies);
    if (!actorId) return res.status(401).json({ error: "Not authenticated" });
    const actor = await User.findByPk(actorId);
    if (!actor || actor.role !== "doctor") {
      return res.status(403).json({ error: "Only doctors can delete staff." });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    if (user.id === actor.id) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }
    if (user.role === "doctor") {
      const doctorCount = await User.count({ where: { role: "doctor" } });
      if (doctorCount <= 1) {
        return res.status(400).json({ error: "Cannot delete the last doctor account." });
      }
    }
    await user.destroy();
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
