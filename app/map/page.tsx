import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MapClient from "@/components/MapClient";
import type { Place } from "@/lib/types";

export default async function MapPage() {
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

  const { data: places } = await supabase
    .from("places")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Accepted friends, for tagging companions on pins.
  const { data: fships } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted");
  const friendIds = (fships ?? []).map((f) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id,
  );
  const { data: fprofs } = friendIds.length
    ? await supabase.from("profiles").select("id, username").in("id", friendIds)
    : { data: [] };
  const friends = (fprofs ?? []) as { id: string; username: string }[];

  return (
    <MapClient
      viewId="world"
      initialPlaces={(places ?? []) as Place[]}
      userId={user.id}
      username={profile.username as string}
      friends={friends}
    />
  );
}
