"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Friend {
  id: string;
  username: string;
}
interface Tag {
  id: string;
  companion_id: string;
  status: string;
}

/** Owner-side: tag/untag accepted friends on one of your pins (spec §10). */
export default function CompanionTags({
  placeId,
  friends,
}: {
  placeId: string;
  friends: Friend[];
}) {
  const [supabase] = useState(() => createClient());
  const [tags, setTags] = useState<Tag[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("place_companions")
        .select("id, companion_id, status")
        .eq("place_id", placeId);
      if (active) setTags((data as Tag[]) ?? []);
    })();
    return () => {
      active = false;
    };
  }, [placeId, supabase]);

  const byCompanion = new Map(tags.map((t) => [t.companion_id, t]));

  async function toggle(friend: Friend) {
    setBusy(true);
    const existing = byCompanion.get(friend.id);
    if (existing) {
      await supabase.from("place_companions").delete().eq("id", existing.id);
      setTags((prev) => prev.filter((t) => t.id !== existing.id));
    } else {
      const { data } = await supabase
        .from("place_companions")
        .insert({ place_id: placeId, companion_id: friend.id })
        .select("id, companion_id, status")
        .single();
      if (data) setTags((prev) => [...prev, data as Tag]);
    }
    setBusy(false);
  }

  if (friends.length === 0) {
    return (
      <p className="text-xs text-zinc-400">
        Add friends to tag them on a pin.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-zinc-500">
        Who were you with?
      </p>
      <ul className="space-y-1">
        {friends.map((f) => {
          const t = byCompanion.get(f.id);
          return (
            <li key={f.id} className="flex items-center justify-between text-sm">
              <span className="truncate">
                @{f.username}
                {t && (
                  <span className="ml-1 text-xs text-zinc-400">· {t.status}</span>
                )}
              </span>
              <button
                disabled={busy}
                onClick={() => toggle(f)}
                className={`rounded-md px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
                  t
                    ? "border border-zinc-300 dark:border-zinc-700"
                    : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                }`}
              >
                {t ? "Untag" : "Tag"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
