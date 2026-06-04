import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PassportClient from "@/components/PassportClient";
import { type Share } from "@/components/ShareManager";
import type { Place } from "@/lib/types";

export default async function PassportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  // Passport reflects ALL pins (global stats), not a single map view.
  const { data: places } = await supabase
    .from("places")
    .select("*")
    .eq("user_id", user.id);

  const { data: share } = await supabase
    .from("shares")
    .select("id, slug, is_active, show_homes")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <PassportClient
      initialPlaces={(places ?? []) as Place[]}
      username={profile.username as string}
      meId={user.id}
      share={(share ?? null) as Share | null}
    />
  );
}
