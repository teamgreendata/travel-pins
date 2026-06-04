"use client";

import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/categories";
import type { Category } from "@/lib/types";
import CategoryGlyph from "./CategoryGlyph";

/**
 * Category legend with per-category show/hide toggles. Shared between the world
 * and (Milestone 4) US maps. `hidden` is the set of categories currently
 * filtered out; clicking a row toggles it.
 */
export default function Legend({
  counts,
  hidden,
  onToggle,
}: {
  counts: Record<Category, number>;
  hidden: Set<Category>;
  onToggle: (c: Category) => void;
}) {
  return (
    <div className="w-56 rounded-xl bg-white/95 p-2 shadow-lg backdrop-blur dark:bg-zinc-900/95">
      <p className="px-1 pb-1 text-xs font-medium text-zinc-500">
        Categories — tap to filter
      </p>
      <ul>
        {CATEGORY_ORDER.map((c) => {
          const isHidden = hidden.has(c);
          return (
            <li key={c}>
              <button
                onClick={() => onToggle(c)}
                aria-pressed={!isHidden}
                title={isHidden ? "Show on map" : "Hide from map"}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  isHidden ? "opacity-40" : ""
                }`}
              >
                <CategoryGlyph category={c} size={20} />
                <span className="flex-1 truncate">{CATEGORY_META[c].label}</span>
                <span className="text-xs tabular-nums text-zinc-400">
                  {counts[c] ?? 0}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
