import { NextResponse, type NextRequest } from "next/server";

import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

/** POST only, so a stray link preview can never log her out. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const origin = siteUrl(request.nextUrl.origin);

  return NextResponse.redirect(new URL("/login", origin), { status: 303 });
}
