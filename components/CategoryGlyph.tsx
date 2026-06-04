import { markerSVG } from "@/lib/categories";
import type { Category } from "@/lib/types";

/** Renders a category's badge+glyph icon (same source as the map markers). */
export default function CategoryGlyph({
  category,
  size = 20,
}: {
  category: Category;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      style={{ display: "inline-flex", flex: "none" }}
      dangerouslySetInnerHTML={{ __html: markerSVG(category, size) }}
    />
  );
}
