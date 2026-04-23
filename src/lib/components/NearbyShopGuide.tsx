"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";

type CacheEntry = { items: ShopItem[]; ts: number };
const shopCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;
import { formatCurrency, type Transaction } from "@/lib/utils";
import { useLang } from "@/lib/hooks/useLang";
import type { LifestyleSuggestion } from "./FoodLifestyleAssistant";

type ShopKind =
  | "budget"
  | "grocery"
  | "daily"
  | "drugstore"
  | "home"
  | "clothes"
  | "electronics"
  | "cafe"
  | "restaurant"
  | "beauty"
  | "bookstore"
  | "sports"
  | "baby";

type LifestyleMode = "save" | "standard" | "luxury";
type SearchProvider = "google" | "osm";

type ShopItem = {
  id: string;
  name: string;
  kind: string;
  distanceKm: number;
  lat: number;
  lng: number;
  address: string;
  placeId: string;
};

function detectMode(params: { savingRate: number; balance: number; expenseRatio: number }): LifestyleMode {
  if (params.balance >= 0 && params.savingRate >= 20 && params.expenseRatio <= 0.65) return "luxury";
  if (params.balance >= 0 && params.savingRate >= 10) return "standard";
  return "save";
}

export default function NearbyShopGuide({
  transactions,
  currentMonth,
  area,
  onAreaChange,
  supportMode,
  lifestyleSuggestions,
}: {
  transactions: Transaction[];
  currentMonth: string;
  area: string;
  onAreaChange: (value: string) => void;
  supportMode: LifestyleMode;
  lifestyleSuggestions: LifestyleSuggestion[];
}) {
  const lang = useLang();
  const t = (ja: string, en: string) => (lang === "en" ? en : ja);
  const [shops, setShops] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState<ShopKind>("budget");
  const [customQuery, setCustomQuery] = useState("");
  const [lastSource, setLastSource] = useState<"area" | "current" | null>(null);
  const [budgetLimit, setBudgetLimit] = useState("");
  const [provider, setProvider] = useState<SearchProvider | null>(null);

  const stats = useMemo(() => {
    const monthly = transactions.filter((item) => item.date.startsWith(currentMonth));
    const income = monthly.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const expense = monthly.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
    const saving = monthly
      .filter((item) => item.type === "saving" || item.type === "investment")
      .reduce((sum, item) => sum + item.amount, 0);
    const balance = income - expense - saving;
    const savingRate = income > 0 ? Math.round((saving / income) * 100) : 0;
    const expenseRatio = income > 0 ? expense / income : 1;
    return { balance, savingRate, expenseRatio };
  }, [currentMonth, transactions]);

  const mode = supportMode || detectMode(stats);
  const parsedBudgetLimit = Number(budgetLimit);
  const hasBudgetLimit = Number.isFinite(parsedBudgetLimit) && parsedBudgetLimit > 0;

  const budgetNote = (() => {
    if (!hasBudgetLimit) {
      return t(
        "予算目安を入れると、今月の家計に合う探し方のヒントが出ます。",
        "Add a budget target to get search guidance that fits this month.",
      );
    }
    if (parsedBudgetLimit <= 3000) {
      return t(
        `今回は ${parsedBudgetLimit.toLocaleString()} 円くらいを目安に、安くて比較しやすい候補を優先すると安心です。`,
        `For this search, staying within JPY ${parsedBudgetLimit.toLocaleString()} works best if you keep the list focused.`,
      );
    }
    if (parsedBudgetLimit <= 10000) {
      return t(
        `今回は ${parsedBudgetLimit.toLocaleString()} 円前後を目安に、比較しやすいお店を見ていくのがおすすめです。`,
        `For this search, around JPY ${parsedBudgetLimit.toLocaleString()} is a good target, so stores that are easy to compare are best.`,
      );
    }
    return t(
      `今回は ${parsedBudgetLimit.toLocaleString()} 円前後を目安に、少し広めに候補を探せます。`,
      `For this search, around JPY ${parsedBudgetLimit.toLocaleString()} gives you enough room to compare a wider set of stores.`,
    );
  })();

  const kindToOsmTags: Record<ShopKind, Array<[string, string]>> = {
    budget:      [["shop", "supermarket"], ["shop", "convenience"]],
    grocery:     [["shop", "supermarket"], ["shop", "greengrocer"]],
    clothes:     [["shop", "clothes"]],
    daily:       [["shop", "convenience"], ["shop", "variety_store"]],
    home:        [["shop", "houseware"], ["shop", "furniture"], ["shop", "doityourself"]],
    drugstore:   [["shop", "chemist"], ["amenity", "pharmacy"]],
    electronics: [["shop", "electronics"]],
    cafe:        [["amenity", "cafe"]],
    restaurant:  [["amenity", "restaurant"], ["amenity", "fast_food"]],
    beauty:      [["shop", "hairdresser"], ["shop", "beauty"]],
    bookstore:   [["shop", "books"]],
    sports:      [["shop", "sports"]],
    baby:        [["shop", "toys"], ["shop", "baby_goods"]],
  };

  function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const rad = (v: number) => (v * Math.PI) / 180;
    const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function searchOverpass(lat: number, lon: number, radius: number, cKind: ShopKind, cQuery: string): Promise<ShopItem[]> {
    const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)},${radius},${cKind},${cQuery}`;
    const cached = shopCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.items;
    const r = Math.min(radius, 2000);
    let selectors: string[];
    if (cQuery.trim()) {
      const esc = cQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      selectors = [
        `node(around:${r},${lat},${lon})["name"~"${esc}",i]`,
        `way(around:${r},${lat},${lon})["name"~"${esc}",i]`,
      ];
    } else {
      selectors = kindToOsmTags[cKind].flatMap(([k, v]) => [
        `node(around:${r},${lat},${lon})["${k}"="${v}"]`,
        `way(around:${r},${lat},${lon})["${k}"="${v}"]`,
      ]);
    }
    const query = `[out:json][timeout:20];(${selectors.join(";")};);out center tags 8;`;
    const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
    for (const ep of endpoints) {
      try {
        const res = await fetch(`${ep}?data=${encodeURIComponent(query)}`);
        if (!res.ok) { console.warn("[overpass] failed:", ep, res.status); continue; }
        const data = (await res.json()) as { elements?: Array<{ id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
        const items = (data.elements ?? [])
          .filter(e => e.tags?.name && (e.lat != null || e.center != null))
          .map(e => {
            const eLat = e.lat ?? e.center!.lat;
            const eLon = e.lon ?? e.center!.lon;
            return {
              id: String(e.id),
              name: e.tags!.name!,
              kind: e.tags?.shop ?? e.tags?.amenity ?? cKind,
              distanceKm: distanceKm(lat, lon, eLat, eLon),
              lat: eLat,
              lng: eLon,
              address: [e.tags?.["addr:city"], e.tags?.["addr:street"]].filter(Boolean).join(" "),
              placeId: "",
            };
          })
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, 6);
        shopCache.set(cacheKey, { items, ts: Date.now() });
        return items;
      } catch (e) { console.warn("[overpass] error:", ep, e); continue; }
    }
    throw new Error(t("周辺のお店情報を取得できませんでした。時間をおいて再試行してください。", "Could not fetch nearby shops. Please try again later."));
  }

  async function loadShops(payload: { lat?: number; lon?: number; area?: string }, source: "area" | "current") {
    setLoading(true);
    setStatus("");
    setLastSource(source);

    try {
      const radius = kind === "clothes" || kind === "home" || kind === "electronics" ? 2500 : 1800;
      let lat = payload.lat ?? NaN;
      let lon = payload.lon ?? NaN;
      let sourceLabel = "";

      if (payload.area) {
        const response = await fetch("/api/nearby-shops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ area: payload.area }),
        });
        const data = (await response.json()) as { lat?: number; lon?: number; source?: string | null; error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? t("エリアが見つかりませんでした。", "Area not found."));
        }
        lat = data.lat ?? NaN;
        lon = data.lon ?? NaN;
        sourceLabel = data.source ?? payload.area;
      }

      const nextItems = await searchOverpass(lat, lon, radius, kind, customQuery.trim());
      setShops(nextItems);

      if (nextItems.length === 0) {
        setStatus(source === "area"
          ? t("このエリアでは候補が見つかりませんでした。別の地名や自由入力も試してみてください。", "No results found. Try another area or keyword.")
          : t("現在地の近くでは候補が見つかりませんでした。", "No nearby results found."));
        return;
      }
      setStatus(source === "area"
        ? t(`「${sourceLabel}」周辺のお店を表示しています。`, `Showing places around ${sourceLabel}.`)
        : t("現在地の近くのお店を表示しています。", "Showing places near your current location."));
    } catch (error) {
      setShops([]);
      setStatus(error instanceof Error ? error.message : t("お店を取得できませんでした。", "Could not fetch places."));
    } finally {
      setLoading(false);
    }
  }

  async function findNearbyShops() {
    if (!navigator.geolocation) {
      setStatus(t("この端末では現在地を使えません。", "Geolocation is not available on this device."));
      return;
    }

    setLoading(true);
    setStatus("");
    setLastSource("current");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await loadShops(
          {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          },
          "current",
        );
      },
      (err) => {
        setLoading(false);
        if (err.code === 1) {
          setStatus(t("位置情報の許可が必要です。ブラウザのアドレスバー横のアイコンから許可してください。", "Location permission is required. Please allow it from the browser address bar."));
        } else if (err.code === 2) {
          setStatus(t("現在地を取得できませんでした。電波状況を確認してください。", "Could not get your location. Please check your connection."));
        } else {
          setStatus(t("現在地の取得がタイムアウトしました。もう一度お試しください。", "Location request timed out. Please try again."));
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }

  async function findAreaShops() {
    if (!area.trim()) {
      setStatus(t("地名や駅名を入れてから検索してください。", "Enter an area name before searching."));
      return;
    }
    await loadShops({ area: area.trim() }, "area");
  }

  const optionLabels: Record<ShopKind, { ja: string; en: string }> = {
    budget: { ja: "安い店", en: "Budget" },
    grocery: { ja: "食料品", en: "Groceries" },
    daily: { ja: "日用品", en: "Daily goods" },
    drugstore: { ja: "ドラッグ", en: "Drugstore" },
    home: { ja: "生活雑貨", en: "Home goods" },
    clothes: { ja: "服", en: "Clothes" },
    electronics: { ja: "家電", en: "Electronics" },
    cafe: { ja: "カフェ", en: "Cafe" },
    restaurant: { ja: "外食", en: "Restaurant" },
    beauty: { ja: "美容", en: "Beauty" },
    bookstore: { ja: "本屋", en: "Bookstore" },
    sports: { ja: "スポーツ", en: "Sports" },
    baby: { ja: "ベビー", en: "Baby" },
  };

  const guidanceByKind: Record<ShopKind, { ja: string; en: string }> = {
    budget: {
      ja: mode === "save" ? "今月は安いお店を優先して、まとめ買いしすぎないのが安心です。" : "近くの安いお店を把握しておくと、急な出費にも対応しやすくなります。",
      en: mode === "save" ? "This month, prioritize budget stores and avoid overbuying." : "Knowing a good budget store nearby helps keep spending stable.",
    },
    grocery: {
      ja: mode === "save" ? "食料品は1週間くらいでまとめると、無駄買いを減らしやすいです。" : "よく使う食料品店を見つけると、追加の買い物が楽になります。",
      en: mode === "save" ? "Buying about a week's worth of groceries helps avoid waste." : "A reliable grocery store nearby makes top-up shopping easier.",
    },
    daily: {
      ja: "日用品は食料品と一緒に買えるお店を選ぶと、移動も無駄使いもまとまりやすいです。",
      en: "Picking a store where you can buy daily goods together with groceries saves both time and money.",
    },
    drugstore: {
      ja: "ドラッグストアは価格差が出やすいので、使いやすいお店を1つ決めると家計管理が楽です。",
      en: "Drugstore prices can vary, so it helps to have one reliable nearby option.",
    },
    home: {
      ja: "生活雑貨は必要な物を決めてから見ると、余計な買い足しを減らせます。",
      en: "For home goods, deciding exactly what you need before you go helps avoid impulse buying.",
    },
    clothes: {
      ja: mode === "save" ? "今月は服を必要分だけにすると、予算を守りやすいです。" : "服は着回ししやすい物に絞ると、満足度と家計の両立がしやすいです。",
      en: mode === "save" ? "This month is safer if clothes stay essential only." : "Keeping clothes purchases to one versatile piece is easier on the budget.",
    },
    electronics: {
      ja: "家電は価格差が大きいので、比べやすいお店を近くで見つけておくと安心です。",
      en: "Electronics prices can vary a lot, so it helps to find stores where you can compare nearby.",
    },
    cafe: {
      ja: "カフェは回数が増えやすいので、使う店を絞っておくと予算管理しやすいです。",
      en: "Cafe spending can add up quickly, so it helps to narrow down a few easy options nearby.",
    },
    restaurant: {
      ja: "外食は満足度と予算の両立が大事なので、比較しやすい候補を見つけておくと安心です。",
      en: "Restaurants are easier to manage when you already know a few options that balance value and satisfaction.",
    },
    beauty: {
      ja: "美容費は勢いで増えやすいので、使いたいお店を先に決めておくとコントロールしやすいです。",
      en: "Beauty spending is easier to control when you already know the shops you want to use.",
    },
    bookstore: {
      ja: "本屋は目的買いに寄せると、近くの候補を把握しておくことが無駄買い防止につながります。",
      en: "Knowing a nearby bookstore helps you buy intentionally instead of browsing aimlessly.",
    },
    sports: {
      ja: "スポーツ用品は価格差が大きいので、比較用の候補をいくつか知っておくと安心です。",
      en: "Sports gear is easier to compare when you already know a few nearby options.",
    },
    baby: {
      ja: "ベビー用品は急ぎで必要になることもあるので、近くの候補を知っておくと助かります。",
      en: "Baby goods can become urgent purchases, so knowing nearby options helps a lot.",
    },
  };

  return (
    <div className="flex h-full min-w-0 flex-col rounded-[28px] board-card border p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-black text-black">{t("お店案内", "Nearby shop guide")}</h3>
          <p className="mt-1 text-sm font-semibold text-black">
            {t("エリアでも現在地でも探せます。探したいお店は上の入力欄で選んで、そのまま探すに反映します。", "You can search by area or by current location. Store type is selected in the top inputs and used directly by search.")}
          </p>
        </div>
        <span className="text-xs text-black">
          {t("今月の収支", "Balance")}: {formatCurrency(stats.balance)}
        </span>
      </div>

      <div className="mt-4 rounded-2xl board-tile border p-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-black">{t("エリア入力", "Area")}</span>
            <input
              value={area}
              onChange={(event) => onAreaChange(event.target.value)}
              placeholder={t("例: 渋谷 / 横浜 / 新宿駅", "e.g. Shibuya / Yokohama / Shinjuku Station")}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-black outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-black">{t("予算目安", "Budget target")}</span>
            <input
              value={budgetLimit}
              onChange={(event) => setBudgetLimit(event.target.value)}
              placeholder={t("例: 3000", "e.g. 3000")}
              type="number"
              min={0}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-black outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
        </div>

        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-semibold text-black">{t("自由入力で探す", "Custom keyword")}</span>
          <input
            value={customQuery}
            onChange={(event) => setCustomQuery(event.target.value)}
            placeholder={t("例: ベーカリー / 100均 / ペット用品", "e.g. bakery / 100 yen shop / pet supplies")}
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-black outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
          <p className="mt-2 text-xs text-black">
            {t("選んだ店種に加えて、このキーワードでも候補を探します。", "Search will also use this free-form keyword in addition to the selected store type.")}
          </p>
        </label>

        <div className="mt-3">
          <p className="mb-2 text-sm font-black text-black">{t("探したいお店", "Store type")}</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(optionLabels) as ShopKind[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                  kind === option ? "border border-slate-950 bg-cyan-500 text-white shadow-sm" : "border border-slate-400 bg-white text-black hover:border-slate-500 hover:text-black"
                }`}
              >
                {lang === "en" ? optionLabels[option].en : optionLabels[option].ja}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 text-sm text-black">{budgetNote}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void findAreaShops()}
            disabled={loading}
            className="min-h-12.5 rounded-full bg-cyan-500 px-5 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:opacity-50"
          >
            {loading && lastSource === "area" ? t("検索中...", "Searching...") : t("このエリアで探す", "Search this area")}
          </button>
          <button
            type="button"
            onClick={findNearbyShops}
            disabled={loading}
            className="min-h-12.5 rounded-full bg-emerald-500 px-5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading && lastSource === "current" ? t("取得中...", "Finding...") : t("現在地で探す", "Use current location")}
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl board-tile border p-3">
        {lifestyleSuggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-black text-black">{t("暮らし方の提案", "Lifestyle suggestions")}</p>
            {lifestyleSuggestions.map((card) => (
              <div key={`${card.title}-${card.budgetLabel}`} className="rounded-2xl board-tile border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-black text-black">{card.title}</p>
                  <span className="text-[11px] text-black">{card.budgetLabel}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-black">{card.body}</p>
              </div>
            ))}
          </div>
        )}

        <div className={`${lifestyleSuggestions.length > 0 ? "mt-3" : ""} rounded-2xl board-tile border p-3`}>
          <p className="text-sm leading-7 text-black">{lang === "en" ? guidanceByKind[kind].en : guidanceByKind[kind].ja}</p>
          {customQuery.trim() && <p className="mt-2 text-sm text-black">{t(`自由入力: ${customQuery.trim()}`, `Custom keyword: ${customQuery.trim()}`)}</p>}
          {hasBudgetLimit && (
            <p className="mt-2 text-sm text-black">
              {t(`予算目安: ${parsedBudgetLimit.toLocaleString()} 円`, `Budget target: JPY ${parsedBudgetLimit.toLocaleString()}`)}
            </p>
          )}
          <p className="mt-2 text-xs text-black">
            {mode === "luxury" ? t("ゆとりモード", "Treat mode") : mode === "standard" ? t("標準モード", "Balanced mode") : t("節約モード", "Save mode")}
          </p>
        </div>
      </div>

      {status && <div className="mt-3 rounded-2xl border border-slate-400 bg-cyan-50 px-3 py-2 text-sm text-black">{status}</div>}

      <div className="mt-3 flex-1 space-y-2 overflow-hidden">
        {shops.length === 0 ? (
          <div className="flex min-h-55 items-center rounded-2xl board-tile border border-dashed px-3 py-4 text-sm text-black">
            {t("上の入力欄で店種を選んでから、エリア検索または現在地検索で候補を表示できます。", "Pick a store type above, then use area or current-location search to show results.")}
          </div>
        ) : (
          <>
            {provider === "google" && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && shops[0] && (
              <div className="overflow-hidden rounded-2xl border">
                <Image
                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${shops[0].lat},${shops[0].lng}&zoom=14&size=600x200&scale=2${shops.map((s) => `&markers=color:red%7C${s.lat},${s.lng}`).join("")}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                  alt={t("周辺地図", "Nearby map")}
                  className="w-full object-cover"
                  width={600}
                  height={200}
                  unoptimized
                />
              </div>
            )}
            <div className="max-h-70 space-y-2 overflow-y-auto pr-1">
              {shops.map((shop, index) => (
                <div key={shop.id} className="rounded-2xl board-tile border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-black">
                        {index + 1}. {shop.name}
                      </p>
                      {shop.address && <p className="mt-0.5 text-xs text-black">{shop.address}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs text-black">{shop.distanceKm.toFixed(2)} km</span>
                      <a
                        href={shop.placeId
                          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.name)}&query_place_id=${shop.placeId}`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.lat},${shop.lng}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-cyan-500 px-2 py-0.5 text-xs font-semibold text-white hover:bg-cyan-400"
                      >
                        {t("地図", "Map")}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
