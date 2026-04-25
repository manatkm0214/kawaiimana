"use client";

import { useMemo, useState } from "react";
import { formatCurrency, type Transaction } from "@/lib/utils";
import { useLang } from "@/lib/hooks/useLang";

type ItemCategory = "daily" | "appliance" | "beauty" | "game" | "oshi" | "car" | "home";

const CATEGORY_EMOJI: Record<ItemCategory, string> = {
  daily: "🛒",
  appliance: "📱",
  beauty: "💄",
  game: "🎮",
  oshi: "💜",
  car: "🚗",
  home: "🏠",
};

// 35年ローン 年利1%
function homeLoanMonthly(price: number) {
  const r = 0.01 / 12;
  const n = 420;
  return price * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// 5年ローン 年利3%
function carLoanMonthly(price: number) {
  const r = 0.03 / 12;
  const n = 60;
  return price * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function PurchaseAdvisor({
  transactions,
  currentMonth,
}: {
  transactions: Transaction[];
  currentMonth: string;
}) {
  const lang = useLang();
  const t = (ja: string, en: string) => (lang === "en" ? en : ja);

  const [name, setName] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [category, setCategory] = useState<ItemCategory>("daily");
  const [region, setRegion] = useState("");
  const [store, setStore] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [saved, setSaved] = useState(false);

  const price = Number(priceStr);
  const hasPrice = Number.isFinite(price) && price > 0;

  const stats = useMemo(() => {
    const monthly = transactions.filter((tx) => tx.date.startsWith(currentMonth));
    const income = monthly.filter((tx) => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);
    const expense = monthly.filter((tx) => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0);
    const saving = monthly
      .filter((tx) => tx.type === "saving" || tx.type === "investment")
      .reduce((s, tx) => s + tx.amount, 0);
    const balance = income - expense - saving;
    const dailyIncome = income > 0 ? income / 30 : 0;
    return { income, expense, saving, balance, dailyIncome };
  }, [transactions, currentMonth]);

  const effort = useMemo(() => {
    if (!hasPrice) return null;
    const incomeDays = stats.dailyIncome > 0 ? Math.ceil(price / stats.dailyIncome) : null;
    const savingMonths = stats.saving > 0 ? Math.ceil(price / stats.saving) : null;
    let score: "easy" | "moderate" | "hard" | "veryHard" = "veryHard";
    if (incomeDays !== null) {
      if (incomeDays <= 3) score = "easy";
      else if (incomeDays <= 14) score = "moderate";
      else if (incomeDays <= 60) score = "hard";
    }
    return { incomeDays, savingMonths, score };
  }, [price, hasPrice, stats]);

  const affordability = useMemo(() => {
    if (!hasPrice) return null;
    if (category === "home") {
      const monthly = homeLoanMonthly(price);
      const pct = stats.income > 0 ? (monthly / stats.income) * 100 : null;
      const months = stats.saving > 0 ? Math.ceil(price / stats.saving) : null;
      const reachYear = months !== null ? new Date(new Date().setMonth(new Date().getMonth() + months)) : null;
      return { kind: "bigItem" as const, monthly, pct, safe: pct !== null && pct <= 25, months, reachYear };
    }
    if (category === "car") {
      const monthly = carLoanMonthly(price);
      const pct = stats.income > 0 ? (monthly / stats.income) * 100 : null;
      const months = stats.saving > 0 ? Math.ceil(price / stats.saving) : null;
      const reachYear = months !== null ? new Date(new Date().setMonth(new Date().getMonth() + months)) : null;
      return { kind: "bigItem" as const, monthly, pct, safe: pct !== null && pct <= 20, months, reachYear };
    }
    const months = stats.saving > 0 ? Math.ceil(price / stats.saving) : null;
    const reachYear = months !== null ? new Date(new Date().setMonth(new Date().getMonth() + months)) : null;
    return { kind: "item" as const, canAffordNow: stats.balance >= price, balance: stats.balance, months, reachYear };
  }, [price, hasPrice, category, stats]);

  const effortColor: Record<string, string> = {
    easy: "text-emerald-600",
    moderate: "text-cyan-600",
    hard: "text-amber-600",
    veryHard: "text-rose-600",
  };
  const effortLabel: Record<string, { ja: string; en: string }> = {
    easy: { ja: "かなり楽", en: "Very easy" },
    moderate: { ja: "少し頑張れば買える", en: "Moderate effort" },
    hard: { ja: "しっかり貯めれば買える", en: "Needs saving" },
    veryHard: { ja: "長期計画が必要", en: "Long-term plan needed" },
  };

  async function queryMarketRate() {
    if (!name.trim()) return;
    setAiLoading(true);
    setAiResult("");
    try {
      const q = [
        region && `${region}`,
        store && `${store}で`,
        `「${name}」を買う場合の相場・目安価格（日本円）を教えてください。`,
        "最低・目安・高めの3段階を数字で示し、2〜3行で簡潔にまとめてください。",
      ]
        .filter(Boolean)
        .join("");
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, messages: [{ role: "user", content: q }] }),
      });
      const data = (await res.json()) as { reply?: string };
      setAiResult(data.reply ?? t("相場を取得できませんでした。", "Could not fetch market rate."));
    } catch {
      setAiResult(t("通信エラーが発生しました。", "Connection error."));
    } finally {
      setAiLoading(false);
    }
  }

  function saveAsGoal() {
    if (!name.trim() || !hasPrice) return;
    type StoredGoal = { id: string; name: string; emoji: string; targetAmount: number; currentAmount: number; memo: string; status?: string; createdAt?: string };
    const goals = load<StoredGoal[]>("kakeibo-personal-goals", []);
    goals.push({
      id: `purchase-${Date.now()}`,
      name,
      emoji: CATEGORY_EMOJI[category],
      targetAmount: price,
      currentAmount: 0,
      memo: [region && `エリア: ${region}`, store && `店: ${store}`, aiResult && aiResult.slice(0, 120)]
        .filter(Boolean)
        .join(" / "),
      status: "active",
      createdAt: new Date().toISOString(),
    });
    window.localStorage.setItem("kakeibo-personal-goals", JSON.stringify(goals));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const categoryOptions: { key: ItemCategory; ja: string; en: string }[] = [
    { key: "daily", ja: "日用品・食料品", en: "Daily / Grocery" },
    { key: "appliance", ja: "家電・スマホ・その他", en: "Appliance / Device" },
    { key: "beauty", ja: "服・美容", en: "Beauty / Clothes" },
    { key: "game", ja: "ゲーム", en: "Gaming" },
    { key: "oshi", ja: "推し活", en: "Fandom" },
    { key: "car", ja: "車・バイク", en: "Car / Bike" },
    { key: "home", ja: "住宅・マンション", en: "Home / Apartment" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] board-card border p-4">
        <h3 className="text-base font-black text-black">{t("購入アドバイザー", "Purchase Advisor")}</h3>
        <p className="mt-1 text-sm font-semibold text-black">
          {t(
            "買いたいものを入力すると、相場・購入努力・買えるラインを計算します。",
            "Enter what you want to buy and we'll calculate market rate, effort, and affordability.",
          )}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-black">{t("商品名・買いたいもの", "Item name")}</span>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setSaved(false); }}
              placeholder={t("例: 冷蔵庫 / iPhone / 中古車", "e.g. Refrigerator / iPhone / Used car")}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-black outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-black">{t("目安金額（円）", "Target price (¥)")}</span>
            <input
              type="number"
              min={0}
              value={priceStr}
              onChange={(e) => { setPriceStr(e.target.value); setSaved(false); }}
              placeholder={t("例: 80000", "e.g. 80000")}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-black outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-black">{t("地域（任意）", "Region (optional)")}</span>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder={t("例: 東京 / 大阪", "e.g. Tokyo / Osaka")}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-black outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-black">{t("店名（任意）", "Store (optional)")}</span>
            <input
              value={store}
              onChange={(e) => setStore(e.target.value)}
              placeholder={t("例: イオン / Amazon", "e.g. AEON / Amazon")}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-black outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
        </div>

        <div className="mt-3">
          <span className="mb-1.5 block text-sm font-semibold text-black">{t("カテゴリ", "Category")}</span>
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setCategory(opt.key)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  category === opt.key
                    ? "border border-slate-950 bg-cyan-500 text-white shadow-sm"
                    : "border border-slate-400 bg-white text-black hover:border-slate-500"
                }`}
              >
                {CATEGORY_EMOJI[opt.key]} {lang === "en" ? opt.en : opt.ja}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void queryMarketRate()}
          disabled={!name.trim() || aiLoading}
          className="mt-4 rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {aiLoading ? t("AIに聞いています…", "Asking AI…") : t("AIに相場を聞く", "Ask AI for market rate")}
        </button>

        {aiResult && (
          <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-black whitespace-pre-wrap">
            <p className="mb-1 text-xs font-semibold text-cyan-700">{t("AI相場情報", "AI market rate")}</p>
            {aiResult}
          </div>
        )}
      </div>

      {hasPrice && effort && (
        <div className="rounded-[24px] board-card border p-4">
          <h3 className="text-base font-black text-black">{t("購入努力スコア", "Purchase Effort Score")}</h3>
          <p className={`mt-2 text-3xl font-black ${effortColor[effort.score]}`}>
            {effort.score === "easy"
              ? t("余裕", "Easy")
              : effort.score === "moderate"
                ? t("少し頑張ろう", "Some effort")
                : effort.score === "hard"
                  ? t("計画的に", "Plan ahead")
                  : t("長期計画", "Long-term")}
          </p>
          <p className="mt-1 text-sm text-black">{lang === "en" ? effortLabel[effort.score].en : effortLabel[effort.score].ja}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {effort.incomeDays !== null && (
              <div className="rounded-2xl board-tile border p-3">
                <p className="text-xs font-semibold text-black">{t("収入換算", "Income equiv.")}</p>
                <p className="mt-1 text-xl font-black text-black">
                  {effort.incomeDays} {t("日分", "days")}
                </p>
                <p className="text-xs text-black">{t("の収入が必要", "of income needed")}</p>
              </div>
            )}
            {effort.savingMonths !== null && (
              <div className="rounded-2xl board-tile border p-3">
                <p className="text-xs font-semibold text-black">{t("貯蓄換算", "Savings equiv.")}</p>
                <p className="mt-1 text-xl font-black text-black">
                  {effort.savingMonths} {t("ヶ月", "months")}
                </p>
                <p className="text-xs text-black">{t("の貯蓄で達成", "of saving to reach")}</p>
              </div>
            )}
            {effort.incomeDays === null && effort.savingMonths === null && (
              <p className="text-sm text-black col-span-2">{t("今月の収入・貯蓄データがないため計算できません。", "No income/saving data this month.")}</p>
            )}
          </div>
        </div>
      )}

      {hasPrice && affordability && (
        <div className="rounded-[24px] board-card border p-4">
          <h3 className="text-base font-black text-black">{t("購入可能ライン", "Affordability Check")}</h3>

          {affordability.kind === "bigItem" && (
            <div className="mt-3 space-y-3">
              <div className="rounded-2xl board-tile border p-3">
                <p className="text-xs font-semibold text-black">{t("ローンで買う場合", "With loan")}</p>
                <p className="mt-1 text-lg font-black text-black">
                  {t("月々", "Monthly")} {formatCurrency(Math.round(affordability.monthly))}
                </p>
                {affordability.pct !== null && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-black">
                      <span>{t("収入の", "of income")}</span>
                      <span className="font-semibold">{affordability.pct.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-200">
                      <div
                        className={`h-2 rounded-full transition-all ${affordability.safe ? "bg-emerald-500" : "bg-rose-500"}`}
                        style={{ width: `${Math.min(affordability.pct, 100).toFixed(1)}%` }}
                      />
                    </div>
                    <p className={`mt-1 text-xs font-semibold ${affordability.safe ? "text-emerald-600" : "text-rose-600"}`}>
                      {affordability.safe
                        ? t("✓ 安全圏（25%以内）", "✓ Safe range (under 25%)")
                        : t("⚠ 収入に対して重い可能性があります", "⚠ May be heavy on income")}
                    </p>
                  </div>
                )}
              </div>
              <div className="rounded-2xl board-tile border p-3">
                <p className="text-xs font-semibold text-black">{t("現金で買う場合", "Cash purchase")}</p>
                {affordability.months !== null ? (
                  <>
                    <p className="mt-1 text-lg font-black text-black">
                      {t("あと", "In")} {affordability.months} {t("ヶ月", "months")}
                    </p>
                    {affordability.reachYear && (
                      <p className="text-xs text-black">
                        {t("達成目安:", "Target:")} {affordability.reachYear.getFullYear()}
                        {t("年", "")} {affordability.reachYear.getMonth() + 1}
                        {t("月頃", "")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-sm text-black">{t("今月の貯蓄データがないため計算できません。", "No savings data this month.")}</p>
                )}
              </div>
            </div>
          )}

          {affordability.kind === "item" && (
            <div className="mt-3 space-y-3">
              <div className={`rounded-2xl border p-3 ${affordability.canAffordNow ? "border-emerald-300 bg-emerald-50" : "board-tile border"}`}>
                {affordability.canAffordNow ? (
                  <>
                    <p className="font-semibold text-emerald-700">{t("✓ 今月の余剰で買えます", "✓ You can buy it from this month's surplus")}</p>
                    <p className="mt-1 text-xs text-black">
                      {t("今月の余剰:", "This month's surplus:")} {formatCurrency(affordability.balance)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-black">{t("今月の余剰では足りません", "Not enough from this month's surplus")}</p>
                    <p className="mt-1 text-xs text-black">
                      {t("不足:", "Shortfall:")} {formatCurrency(price - Math.max(affordability.balance, 0))}
                    </p>
                  </>
                )}
              </div>
              {affordability.months !== null && !affordability.canAffordNow && (
                <div className="rounded-2xl board-tile border p-3">
                  <p className="text-xs font-semibold text-black">{t("貯蓄で達成する場合", "Via savings")}</p>
                  <p className="mt-1 text-lg font-black text-black">
                    {t("あと", "In")} {affordability.months} {t("ヶ月", "months")}
                  </p>
                  {affordability.reachYear && (
                    <p className="text-xs text-black">
                      {t("達成目安:", "Target:")} {affordability.reachYear.getFullYear()}
                      {t("年", "")} {affordability.reachYear.getMonth() + 1}
                      {t("月頃", "")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {hasPrice && name.trim() && (
        <div className="rounded-[24px] board-card border p-4">
          <h3 className="text-base font-black text-black">{t("目標に追加", "Save as goal")}</h3>
          <p className="mt-1 text-sm text-black">
            {t(
              "「目標」タブの個人目標に追加します。進捗を管理できます。",
              "Adds to personal goals in the Goals tab so you can track progress.",
            )}
          </p>
          <button
            type="button"
            onClick={saveAsGoal}
            disabled={saved}
            className="mt-3 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-70"
          >
            {saved ? t("✓ 目標に追加しました", "✓ Added to goals") : t("目標に追加する", "Add to goals")}
          </button>
        </div>
      )}
    </div>
  );
}
