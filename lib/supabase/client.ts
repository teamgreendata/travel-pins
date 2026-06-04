import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client (uses the anon/publishable key only).
 * `db.schema` points every `.from(...)` call at the dedicated `travel_pins`
 * schema in the shared green-phoenix database.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "travel_pins" } },
  );
}
