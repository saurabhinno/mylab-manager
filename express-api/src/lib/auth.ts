import { Request, Response, NextFunction } from "express";
import { User } from "@/models/User";
import { getUserIdFromCookie } from "@/lib/session";

export async function getActor(req: Request) {
  const userId = getUserIdFromCookie(req.cookies);
  if (!userId) return null;
  return User.findByPk(userId);
}

/** Require any logged-in user */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ error: "Not authenticated" });
    (req as any).user = actor;
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** Doctor-only routes (tests catalogue, staff, lab settings writes, etc.) */
export async function requireDoctor(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ error: "Not authenticated" });
    if (actor.role !== "doctor") {
      return res.status(403).json({ error: "Only doctors can perform this action." });
    }
    (req as any).user = actor;
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
