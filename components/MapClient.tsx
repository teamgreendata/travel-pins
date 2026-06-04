"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import NavTabs from "./NavTabs";
import { CATEGORY_META, markerSVG } from "@/lib/categories";
import { computeFills, getView, type ViewId } from "@/lib/mapview";
import { filterByYear, placeYears } from "@/lib/stats";
import Legend from "./Legend";
import PinForm, { DEFAULT_PIN_FORM, type PinFormValues } from "./PinForm";
import CompanionTags, { type Friend } from "./CompanionTags";
import type { Category, GeocodeResult, Place } from "@/lib/types";

const OPENFREEMAP_LIBERTY = "https://tiles.openfreemap.org/styles/liberty";

export default function MapClient({
  viewId,
  initialPlaces,
  username,
  userId,
  editable = true,
  ownerLabel,
  friends = [],
  publicView = false,
}: {
  viewId: ViewId;
  initialPlaces: Place[];
  username?: string;
  userId?: string;
  editable?: boolean;
  ownerLabel?: string;
  friends?: Friend[];
  publicView?: boolean;
}) {
  const view = getView(viewId);
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [places, setPlaces] = useState<Place[]>(initialPlaces);
  const [hidden, setHidden] = useState<Set<Category>>(new Set());
  const [styleReady, setStyleReady] = useState(false);
  const [year, setYear] = useState<number | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [adding, setAdding] = useState<GeocodeResult | null>(null);
  const [editing, setEditing] = useState<Place | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Pins shown on this map = the user's pins for the selected year (or all).
  const years = useMemo(() => placeYears(places), [places]);
  const displayed = useMemo(() => filterByYear(places, year), [places, year]);

  const counts = useMemo(() => {
    const c = { lived: 0, visited: 0, want_to_visit: 0, passed_through: 0 } as Record<
      Category,
      number
    >;
    for (const p of displayed) c[p.category]++;
    return c;
  }, [displayed]);

  // Initialise the MapLibre map once (client-only).
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: OPENFREEMAP_LIBERTY,
      center: view.center,
      zoom: view.zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    // Dev-only handle for inspecting the map from the browser console.
    if (process.env.NODE_ENV === "development") {
      (window as unknown as Record<string, unknown>).__tpmap = map;
    }

    // Add the boundary polygons + fill layer once the style is ready (handles
    // both the already-loaded and not-yet-loaded cases). Source/layer ids are
    // generic ("boundary") so the same code drives the world and US views.
    const setupBoundary = () => {
      if (map.getSource("boundary")) return;
      map.addSource("boundary", {
        type: "geojson",
        data: view.boundaryUrl,
        promoteId: view.boundaryPromoteId,
      });
      const firstSymbol = map
        .getStyle()
        .layers?.find((l) => l.type === "symbol")?.id;
      map.addLayer(
        {
          id: "boundary-fills",
          type: "fill",
          source: "boundary",
          paint: {
            "fill-color": [
              "coalesce",
              ["feature-state", "color"],
              "rgba(0,0,0,0)",
            ],
            "fill-opacity": 0.55,
          },
        },
        firstSymbol,
      );
      setStyleReady(true);
    };

    if (map.isStyleLoaded()) setupBoundary();
    else map.on("load", setupBoundary);

    // Safety net: if the container is sized 0 at construction (e.g. during a
    // soft navigation) MapLibre would render blank — re-sync on any resize.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(mapContainer.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [view]);

  // Sync markers whenever places or the category filter change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const place of displayed) {
      if (hidden.has(place.category)) continue;

      const el = document.createElement("div");
      el.style.cursor = "pointer";
      el.title = place.visited_on
        ? `${place.label} · ${place.visited_on.slice(0, 4)}`
        : place.label;
      el.innerHTML = markerSVG(place.category);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.lng, place.lat])
        .addTo(map);

      if (editable) {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setAdding(null);
          setActionError(null);
          setEditing(place);
          map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 5) });
        });
      } else {
        // Read-only: click shows a details popup instead of the edit form.
        const detail = `${place.label} — ${CATEGORY_META[place.category].label}${
          place.visited_on ? " · " + place.visited_on.slice(0, 4) : ""
        }`;
        marker.setPopup(
          new maplibregl.Popup({ offset: 16, closeButton: true }).setText(detail),
        );
      }
      markersRef.current.push(marker);
    }
  }, [displayed, hidden, editable]);

  // Drive the choropleth via feature-state (not style rebuilds). want_to_visit
  // is excluded; each region fills by its strongest visible category.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    map.removeFeatureState({ source: "boundary" });
    const fills = computeFills(displayed, hidden, view.fillKey);
    for (const [key, color] of fills) {
      map.setFeatureState({ source: "boundary", id: key }, { color });
    }
  }, [displayed, hidden, styleReady, view]);

  function toggleCategory(c: Category) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      setResults((json.results as GeocodeResult[]) ?? []);
      if (!json.results?.length) setSearchError("No matches. Try a different search.");
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  function pickResult(r: GeocodeResult) {
    setEditing(null);
    setActionError(null);
    setResults([]);
    setQuery("");
    setAdding(r);
  }

  async function handleAdd(v: PinFormValues) {
    if (!adding || !userId) return;
    setSaving(true);
    setActionError(null);
    const { data, error } = await supabase
      .from("places")
      .insert({
        user_id: userId,
        label: adding.label,
        lat: adding.lat,
        lng: adding.lng,
        country_code: adding.country_code,
        region_code: adding.region_code,
        locality: adding.locality,
        category: v.category,
        visited_on: v.visited_on || null,
        notes: v.notes.trim() || null,
        is_home: v.is_home,
        visibility: v.visibility,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    setPlaces((p) => [data as Place, ...p]);
    const added = adding;
    setAdding(null);
    mapRef.current?.flyTo({ center: [added.lng, added.lat], zoom: 6 });
  }

  async function handleUpdate(v: PinFormValues) {
    if (!editing) return;
    setSaving(true);
    setActionError(null);
    const { data, error } = await supabase
      .from("places")
      .update({
        category: v.category,
        visited_on: v.visited_on || null,
        notes: v.notes.trim() || null,
        is_home: v.is_home,
        visibility: v.visibility,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editing.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    setPlaces((p) => p.map((x) => (x.id === editing.id ? (data as Place) : x)));
    setEditing(null);
  }

  async function handleDelete() {
    if (!editing) return;
    setSaving(true);
    setActionError(null);
    const { error } = await supabase.from("places").delete().eq("id", editing.id);
    setSaving(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    setPlaces((p) => p.filter((x) => x.id !== editing.id));
    setEditing(null);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const editInitial: PinFormValues = editing
    ? {
        category: editing.category,
        visited_on: editing.visited_on ?? "",
        notes: editing.notes ?? "",
        is_home: editing.is_home,
        visibility: editing.visibility,
      }
    : DEFAULT_PIN_FORM;

  return (
    <div className="relative h-[100dvh] w-full">
      {/* Explicit viewport height (not `absolute inset-0`, which maplibre-gl.css
          overrides via .maplibregl-map{position:relative}; and not `h-full`,
          which can read 0 during a soft navigation before the parent resolves).
          A ResizeObserver in the effect also calls map.resize() as a safety net. */}
      <div ref={mapContainer} className="h-[100dvh] w-full" />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
        <div className="pointer-events-auto rounded-lg bg-white/90 px-3 py-1.5 text-sm font-semibold shadow backdrop-blur dark:bg-zinc-900/90">
          {publicView ? `@${ownerLabel}'s travel map` : "Travel Pins"}
        </div>
        {!publicView && (
          <div className="pointer-events-auto rounded-lg bg-white/90 p-1 shadow backdrop-blur dark:bg-zinc-900/90">
            <NavTabs active={view.id} />
          </div>
        )}
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-white/90 px-3 py-1.5 text-sm shadow backdrop-blur dark:bg-zinc-900/90">
          {publicView ? (
            <Link
              href="/"
              className="font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
            >
              Travel Pins ↗
            </Link>
          ) : editable ? (
            <>
              <span className="text-zinc-500">@{username}</span>
              <button
                onClick={signOut}
                className="font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <span className="text-zinc-500">Viewing @{ownerLabel}</span>
              <Link
                href={`/u/${ownerLabel}/overlap`}
                className="font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
              >
                Overlap
              </Link>
              <Link
                href="/friends"
                className="font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
              >
                Back
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Left control card (editable views only): edit / add / search */}
      {editable && (
      <div className="absolute left-3 top-16 z-10 w-80 max-w-[calc(100vw-1.5rem)]">
        <div className="rounded-xl bg-white/95 p-3 shadow-lg backdrop-blur dark:bg-zinc-900/95">
          {editing ? (
            <div className="space-y-3">
              <PinForm
                key={`edit-${editing.id}`}
                heading="Edit pin"
                subheading={editing.label}
                initial={editInitial}
                saving={saving}
                onSave={handleUpdate}
                onCancel={() => setEditing(null)}
                onDelete={handleDelete}
              />
              <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <CompanionTags placeId={editing.id} friends={friends} />
              </div>
            </div>
          ) : adding ? (
            <PinForm
              key={`add-${adding.lat},${adding.lng}`}
              heading="Add pin"
              subheading={adding.display_name}
              initial={DEFAULT_PIN_FORM}
              saving={saving}
              onSave={handleAdd}
              onCancel={() => setAdding(null)}
            />
          ) : (
            <>
              <form onSubmit={runSearch} className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a place to add…"
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {searching ? "…" : "Search"}
                </button>
              </form>

              {searchError && (
                <p className="mt-2 text-xs text-red-600">{searchError}</p>
              )}

              {results.length > 0 && (
                <ul className="mt-2 max-h-72 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                  {results.map((r, i) => (
                    <li key={i}>
                      <button
                        onClick={() => pickResult(r)}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <span className="font-medium">{r.label}</span>
                        <span className="block truncate text-xs text-zinc-500">
                          {r.display_name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-2 text-xs text-zinc-400">
                {displayed.length} pin{displayed.length === 1 ? "" : "s"}
                {year ? ` in ${year}` : " on your map"} · click a pin to edit
              </p>
            </>
          )}

          {actionError && (
            <p className="mt-2 text-xs text-red-600">{actionError}</p>
          )}
        </div>
      </div>
      )}

      {/* Year filter + legend */}
      <div className="absolute bottom-3 left-3 z-10 flex max-w-[calc(100vw-1.5rem)] flex-col gap-2">
        {years.length > 0 && (
          <div className="rounded-xl bg-white/95 px-3 py-2 text-sm shadow-lg backdrop-blur dark:bg-zinc-900/95">
            <label className="flex items-center gap-2">
              <span className="text-zinc-500">Year</span>
              <select
                value={year ?? ""}
                onChange={(e) =>
                  setYear(e.target.value ? Number(e.target.value) : null)
                }
                className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-2 py-1 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:text-zinc-100"
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
        )}
        <Legend counts={counts} hidden={hidden} onToggle={toggleCategory} />
      </div>
    </div>
  );
}
