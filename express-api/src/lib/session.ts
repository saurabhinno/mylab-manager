import bcrypt from "bcryptjs";
import { Response } from "express";

const COOKIE_NAME = "mylab_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 * 1000; // 7 days in milliseconds

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function setSessionCookie(res: Response, userId: number) {
  res.cookie(COOKIE_NAME, String(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
