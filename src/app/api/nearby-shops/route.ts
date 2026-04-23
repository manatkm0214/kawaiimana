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

const PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const PLACES_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const CUSTOM_QUERY_RE = /^[\p{L}\p{N}\s._・ー-]{1,40}$/u;
const FIELD_MASK = "places.id,places.displayName,places.location,places.types,places.formattedAddress";

const kindToTypes: Record<PlaceKind, string[]> = {
  budget: ["supermarket", "convenience_store"],
  grocery: ["supermarket", "grocery_store"],
  clothes: ["clothing_store"],
  daily: ["convenience_store", "department_store"],
  home: ["home_goods_store", "furniture_store", "hardware_store"],
  drugstore: ["drugstore", "pharmacy"],
  electronics: ["electronics_store"],
  cafe: ["cafe"],
  restaurant: ["restaurant", "fast_food_restaurant"],
  beauty: ["beauty_salon"],
  bookstore: ["book_store"],
  sports: ["sporting_goods_store"],
  baby: ["toy_store"],
};

type PlaceResult = {
  id: string;
  displayName?: { text: string };
  location: { latitude: number; longitude: number };
  types?: string[];
  formattedAddress?: string;
};

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const earth = 6371;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeArea(area: string, apiKey: string) {
  const url = `${GEOCODING_URL}?address=${encodeURIComponent(area)}&key=${apiKey}&language=ja&region=jp`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results: Array<{ geometry: { location: { lat: number; lng: number } }; formatted_address: string }>;
  };
  const top = data.results?.[0];
  if (!top) return null;
  return { lat: top.geometry.location.lat, lon: top.geometry.location.lng, label: top.formatted_address };
}

async function searchNearby(lat: number, lon: number, radius: number, kind: PlaceKind, apiKey: string): Promise<PlaceResult[] | { apiError: number }> {
  const res = await fetch(PLACES_NEARBY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: kindToTypes[kind],
      maxResultCount: 10,
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lon }, radius: Math.min(radius, 5000) },
      },
      languageCode: "ja",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[nearby-shops] searchNearby failed:", res.status, body);
    return { apiError: res.status };
  }
  const data = (await res.json()) as { places?: PlaceResult[] };
  return data.places ?? [];
}

async function searchByText(query: string, lat: number, lon: number, radius: number, apiKey: string): Promise<PlaceResult[] | { apiError: number }> {
  const res = await fetch(PLACES_TEXT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 10,
      locationBias: {
        circle: { center: { latitude: lat, longitude: lon }, radius: Math.min(radius, 5000) },
      },
      languageCode: "ja",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[nearby-shops] searchByText failed:", res.status, body);
    return { apiError: res.status };
  }
  const data = (await res.json()) as { places?: PlaceResult[] };
  return data.places ?? [];
}

export async function POST(req: NextRequest) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    const user = await getAppSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rateLimitError = rateLimit(req, "nearby-shops", 30, 10 * 60 * 1000, user.supabaseUserId);
    if (rateLimitError) return rateLimitError;

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 503 });

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
      const geocoded = await geocodeArea(area, apiKey);
      if (!geocoded) return NextResponse.json({ error: "area could not be resolved" }, { status: 404 });
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

    const result = customQuery
      ? await searchByText(customQuery, lat, lon, radius, apiKey)
      : await searchNearby(lat, lon, radius, kind, apiKey);

    if ("apiError" in result) {
      const msg = result.apiError === 403
        ? "Google Maps APIキーが制限されています。Google Cloud ConsoleでAPIキーの制限を確認してください。"
        : `Google Maps APIエラー (${result.apiError})`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const places = result;
    const items = places
      .map((p) => ({
        id: p.id,
        name: p.displayName?.text ?? "Unknown",
        kind: p.types?.[0] ?? kind,
        distanceKm: distanceKm(lat, lon, p.location.latitude, p.location.longitude),
        lat: p.location.latitude,
        lng: p.location.longitude,
        address: p.formattedAddress ?? "",
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
