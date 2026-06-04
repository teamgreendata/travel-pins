import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OverlapClient from "@/components/OverlapClient";

export default async function OverlapPage({
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
  if (target.id === user.id) redirect("/passport");

  const { data: rows } = await supabase.rpc("friend_overlap", {
    p_friend_id: target.id,
  });
  const overlap = (rows ?? []) as { kind: string; country_code: string }[];
  const byKind = (k: string) =>
    overlap.filter((r) => r.kind === k).map((r) => r.country_code);

  return (
    <OverlapClient
      username={me.username as string}
      ownerUsername={target.username as string}
      shared={byKind("shared")}
      wishlistMatch={byKind("wishlist_match")}
      beenWhereYouWant={byKind("been_where_you_want")}
    />
  );
}
