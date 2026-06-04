import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MapClient from "@/components/MapClient";
import type { Place } from "@/lib/types";

export default async function FriendMapPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  if (!me) redirect("/onboarding");

  const { data: target } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (!target) notFound();
  if (target.id === user.id) redirect("/map"); // your own map is editable

  // RLS (places_friends_read) returns the target's public pins, their
  // 'friends' pins if we're accepted friends, and nothing if blocked.
  const { data: places } = await supabase
    .from("places")
    .select("*")
    .eq("user_id", target.id)
    .order("created_at", { ascending: false });

  return (
    <MapClient
      viewId="world"
      initialPlaces={(places ?? []) as Place[]}
      username={me.username as string}
      editable={false}
      ownerLabel={target.username as string}
    />
  );
}
