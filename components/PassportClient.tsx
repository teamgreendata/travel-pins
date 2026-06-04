"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeStats, placeYears, filterByYear } from "@/lib/stats";
import { CATEGORY_ORDER, CATEGORY_META } from "@/lib/categories";
import CategoryGlyph from "./CategoryGlyph";
import NavTabs from "./NavTabs";
import ShareManager, { type Share } from "./ShareManager";
import type { Place } from "@/lib/types";

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export default function PassportClient({
  initialPlaces,
  username,
  meId,
  share,
}: {
  initialPlaces: Place[];
  username: string;
  meId: string;
  share: Share | null;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [year, setYear] = useState<number | null>(null);

  const years = useMemo(() => placeYears(initialPlaces), [initialPlaces]);
  const filtered = useMemo(
    () => filterByYear(initialPlaces, year),
    [initialPlaces, year],
  );
  const stats = useMemo(() => computeStats(filtered), [filtered]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <span className="text-sm font-semibold">Travel Pins</span>
        <NavTabs active="passport" />
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden text-zinc-500 sm:inline">@{username}</span>
          <button onClick={signOut} className="font-medium hover:underline">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Passport</h1>
          <label className="flex items-center gap-2 text-sm text-zinc-500">
            Year
            <select
              value={year ?? ""}
              onChange={(e) =>
                setYear(e.target.value ? Number(e.target.value) : null)
              }
              className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:text-zinc-100"
            >
              <option value="">All time</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            label="Countries"
            value={stats.countriesVisited}
            sub={`${stats.percentOfWorld}% of the world`}
          />
          <Stat label="US states" value={stats.usStates} sub="of 50" />
          <Stat
            label="Continents"
            value={stats.continents.length}
            sub="of 7"
          />
          <Stat label="Total pins" value={stats.totalPlaces} />
          <Stat label="Lived" value={stats.lived} />
          <Stat label="Wishlist" value={stats.wishlist} sub="want to visit" />
        </div>

        {stats.continents.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-medium text-zinc-500">
              Continents cleared
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {stats.continents.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {c}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <h2 className="text-sm font-medium text-zinc-500">By category</h2>
          <ul className="mt-2 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {CATEGORY_ORDER.map((c) => (
              <li
                key={c}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <CategoryGlyph category={c} size={20} />
                <span className="flex-1">{CATEGORY_META[c].label}</span>
                <span className="tabular-nums text-zinc-500">
                  {stats.byCategory[c]}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <ShareManager meId={meId} share={share} />

        {filtered.length === 0 && (
          <p className="mt-6 text-sm text-zinc-500">
            No pins{year ? ` for ${year}` : " yet"}. Add some on the{" "}
            <Link href="/map" className="underline">
              world map
            </Link>
            .
          </p>
        )}
      </main>
    </div>
  );
}
