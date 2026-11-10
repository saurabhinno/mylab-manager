import bcrypt from "bcryptjs";
import { Response } from "express";

const COOKIE_NAME = "mylab_session";

/** Stay signed in across app restarts until local midnight. */
function msUntilEndOfLocalDay(now = new Date()) {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return Math.max(end.getTime() - now.getTime(), 60 * 1000);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function cookieSecure() {
  // Desktop runs on local HTTP; secure cookies would never be stored.
  if (process.env.DESKTOP === "1") return false;
  return process.env.NODE_ENV === "production";
}

export function setSessionCookie(res: Response, userId: number) {
  res.cookie(COOKIE_NAME, String(userId), {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: msUntilEndOfLocalDay(),
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
  });
}

export function getUserIdFromCookie(cookies: any): number | null {
  const session = cookies[COOKIE_NAME];
  if (!session) return null;
  const userId = Number(session);
  return userId || null;
}
