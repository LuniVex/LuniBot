import "server-only";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE = "lb_vid";

/**
 * Anonymous visitor ID: a random UUID in an httpOnly cookie. It identifies a browser, not a person,
 * and is only used to dedupe download counts and votes (copy-voice V8).
 */
export function visitorOf(req: NextRequest): { id: string; fresh: boolean } {
  const id = req.cookies.get(COOKIE)?.value;
  if (id && /^[0-9a-f-]{36}$/.test(id)) return { id, fresh: false };
  return { id: crypto.randomUUID(), fresh: true };
}

export function withVisitor<T extends NextResponse>(res: T, v: { id: string; fresh: boolean }): T {
  if (v.fresh) {
    res.cookies.set(COOKIE, v.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365, secure: process.env.NODE_ENV === "production" });
  }
  return res;
}
