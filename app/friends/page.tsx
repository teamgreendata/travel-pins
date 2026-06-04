import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FriendsClient, {
  type Person,
  type Suggestion,
} from "@/components/FriendsClient";

interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked" | "declined";
  blocked_by: string | null;
}

export default async function FriendsPage() {
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

  // RLS returns only friendships where I'm a party.
  const { data: rows } = await supabase.from("friendships").select("*");
  const fships = (rows ?? []) as Friendship[];

  const otherIds = fships.map((f) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id,
  );
  const { data: profs } = otherIds.length
    ? await supabase.from("profiles").select("id, username").in("id", otherIds)
    : { data: [] };
  const nameById = new Map(
    ((profs ?? []) as { id: string; username: string }[]).map((p) => [
      p.id,
      p.username,
    ]),
  );

  const friends: Person[] = [];
  const incoming: Person[] = [];
  const outgoing: Person[] = [];
  const blocked: Person[] = [];

  for (const f of fships) {
    const otherId =
      f.requester_id === user.id ? f.addressee_id : f.requester_id;
    const row: Person = {
      friendshipId: f.id,
      otherId,
      username: nameById.get(otherId) ?? "unknown",
    };
    if (f.status === "accepted") friends.push(row);
    else if (f.status === "pending")
      (f.addressee_id === user.id ? incoming : outgoing).push(row);
    else if (f.status === "blocked" && f.blocked_by === user.id)
      blocked.push(row);
    // Rows where someone else blocked me are intentionally not surfaced.
  }

  // Pending companion tags ("X tagged you on Lyon") — via SECURITY DEFINER RPC
  // so it works even for tags on the owner's private pins.
  const { data: suggestions } = await supabase.rpc("companion_suggestions");

  return (
    <FriendsClient
      meId={user.id}
      username={profile.username as string}
      friends={friends}
      incoming={incoming}
      outgoing={outgoing}
      blocked={blocked}
      suggestions={(suggestions ?? []) as Suggestion[]}
    />
  );
}
