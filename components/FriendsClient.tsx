"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import NavTabs from "./NavTabs";

export interface Person {
  friendshipId: string;
  otherId: string;
  username: string;
}

export interface Suggestion {
  pc_id: string;
  owner_username: string;
  label: string;
  visited_on: string | null;
}

type Mutation = PromiseLike<{ error: { message: string } | null }>;

function Row({
  name,
  href,
  children,
}: {
  name: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <span className="flex-1 truncate">
        {href ? (
          <Link href={href} className="font-medium hover:underline">
            @{name}
          </Link>
        ) : (
          <span className="font-medium">@{name}</span>
        )}
      </span>
      <span className="flex items-center gap-2">{children}</span>
    </li>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-zinc-500">{title}</h2>
      <ul className="mt-2 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {children}
      </ul>
    </section>
  );
}

export default function FriendsClient({
  meId,
  username,
  friends,
  incoming,
  outgoing,
  blocked,
  suggestions,
}: {
  meId: string;
  username: string;
  friends: Person[];
  incoming: Person[];
  outgoing: Person[];
  blocked: Person[];
  suggestions: Suggestion[];
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; username: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const knownIds = useMemo(
    () =>
      new Set([
        meId,
        ...friends.map((f) => f.otherId),
        ...incoming.map((f) => f.otherId),
        ...outgoing.map((f) => f.otherId),
        ...blocked.map((f) => f.otherId),
      ]),
    [meId, friends, incoming, outgoing, blocked],
  );

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim().toLowerCase();
    if (!term) return;
    setSearching(true);
    setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", `%${term}%`)
      .limit(10);
    setSearching(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResults(
      ((data ?? []) as { id: string; username: string }[]).filter(
        (p) => !knownIds.has(p.id),
      ),
    );
  }

  async function run(p: Mutation) {
    setBusy(true);
    setError(null);
    const { error } = await p;
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResults([]);
    setQ("");
    router.refresh();
  }

  const sendRequest = (otherId: string) =>
    run(
      supabase
        .from("friendships")
        .insert({ requester_id: meId, addressee_id: otherId, status: "pending" }),
    );
  const accept = (id: string) =>
    run(
      supabase
        .from("friendships")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", id),
    );
  const remove = (id: string) =>
    run(supabase.from("friendships").delete().eq("id", id));
  const block = (id: string) =>
    run(
      supabase
        .from("friendships")
        .update({ status: "blocked", blocked_by: meId })
        .eq("id", id),
    );
  const acceptTag = (pcId: string) =>
    run(supabase.rpc("accept_companion", { p_pc_id: pcId }));
  const declineTag = (pcId: string) =>
    run(
      supabase
        .from("place_companions")
        .update({ status: "declined" })
        .eq("id", pcId),
    );

  const btn =
    "rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50";

  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <span className="text-sm font-semibold">Travel Pins</span>
        <NavTabs active="friends" />
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden text-zinc-500 sm:inline">@{username}</span>
          <button onClick={signOut} className="font-medium hover:underline">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Friends</h1>

        <form onSubmit={search} className="mt-4 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find people by username…"
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          />
          <button
            type="submit"
            disabled={searching}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {searching ? "…" : "Search"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {results.length > 0 && (
          <Section title="Search results">
            {results.map((r) => (
              <Row key={r.id} name={r.username}>
                <button
                  disabled={busy}
                  onClick={() => sendRequest(r.id)}
                  className={`${btn} bg-zinc-900 text-white dark:bg-white dark:text-zinc-900`}
                >
                  Add friend
                </button>
              </Row>
            ))}
          </Section>
        )}

        {incoming.length > 0 && (
          <Section title="Friend requests">
            {incoming.map((p) => (
              <Row key={p.friendshipId} name={p.username}>
                <button
                  disabled={busy}
                  onClick={() => accept(p.friendshipId)}
                  className={`${btn} bg-zinc-900 text-white dark:bg-white dark:text-zinc-900`}
                >
                  Accept
                </button>
                <button
                  disabled={busy}
                  onClick={() => remove(p.friendshipId)}
                  className={`${btn} border border-zinc-300 dark:border-zinc-700`}
                >
                  Decline
                </button>
              </Row>
            ))}
          </Section>
        )}

        {suggestions.length > 0 && (
          <Section title="Tagged on a pin">
            {suggestions.map((s) => (
              <li
                key={s.pc_id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span className="flex-1 truncate">
                  <span className="font-medium">@{s.owner_username}</span> tagged
                  you on <span className="font-medium">{s.label}</span>
                  {s.visited_on ? ` (${s.visited_on.slice(0, 4)})` : ""}
                </span>
                <span className="flex items-center gap-2">
                  <button
                    disabled={busy}
                    onClick={() => acceptTag(s.pc_id)}
                    className={`${btn} bg-zinc-900 text-white dark:bg-white dark:text-zinc-900`}
                  >
                    Add to my map
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => declineTag(s.pc_id)}
                    className={`${btn} border border-zinc-300 dark:border-zinc-700`}
                  >
                    Dismiss
                  </button>
                </span>
              </li>
            ))}
          </Section>
        )}

        {outgoing.length > 0 && (
          <Section title="Sent requests">
            {outgoing.map((p) => (
              <Row key={p.friendshipId} name={p.username}>
                <span className="text-xs text-zinc-400">Pending</span>
                <button
                  disabled={busy}
                  onClick={() => remove(p.friendshipId)}
                  className={`${btn} border border-zinc-300 dark:border-zinc-700`}
                >
                  Cancel
                </button>
              </Row>
            ))}
          </Section>
        )}

        <Section title={`Friends (${friends.length})`}>
          {friends.length === 0 ? (
            <li className="px-4 py-3 text-sm text-zinc-500">No friends yet.</li>
          ) : (
            friends.map((p) => (
              <Row key={p.friendshipId} name={p.username} href={`/u/${p.username}`}>
                <Link
                  href={`/u/${p.username}`}
                  className={`${btn} border border-zinc-300 dark:border-zinc-700`}
                >
                  View map
                </Link>
                <button
                  disabled={busy}
                  onClick={() => block(p.friendshipId)}
                  className={`${btn} border border-zinc-300 text-zinc-500 dark:border-zinc-700`}
                >
                  Block
                </button>
                <button
                  disabled={busy}
                  onClick={() => remove(p.friendshipId)}
                  className={`${btn} border border-red-300 text-red-600 dark:border-red-900`}
                >
                  Remove
                </button>
              </Row>
            ))
          )}
        </Section>

        {blocked.length > 0 && (
          <Section title="Blocked">
            {blocked.map((p) => (
              <Row key={p.friendshipId} name={p.username}>
                <button
                  disabled={busy}
                  onClick={() => remove(p.friendshipId)}
                  className={`${btn} border border-zinc-300 dark:border-zinc-700`}
                >
                  Unblock
                </button>
              </Row>
            ))}
          </Section>
        )}
      </main>
    </div>
  );
}
