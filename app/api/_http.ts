import { NextResponse } from "next/server";
import { StoreUnavailable } from "@/lib/store";

export const noStore = { "Cache-Control": "no-store" };

export function fail(err: unknown) {
  if (err instanceof StoreUnavailable) return NextResponse.json({ error: err.message }, { status: 503, headers: noStore });
  console.error("[api]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500, headers: noStore });
}
