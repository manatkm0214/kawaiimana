import { NextRequest, NextResponse } from "next/server";
import { getAppSessionUser } from "@/lib/auth/auth0-app-user";
import { boundedText, rateLimit, readJsonBody, requireSameOrigin } from "@/lib/server/security";

type PlaceKind =
  | "budget"
  | "grocery"
  | "clothes"
  | "daily"
  | "home"
  | "drugstore"
  | "electronics"
  | "cafe"
  | "restaurant"
  | "beauty"
  | "bookstore"
  | "sports"
  | "baby";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const CUSTOM_QUERY_RE = /^[\p{L}\p{N}\s._・ー-]{1,40}$/u;
const UA = "kakeibo-app/1.0 (mana0214tkm@gmail.com)";

const kindToOsmTags: Record<PlaceKind, Array<[string, string]>> = {
  budget:      [["shop", "supermarket"], ["shop", "convenience"]],
  grocery:     [["shop", "supermarket"], ["shop", "grocery"]],
  clothes:     [["shop", "clothes"], ["shop", "fashion"]],
  daily:       [["shop", "convenience"], ["shop", "department_store"]],
  home:        [["shop", "houseware"], ["shop", "furniture"], ["shop", "hardware"]],
  drugstore:   [["shop", "chemist"], ["amenity", "pharmacy"]],
  electronics: [["shop", "electronics"]],
  cafe:        [["amenity", "cafe"]],
  restaurant:  [["amenity", "restaurant"], ["amenity", "fast_food"]],
  beauty:      [["shop", "hairdresser"], ["shop", "beauty"]],
  bookstore:   [["shop", "books"]],
  sports:      [["shop", "sports"]],
  baby:        [["shop", "toys"]],
};

type OsmElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type PlaceResult = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: string;
  address: string;
};

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const earth = 6371;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeArea(area: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(area)}&format=json&limit=1&accept-language=ja&countrycodes=jp`;
  const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const top = data[0];
  if (!top) return null;
  return { lat: parseFloat(top.lat), lon: parseFloat(top.lon), label: top.display_name.split(",").slice(0, 2).join(", ") };
}

function buildOverpassQuery(tags: Array<[string, string]>, lat: number, lon: number, radius: number): string {
  const r = Math.min(radius, 5000);
  const parts = tags.flatMap(([k, v]) => [
    `node["${k}"="${v}"](around:${r},${lat},${lon});`,
    `way["${k}"="${v}"](around:${r},${lat},${lon});`,
  ]);
  return `[out:json][timeout:15];(${parts.join("")});out center 10;`;
}

function osmToPlaces(elements: OsmElement[], kind: PlaceKind): PlaceResult[] {
  return elements
    .filter((e) => e.tags?.name)
    .map((e) => ({
      id: String(e.id),
      name: e.tags!.name!,
      lat: e.lat ?? e.center!.lat,
      lon: e.lon ?? e.center!.lon,
      type: e.tags?.shop ?? e.tags?.amenity ?? kind,
      address: [e.tags?.["addr:city"], e.tags?.["addr:street"], e.tags?.["addr:housenumber"]]
        .filter(Boolean)
        .join(" "),
    }));
}

async function searchNearby(lat: number, lon: number, radius: number, kind: PlaceKind): Promise<PlaceResult[]> {
  const query = buildOverpassQuery(kindToOsmTags[kind], lat, lon, radius);
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[nearby-shops] Overpass failed:", res.status);
    return [];
  }
  const data = (await res.json()) as { elements: OsmElement[] };
  return osmToPlaces(data.elements, kind);
}

async function searchByText(query: string, lat: number, lon: number, radius: number): Promise<PlaceResult[]> {
  const url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=10&accept-language=ja&countrycodes=jp&viewbox=${lon - 0.05},${lat + 0.05},${lon + 0.05},${lat - 0.05}&bounded=1`;
  const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ place_id: number; lat: string; lon: string; display_name: string; type: string }>;
  return data.map((p) => ({
    id: String(p.place_id),
    name: p.display_name.split(",")[0],
    lat: parseFloat(p.lat),
    lon: parseFloat(p.lon),
    type: p.type,
    address: p.display_name.split(",").slice(1, 3).join(", ").trim(),
  })).filter((p) => distanceKm(lat, lon, p.lat, p.lon) <= radius / 1000);
}

export async function POST(req: NextRequest) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    const user = await getAppSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rateLimitError = rateLimit(req, "nearby-shops", 30, 10 * 60 * 1000, user.supabaseUserId);
    if (rateLimitError) return rateLimitError;

    const parsed = await readJsonBody<{
      lat?: number;
      lon?: number;
      radius?: number;
      kind?: PlaceKind;
      area?: string;
      customQuery?: string;
    }>(req, 4_000);
    if (parsed.response) return parsed.response;

    const body = parsed.data;
    let lat = Number(body.lat);
    let lon = Number(body.lon);
    let sourceLabel = "";
    const area = boundedText(body.area, 100);
    const customQuery = boundedText(body.customQuery, 40);

    if (customQuery && !CUSTOM_QUERY_RE.test(customQuery)) {
      return NextResponse.json({ error: "invalid custom query" }, { status: 400 });
    }

    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && area) {
      const geocoded = await geocodeArea(area);
      if (!geocoded) return NextResponse.json({ error: "エリアが見つかりませんでした。別の地名を試してください。" }, { status: 404 });
      lat = geocoded.lat;
      lon = geocoded.lon;
      sourceLabel = geocoded.label;
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json({ error: "lat/lon or area required" }, { status: 400 });
    }

    const radius = Number.isFinite(body.radius) ? Math.min(Math.max(Number(body.radius), 300), 5000) : 1600;
    const allowedKinds: PlaceKind[] = [
      "budget", "grocery", "clothes", "daily", "home", "drugstore",
      "electronics", "cafe", "restaurant", "beauty", "bookstore", "sports", "baby",
    ];
    const kind = allowedKinds.includes(body.kind as PlaceKind) ? (body.kind as PlaceKind) : "budget";

    const places = customQuery
      ? await searchByText(customQuery, lat, lon, radius)
      : await searchNearby(lat, lon, radius, kind);

    const items = places
      .map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.type,
        distanceKm: distanceKm(lat, lon, p.lat, p.lon),
        lat: p.lat,
        lng: p.lon,
        address: p.address,
        placeId: p.id,
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 6);

    return NextResponse.json({ items, source: sourceLabel || null });
  } catch (e) {
    console.error("[nearby-shops] unexpected error:", e);
    return NextResponse.json({ error: "failed to fetch nearby shops" }, { status: 500 });
  }
}
