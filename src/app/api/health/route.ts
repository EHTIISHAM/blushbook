import { NextResponse } from "next/server";

/**
 * Liveness probe for Coolify. Deliberately does not touch Supabase: this
 * answers "is the container serving?", not "is the database up". Tying the
 * two together would make Coolify restart a perfectly healthy app whenever
 * Supabase hiccupped.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
