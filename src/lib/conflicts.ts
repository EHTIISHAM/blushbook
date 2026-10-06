import "server-only";

import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Ids of upcoming bookings that no longer fit their staff member's hours,
 *  days off or services. Changes never cancel bookings; they get flagged. */
export async function upcomingConflictIds(supabase: Client): Promise<Set<string>> {
  const { data } = await supabase.rpc("upcoming_conflicts");
  return new Set((data ?? []).map((row) => row.booking_id));
}

/** A line to add after a save, when that save left bookings stranded. */
export async function conflictNote(supabase: Client): Promise<string> {
  const count = (await upcomingConflictIds(supabase)).size;
  if (count === 0) return "";
  return ` ${count} upcoming booking${count === 1 ? " no longer fits" : "s no longer fit"} — check the Bookings tab.`;
}
