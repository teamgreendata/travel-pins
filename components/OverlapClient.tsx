"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { COUNTRY_NAME } from "@/lib/continents";
import NavTabs from "./NavTabs";

function Section({
  title,
  hint,
  codes,
}: {
  title: string;
  hint?: string;
  codes: string[];
}) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-zinc-500">{title}</h2>
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
      {codes.length === 0 ? (
        <p className="mt-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          Nothing here yet.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {codes.map((c) => (
            <span
              key={c}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {COUNTRY_NAME[c] ?? c}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export default function OverlapClient({
  username,
  ownerUsername,
  shared,
  wishlistMatch,
  beenWhereYouWant,
}: {
  username: string;
  ownerUsername: string;
  shared: string[];
  wishlistMatch: string[];
  beenWhereYouWant: string[];
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

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
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            You &amp; @{ownerUsername}
          </h1>
          <Link
            href={`/u/${ownerUsername}`}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            View their map →
          </Link>
        </div>

        <Section
          title="Countries you've both visited"
          codes={shared}
        />
        <Section
          title="Shared wishlist"
          hint="Places you both want to visit."
          codes={wishlistMatch}
        />
        <Section
          title={`Where @${ownerUsername} has been that you want to go`}
          hint="Great excuse to message them for tips."
          codes={beenWhereYouWant}
        />
      </main>
    </div>
  );
}
