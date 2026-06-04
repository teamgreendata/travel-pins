"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface Share {
  id: string;
  slug: string;
  is_active: boolean;
  show_homes: boolean;
}

export default function ShareManager({
  meId,
  share,
}: {
  meId: string;
  share: Share | null;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    await p;
    setBusy(false);
    router.refresh();
  }

  const create = () =>
    run(
      supabase.from("shares").insert({
        user_id: meId,
        slug: crypto.randomUUID().replace(/-/g, "").slice(0, 12),
        is_active: true,
        show_homes: false,
      }),
    );

  async function copy() {
    if (!share) return;
    await navigator.clipboard.writeText(
      `${window.location.origin}/s/${share.slug}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-zinc-500">Public share link</h2>
      <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        {!share ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-zinc-500">
              A read-only public link to your map — shows only your{" "}
              <strong>public</strong> pins. Homes stay hidden by default.
            </p>
            <button
              disabled={busy}
              onClick={create}
              className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
            >
              Create link
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={`/s/${share.slug}`}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-xs dark:border-zinc-700"
              />
              <button
                onClick={copy}
                className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium dark:border-zinc-700"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={share.is_active}
                disabled={busy}
                onChange={() =>
                  run(
                    supabase
                      .from("shares")
                      .update({ is_active: !share.is_active })
                      .eq("id", share.id),
                  )
                }
              />
              Active (anyone with the link can view)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={share.show_homes}
                disabled={busy}
                onChange={() =>
                  run(
                    supabase
                      .from("shares")
                      .update({ show_homes: !share.show_homes })
                      .eq("id", share.id),
                  )
                }
              />
              Show home pins (fuzzed to ~1&nbsp;km)
            </label>
            <button
              disabled={busy}
              onClick={() =>
                run(supabase.from("shares").delete().eq("id", share.id))
              }
              className="text-xs font-medium text-red-600 disabled:opacity-50"
            >
              Delete link
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
