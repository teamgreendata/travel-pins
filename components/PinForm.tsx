"use client";

import { useState } from "react";
import { CATEGORY_ORDER, CATEGORY_META } from "@/lib/categories";
import CategoryGlyph from "./CategoryGlyph";
import type { Category, Visibility } from "@/lib/types";

export interface PinFormValues {
  category: Category;
  visited_on: string; // "" or yyyy-mm-dd
  notes: string;
  is_home: boolean;
  visibility: Visibility;
}

export const DEFAULT_PIN_FORM: PinFormValues = {
  category: "visited",
  visited_on: "",
  notes: "",
  is_home: false,
  visibility: "friends",
};

/** Add/edit form for a pin's user-set fields. Reused for both create and edit. */
export default function PinForm({
  heading,
  subheading,
  initial,
  saving,
  onSave,
  onCancel,
  onDelete,
}: {
  heading: string;
  subheading?: string;
  initial: PinFormValues;
  saving?: boolean;
  onSave: (v: PinFormValues) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [v, setV] = useState<PinFormValues>(initial);
  const set = <K extends keyof PinFormValues>(k: K, val: PinFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
      }}
      className="space-y-3"
    >
      <div>
        <p className="text-sm font-semibold">{heading}</p>
        {subheading && (
          <p className="truncate text-xs text-zinc-500" title={subheading}>
            {subheading}
          </p>
        )}
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-zinc-500">
          Category
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {CATEGORY_ORDER.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => set("category", c)}
              aria-pressed={v.category === c}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                v.category === c
                  ? "border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800"
                  : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              <CategoryGlyph category={c} size={18} />
              <span className="truncate">{CATEGORY_META[c].label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">
          Date visited (optional)
        </label>
        <input
          type="date"
          value={v.visited_on}
          onChange={(e) => set("visited_on", e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">
          Notes (optional)
        </label>
        <textarea
          value={v.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={v.is_home}
            onChange={(e) => set("is_home", e.target.checked)}
          />
          Home location
        </label>
        <label className="flex items-center gap-1 text-xs text-zinc-500">
          Visibility
          <select
            value={v.visibility}
            onChange={(e) => set("visibility", e.target.value as Visibility)}
            className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:text-zinc-100"
          >
            <option value="private">Private</option>
            <option value="friends">Friends</option>
            <option value="public">Public</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
