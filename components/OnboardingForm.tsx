"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export default function OnboardingForm() {
  const router = useRouter();
  const supabase = createClient();

  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!USERNAME_RE.test(username)) {
      setError("3–30 characters: lowercase letters, numbers, and underscores only.");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .insert({ id: user.id, username });

      if (error) {
        // 23505 = unique_violation (username taken)
        if (error.code === "23505") {
          setError("That username is taken. Try another.");
        } else {
          setError(error.message);
        }
        return;
      }

      router.push("/map");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pick a username
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          This is how friends will find you later.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div className="flex items-center rounded-lg border border-zinc-300 px-3 focus-within:border-zinc-500 dark:border-zinc-700">
            <span className="text-sm text-zinc-400">@</span>
            <input
              autoFocus
              required
              placeholder="rob_green"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              className="w-full bg-transparent px-1 py-2 text-sm outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "Saving…" : "Continue"}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
