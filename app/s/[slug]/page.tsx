import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MapClient from "@/components/MapClient";
import type { Category, Place, Visibility } from "@/lib/types";

interface SharedPin {
  id: string;
  label: string;
  category: Category;
  lat: number;
  lng: number;
  country_code: string;
  region_code: string | null;
  visited_on: string | null;
  is_home: boolean;
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Anonymous read path: SECURITY DEFINER RPC returns only public pins
  // (homes fuzzed/gated). Granted to anon; /s/ is excluded from the auth proxy.
  const { data } = await supabase.rpc("get_shared_map", { p_slug: slug });
  if (!data) notFound();

  const shared = data as { owner: string; pins: SharedPin[] };
  const places: Place[] = shared.pins.map((p) => ({
    id: p.id,
    user_id: "",
    label: p.label,
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    country_code: p.country_code,
    region_code: p.region_code,
    locality: null,
    visited_on: p.visited_on,
    notes: null,
    is_home: p.is_home,
    visibility: "public" as Visibility,
    created_at: "",
    updated_at: "",
  }));

  return (
    <MapClient
      viewId="world"
      initialPlaces={places}
      editable={false}
      publicView
      ownerLabel={shared.owner}
    />
  );
}
