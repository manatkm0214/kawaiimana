import { NextRequest, NextResponse } from "next/server";
import { getAppSessionUser } from "@/lib/auth/auth0-app-user";
import { boundedText, rateLimit, readJsonBody, requireSameOrigin } from "@/lib/server/security";

export const maxDuration = 30;

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

type SearchProvider = "google" | "osm";

type GooglePlaceResult = {
  id: string;
  displayName?: { text: string };
  location: { latitude: number; longitude: number };
  types?: string[];
  formattedAddress?: string;
};

type NearbyItem = {
  id: string;
  name: string;
  kind: string;
  distanceKm: number;
  lat: number;
  lng: number;
  address: string;
  placeId: string;
};

type GoogleApiError = {
  apiError: number;
  reason?: string;
  message?: string;
};

const PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const PLACES_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
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

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const earth = 6371;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function readGoogleError(response: Response, label: string): Promise<GoogleApiError> {
  const bodyText = await response.text().catch(() => "");
  console.error(`[nearby-shops] ${label} failed:`, response.status, bodyText);

  try {
    const parsed = JSON.parse(bodyText) as {
      error?: {
        message?: string;
        details?: Array<{ reason?: string }>;
      };
    };

    return {
      apiError: response.status,
      message: parsed.error?.message,
      reason: parsed.error?.details?.find((detail) => detail.reason)?.reason,
    };
  } catch {
    return { apiError: response.status, message: bodyText || undefined };
  }
}


async function geocodeAreaWithGoogle(
  area: string,
  apiKey: string,
): Promise<{ lat: number; lon: number; label: string } | GoogleApiError | null> {
  const url = `${GEOCODING_URL}?address=${encodeURIComponent(area)}&key=${apiKey}&language=ja&region=jp`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return readGoogleError(res, "geocodeAreaWithGoogle");

  const data = (await res.json()) as {
    results: Array<{ geometry: { location: { lat: number; lng: number } }; formatted_address: string }>;
  };
  const top = data.results?.[0];
  if (!top) return null;

  return {
    lat: top.geometry.location.lat,
    lon: top.geometry.location.lng,
    label: top.formatted_address,
  };
}

async function searchNearbyWithGoogle(
  lat: number,
  lon: number,
  radius: number,
  kind: PlaceKind,
  apiKey: string,
): Promise<GooglePlaceResult[] | GoogleApiError> {
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

  if (!res.ok) return readGoogleError(res, "searchNearbyWithGoogle");

  const data = (await res.json()) as { places?: GooglePlaceResult[] };
  return data.places ?? [];
}

async function searchByTextWithGoogle(
  query: string,
  lat: number,
  lon: number,
  radius: number,
  apiKey: string,
): Promise<GooglePlaceResult[] | GoogleApiError> {
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

  if (!res.ok) return readGoogleError(res, "searchByTextWithGoogle");

  const data = (await res.json()) as { places?: GooglePlaceResult[] };
  return data.places ?? [];
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildOsmSelectors(kind: PlaceKind, customQuery?: string) {
  const trimmedQuery = customQuery?.trim();
  if (trimmedQuery) {
    const escaped = escapeRegex(trimmedQuery);
    return [
      `node(around:RADIUS,LAT,LON)["name"~"${escaped}",i]`,
      `way(around:RADIUS,LAT,LON)["name"~"${escaped}",i]`,
      `node(around:RADIUS,LAT,LON)["shop"~"${escaped}",i]`,
      `way(around:RADIUS,LAT,LON)["shop"~"${escaped}",i]`,
      `node(around:RADIUS,LAT,LON)["amenity"~"${escaped}",i]`,
      `way(around:RADIUS,LAT,LON)["amenity"~"${escaped}",i]`,
    ];
  }

  const map: Record<PlaceKind, string[]> = {
    budget: [
      'node(around:RADIUS,LAT,LON)["shop"="supermarket"]',
      'node(around:RADIUS,LAT,LON)["shop"="discount"]',
      'node(around:RADIUS,LAT,LON)["shop"="convenience"]',
      'way(around:RADIUS,LAT,LON)["shop"="supermarket"]',
      'way(around:RADIUS,LAT,LON)["shop"="discount"]',
      'way(around:RADIUS,LAT,LON)["shop"="convenience"]',
    ],
    grocery: [
      'node(around:RADIUS,LAT,LON)["shop"="supermarket"]',
      'node(around:RADIUS,LAT,LON)["shop"="greengrocer"]',
      'node(around:RADIUS,LAT,LON)["shop"="convenience"]',
      'way(around:RADIUS,LAT,LON)["shop"="supermarket"]',
      'way(around:RADIUS,LAT,LON)["shop"="greengrocer"]',
      'way(around:RADIUS,LAT,LON)["shop"="convenience"]',
    ],
    clothes: [
      'node(around:RADIUS,LAT,LON)["shop"="clothes"]',
      'node(around:RADIUS,LAT,LON)["shop"="boutique"]',
      'way(around:RADIUS,LAT,LON)["shop"="clothes"]',
      'way(around:RADIUS,LAT,LON)["shop"="boutique"]',
    ],
    daily: [
      'node(around:RADIUS,LAT,LON)["shop"="convenience"]',
      'node(around:RADIUS,LAT,LON)["shop"="variety_store"]',
      'node(around:RADIUS,LAT,LON)["shop"="general"]',
      'way(around:RADIUS,LAT,LON)["shop"="convenience"]',
      'way(around:RADIUS,LAT,LON)["shop"="variety_store"]',
      'way(around:RADIUS,LAT,LON)["shop"="general"]',
    ],
    home: [
      'node(around:RADIUS,LAT,LON)["shop"="houseware"]',
      'node(around:RADIUS,LAT,LON)["shop"="furniture"]',
      'node(around:RADIUS,LAT,LON)["shop"="doityourself"]',
      'way(around:RADIUS,LAT,LON)["shop"="houseware"]',
      'way(around:RADIUS,LAT,LON)["shop"="furniture"]',
      'way(around:RADIUS,LAT,LON)["shop"="doityourself"]',
    ],
    drugstore: [
      'node(around:RADIUS,LAT,LON)["shop"="chemist"]',
      'node(around:RADIUS,LAT,LON)["amenity"="pharmacy"]',
      'way(around:RADIUS,LAT,LON)["shop"="chemist"]',
      'way(around:RADIUS,LAT,LON)["amenity"="pharmacy"]',
    ],
    electronics: [
      'node(around:RADIUS,LAT,LON)["shop"="electronics"]',
      'node(around:RADIUS,LAT,LON)["shop"="appliance"]',
      'node(around:RADIUS,LAT,LON)["shop"="mobile_phone"]',
      'way(around:RADIUS,LAT,LON)["shop"="electronics"]',
      'way(around:RADIUS,LAT,LON)["shop"="appliance"]',
      'way(around:RADIUS,LAT,LON)["shop"="mobile_phone"]',
    ],
    cafe: [
      'node(around:RADIUS,LAT,LON)["amenity"="cafe"]',
      'node(around:RADIUS,LAT,LON)["amenity"="coffee_shop"]',
      'way(around:RADIUS,LAT,LON)["amenity"="cafe"]',
      'way(around:RADIUS,LAT,LON)["amenity"="coffee_shop"]',
    ],
    restaurant: [
      'node(around:RADIUS,LAT,LON)["amenity"="restaurant"]',
      'node(around:RADIUS,LAT,LON)["amenity"="fast_food"]',
      'node(around:RADIUS,LAT,LON)["amenity"="food_court"]',
      'way(around:RADIUS,LAT,LON)["amenity"="restaurant"]',
      'way(around:RADIUS,LAT,LON)["amenity"="fast_food"]',
      'way(around:RADIUS,LAT,LON)["amenity"="food_court"]',
    ],
    beauty: [
      'node(around:RADIUS,LAT,LON)["shop"="beauty"]',
      'node(around:RADIUS,LAT,LON)["shop"="cosmetics"]',
      'node(around:RADIUS,LAT,LON)["shop"="hairdresser"]',
      'way(around:RADIUS,LAT,LON)["shop"="beauty"]',
      'way(around:RADIUS,LAT,LON)["shop"="cosmetics"]',
      'way(around:RADIUS,LAT,LON)["shop"="hairdresser"]',
    ],
    bookstore: [
      'node(around:RADIUS,LAT,LON)["shop"="books"]',
      'way(around:RADIUS,LAT,LON)["shop"="books"]',
    ],
    sports: [
      'node(around:RADIUS,LAT,LON)["shop"="sports"]',
      'way(around:RADIUS,LAT,LON)["shop"="sports"]',
    ],
    baby: [
      'node(around:RADIUS,LAT,LON)["shop"="baby_goods"]',
      'node(around:RADIUS,LAT,LON)["shop"="toys"]',
      'way(around:RADIUS,LAT,LON)["shop"="baby_goods"]',
      'way(around:RADIUS,LAT,LON)["shop"="toys"]',
    ],
  };

  return map[kind];
}

function buildOsmQuery(lat: number, lon: number, radius: number, kind: PlaceKind, customQuery?: string) {
  const selectors = buildOsmSelectors(kind, customQuery);
  const r = Math.min(radius, 2000);
  return `[out:json][timeout:12];(${selectors.join(";").replaceAll("RADIUS", String(r)).replaceAll("LAT", String(lat)).replaceAll("LON", String(lon))};);out center tags 8;`;
}

function buildOsmAddress(tags?: Record<string, string>) {
  if (!tags) return "";
  const full = tags["addr:full"];
  if (full) return full;

  return [tags["addr:city"], tags["addr:suburb"], tags["addr:street"], tags["addr:housenumber"]]
    .filter(Boolean)
    .join(" ");
}

async function geocodeAreaWithOsm(area: string) {
  const query = new URLSearchParams({
    q: area,
    format: "jsonv2",
    limit: "1",
    countrycodes: "jp",
  });

  const response = await fetch(`${NOMINATIM_URL}?${query.toString()}`, {
    headers: {
      "User-Agent": "kakeibo-app/nearby-shops",
      "Accept-Language": "ja,en",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
  }>;

  const top = payload[0];
  if (!top?.lat || !top?.lon) return null;

  return {
    lat: Number(top.lat),
    lon: Number(top.lon),
    label: top.display_name || area,
  };
}

async function searchWithOsm(
  lat: number,
  lon: number,
  radius: number,
  kind: PlaceKind,
  customQuery?: string,
): Promise<NearbyItem[] | { apiError: number }> {
  const query = buildOsmQuery(lat, lon, radius, kind, customQuery);
  const endpoints = [OVERPASS_URL, "https://overpass.kumi.systems/api/interpreter"];

  let response: Response | null = null;
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 14000);
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: query,
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response.ok) break;
    } catch (e) {
      console.error("[nearby-shops] endpoint failed:", endpoint, e);
      continue;
    }
  }

  if (!response?.ok) {
    console.error("[nearby-shops] searchWithOsm failed on all endpoints:", response?.status);
    return { apiError: response?.status ?? 503 };
  }

  const payload = (await response.json()) as {
    elements?: Array<{
      id: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }>;
  };

  return (payload.elements ?? [])
    .map((entry) => {
      const entryLat = entry.lat ?? entry.center?.lat;
      const entryLon = entry.lon ?? entry.center?.lon;
      if (!Number.isFinite(entryLat) || !Number.isFinite(entryLon)) return null;

      return {
        id: `osm-${entry.id}`,
        name: entry.tags?.name || entry.tags?.brand || "Unknown spot",
        kind: entry.tags?.shop || entry.tags?.amenity || kind,
        distanceKm: distanceKm(lat, lon, entryLat as number, entryLon as number),
        lat: entryLat as number,
        lng: entryLon as number,
        address: buildOsmAddress(entry.tags),
        placeId: "",
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 6);
}

function mapGooglePlacesToItems(lat: number, lon: number, kind: PlaceKind, places: GooglePlaceResult[]): NearbyItem[] {
  return places
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

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && area) {
      if (apiKey) {
        const googleGeocoded = await geocodeAreaWithGoogle(area, apiKey);
        if (googleGeocoded && !("apiError" in googleGeocoded)) {
          lat = googleGeocoded.lat;
          lon = googleGeocoded.lon;
          sourceLabel = googleGeocoded.label;
        }
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        const osmGeocoded = await geocodeAreaWithOsm(area);
        if (osmGeocoded) { lat = osmGeocoded.lat; lon = osmGeocoded.lon; sourceLabel = osmGeocoded.label; }
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return NextResponse.json({ error: "エリアが見つかりませんでした。別の地名を試してください。" }, { status: 404 });
      }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json({ error: "lat/lon or area required" }, { status: 400 });
    }

    const radius = Number.isFinite(body.radius) ? Math.min(Math.max(Number(body.radius), 300), 5000) : 1600;
    const allowedKinds: PlaceKind[] = ["budget","grocery","clothes","daily","home","drugstore","electronics","cafe","restaurant","beauty","bookstore","sports","baby"];
    const kind = allowedKinds.includes(body.kind as PlaceKind) ? (body.kind as PlaceKind) : "budget";

    let items: NearbyItem[] = [];
    let provider: SearchProvider = "osm";
    let googleError: GoogleApiError | null = null;
    let osmError: number | null = null;

    if (apiKey) {
      const googleResult = customQuery
        ? await searchByTextWithGoogle(customQuery, lat, lon, radius, apiKey)
        : await searchNearbyWithGoogle(lat, lon, radius, kind, apiKey);
      if ("apiError" in googleResult) {
        googleError = googleResult;
        console.error("[nearby-shops] Google failed:", googleResult);
      } else {
        items = mapGooglePlacesToItems(lat, lon, kind, googleResult);
        provider = "google";
      }
    }

    if (items.length === 0) {
      const osmResult = await searchWithOsm(lat, lon, radius, kind, customQuery || undefined);
      if ("apiError" in osmResult) {
        osmError = osmResult.apiError;
      } else {
        items = osmResult;
        provider = "osm";
      }
    }

    const debug = items.length === 0 ? {
      lat,
      lon,
      radius,
      googleTried: !!apiKey,
      googleErrorCode: googleError?.apiError ?? null,
      googleErrorMsg: googleError?.message ?? null,
      osmErrorCode: osmError,
    } : undefined;

    return NextResponse.json({ items, source: sourceLabel || null, provider, debug });
  } catch (e) {
    console.error("[nearby-shops] unexpected error:", e);
    return NextResponse.json({ error: "failed to fetch nearby shops" }, { status: 500 });
  }
}
