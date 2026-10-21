import "server-only";
import type { NextRequest, NextResponse } from "next/server";

export const VISITOR_COOKIE = "lb_vid";

/** Anonymous random ID in a cookie. It identifies a browser, not a person, and is only used to dedupe votes and download counts. */
export function getVisitor(req: NextRequest): { id: string; isNew: boolean } {
  const existing = req.cookies.get(VISITOR_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return { id: existing, isNew: false };
  return { id: crypto.randomUUID(), isNew: true };
}

export function setVisitorCookie<T extends NextResponse>(res: T, v: { id: string; isNew: boolean }): T {
  if (v.isNew) {
    res.cookies.set(VISITOR_COOKIE, v.id, {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365, secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
