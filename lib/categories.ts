import type { Category } from "./types";

type Meta = { label: string; color: string; glyph: string };

/**
 * Okabe–Ito colorblind-safe palette + a DISTINCT white glyph per category, so
 * category is never communicated by color alone (handoff spec §4). Glyphs are
 * drawn on a colored badge in a 30×30 viewBox (see markerSVG).
 */
export const CATEGORY_META: Record<Category, Meta> = {
  lived: {
    label: "Lived",
    color: "#D55E00", // vermillion — house
    glyph: `<path d="M9.5 15.3 L15 10.5 L20.5 15.3" /><path d="M11 14.6 V20 H19 V14.6" />`,
  },
  visited: {
    label: "Visited",
    color: "#0072B2", // blue — check
    glyph: `<path d="M10.3 15.4 l3.1 3.1 l6.3 -6.8" />`,
  },
  want_to_visit: {
    label: "Want to visit",
    color: "#009E73", // green — flag
    glyph: `<path d="M12 9.5 V20.5" /><path d="M12 10 H20 L17.7 13 L20 16 H12 Z" fill="#fff" stroke="none" />`,
  },
  passed_through: {
    label: "Passed through",
    color: "#CC79A7", // reddish purple — ring
    glyph: `<circle cx="15" cy="15" r="4.3" />`,
  },
};

export const CATEGORY_ORDER: Category[] = [
  "lived",
  "visited",
  "want_to_visit",
  "passed_through",
];

/**
 * A self-contained SVG string for a category marker/icon (colored badge + white
 * glyph). Used both imperatively (MapLibre marker DOM) and in React (legend /
 * form swatches) so the icon has a single source of truth.
 */
export function markerSVG(category: Category, size = 30): string {
  const { color, glyph } = CATEGORY_META[category];
  return `<svg width="${size}" height="${size}" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))"><circle cx="15" cy="15" r="12" fill="${color}" stroke="#fff" stroke-width="2.5"/><g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>`;
}
