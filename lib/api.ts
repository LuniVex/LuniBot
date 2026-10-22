import "server-only";
import { NextResponse } from "next/server";
import { StoreNotConfigured } from "./store";

export const noStore = { "Cache-Control": "no-store" };

export const notFound = () => NextResponse.json({ error: "No bot with that name." }, { status: 404, headers: noStore });

export function failed(err: unknown) {
  if (err instanceof StoreNotConfigured) return NextResponse.json({ error: err.message }, { status: 503, headers: noStore });
  console.error("[api]", err);
  return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500, headers: noStore });
}
