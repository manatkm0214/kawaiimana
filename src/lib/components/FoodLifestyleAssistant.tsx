"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency, type Transaction } from "@/lib/utils";
import { useLang } from "@/lib/hooks/useLang";
import { AI_PROVIDERS, setAIProvider, useAIProvider, type AIProvider } from "@/lib/hooks/useAIProvider";

type PantryItem = {
  id: string;
  name: string;
  amount: string;
  expiresInDays: number | null;
};

type LifestyleMode = "save" | "standard" | "luxury";

type RecipeSuggestion = {
  title: string;
  reason: string;
  ingredients: string[];
  steps: string[];
  missingIngredients: string[];
  level: LifestyleMode;
};

export type LifestyleSuggestion = {
  title: string;
  body: string;
  budgetLabel: string;
};

type AssistantResponse = {
  summary: string;
  recipes: RecipeSuggestion[];
  lifestyleSuggestions: LifestyleSuggestion[];
};

const FALLBACK_RESPONSE: Record<"ja" | "en", AssistantResponse> = {
  ja: {
    summary: "\u98df\u6750\u3092\u5165\u308c\u308b\u3068\u3001\u4eca\u306e\u5bb6\u8a08\u30da\u30fc\u30b9\u306b\u5408\u3046\u4f5c\u308c\u308b\u30ec\u30b7\u30d4\u3092\u3053\u3053\u306b\u51fa\u3057\u307e\u3059\u3002",
    recipes: [],
    lifestyleSuggestions: [
      {
        title: "\u8cb7\u3044\u8db3\u3057\u306f\u5c11\u306a\u3081\u306b",
        body: "\u4eca\u3042\u308b\u98df\u6750\u3092\u5148\u306b\u4f7f\u3063\u3066\u304b\u3089\u3001\u8db3\u308a\u306a\u3044\u5206\u3060\u3051\u6570\u65e5\u5206\u307e\u3068\u3081\u3066\u8cb7\u3046\u3068\u7121\u99c4\u304c\u6e1b\u308a\u307e\u3059\u3002",
        budgetLabel: "\u98df\u8cbb\u3092\u5b89\u5b9a\u3055\u305b\u308b",
      },
    ],
  },
  en: {
    summary: "Add pantry items to see recipe ideas that fit your current budget pace.",
    recipes: [],
    lifestyleSuggestions: [
      {
        title: "Keep top-up shopping small",
        body: "Use what you already have first, then buy only what you need for the next few days.",
        budgetLabel: "Steady food spending",
      },
    ],
  },
};

function detectMode(params: { savingRate: number; balance: number; expenseRatio: number }): LifestyleMode {
  if (params.balance >= 0 && params.savingRate >= 20 && params.expenseRatio <= 0.65) return "luxury";
  if (params.balance >= 0 && params.savingRate >= 10) return "standard";
  return "save";
}

function stripCodeFence(text: string): string {
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  return start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped;
}

function normalizeLevel(level: unknown): LifestyleMode {
  return level === "luxury" || level === "standard" ? level : "save";
}

function createPantryItems(input: { names: string; amount: string; expiresInDays: string }) {
  const names = input.names
    .split(/\r?\n|,|\u3001|\uff0c/)
    .map((item) => item.trim())
    .filter(Boolean);

  return names.map((name, index) => ({
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    amount: input.amount.trim(),
    expiresInDays: input.expiresInDays ? Number(input.expiresInDays) : null,
  }));
}

function hasWord(items: PantryItem[], words: string[]) {
  return items.some((item) => words.some((word) => item.name.toLowerCase().includes(word.toLowerCase())));
}

function buildLocalResponse(items: PantryItem[], lang: "ja" | "en", mode: LifestyleMode): AssistantResponse {
  const names = items.map((item) => item.name);
  const egg = hasWord(items, ["\u5375", "\u305f\u307e\u3054", "egg"]);
  const onion = hasWord(items, ["\u7389\u306d\u304e", "\u305f\u307e\u306d\u304e", "onion"]);
  const rice = hasWord(items, ["\u3054\u98ef", "\u7c73", "rice"]);
  const cabbage = hasWord(items, ["\u30ad\u30e3\u30d9\u30c4", "cabbage"]);
  const chicken = hasWord(items, ["\u9d8f", "\u9d8f\u8089", "chicken"]);
  const pork = hasWord(items, ["\u8c5a", "\u8c5a\u8089", "pork"]);

  const recipes: RecipeSuggestion[] = [];

  if (mode === "luxury" && egg && rice) {
    recipes.push(
      lang === "en"
        ? {
            title: "Fluffy egg rice plate",
            reason: "Your current mode allows a slightly richer plate while still using pantry basics first.",
            ingredients: ["rice", "egg", "butter or oil", "soy sauce"],
            steps: ["Warm the rice", "Softly cook the egg", "Finish with butter or oil and seasoning"],
            missingIngredients: [],
            level: "luxury",
          }
        : {
            title: "\u3075\u3093\u308f\u308a\u5375\u306e\u3054\u306f\u3093\u30d7\u30ec\u30fc\u30c8",
            reason: "\u3086\u3068\u308a\u30e2\u30fc\u30c9\u306a\u306e\u3067\u3001\u3044\u307e\u3042\u308b\u98df\u6750\u3092\u4f7f\u3044\u306a\u304c\u3089\u5c11\u3057\u6e80\u8db3\u611f\u306e\u3042\u308b\u4e00\u76bf\u306b\u3067\u304d\u307e\u3059\u3002",
            ingredients: ["\u3054\u98ef", "\u5375", "\u30d0\u30bf\u30fc\u307e\u305f\u306f\u6cb9", "\u3057\u3087\u3046\u3086"],
            steps: ["\u3054\u98ef\u3092\u6e29\u3081\u308b", "\u5375\u3092\u3075\u3093\u308f\u308a\u4ed5\u4e0a\u3052\u308b", "\u8efd\u304f\u98a8\u5473\u3092\u8db3\u3057\u3066\u307e\u3068\u3081\u308b"],
            missingIngredients: [],
            level: "luxury",
          },
    );
  }

  if ((chicken || pork) && cabbage) {
    recipes.push(
      lang === "en"
        ? {
            title: "Meat and cabbage skillet",
            reason: "This makes one-pan cooking easier and helps use up vegetables quickly.",
            ingredients: [chicken ? "chicken" : "pork", "cabbage", "oil"],
            steps: ["Cook the meat first", "Add cabbage", "Season to finish in one pan"],
            missingIngredients: [],
            level: mode === "luxury" ? "luxury" : "standard",
          }
        : {
            title: "\u8089\u3068\u30ad\u30e3\u30d9\u30c4\u306e\u30d5\u30e9\u30a4\u30d1\u30f3\u7092\u3081",
            reason: "\u30ef\u30f3\u30d1\u30f3\u3067\u4f5c\u308a\u3084\u3059\u304f\u3001\u91ce\u83dc\u3082\u4e00\u7dd2\u306b\u4f7f\u3044\u5207\u308a\u3084\u3059\u3044\u7d44\u307f\u5408\u308f\u305b\u3067\u3059\u3002",
            ingredients: [chicken ? "\u9d8f\u8089" : "\u8c5a\u8089", "\u30ad\u30e3\u30d9\u30c4", "\u6cb9"],
            steps: ["\u5148\u306b\u8089\u3092\u713c\u304f", "\u30ad\u30e3\u30d9\u30c4\u3092\u52a0\u3048\u308b", "\u5473\u3092\u6574\u3048\u3066\u4ed5\u4e0a\u3052\u308b"],
            missingIngredients: [],
            level: mode === "luxury" ? "luxury" : "standard",
          },
    );
  }

  if (mode !== "save" && (chicken || pork) && onion) {
    recipes.push(
      lang === "en"
        ? {
            title: "Meat and onion bowl",
            reason: "This matches a balanced pace and turns pantry protein into an easy main dish.",
            ingredients: [chicken ? "chicken" : "pork", "onion", "soy sauce"],
            steps: ["Slice the onion", "Cook the meat", "Add onion and season for a quick bowl topping"],
            missingIngredients: rice ? [] : ["rice"],
            level: mode === "luxury" ? "luxury" : "standard",
          }
        : {
            title: "\u8089\u3068\u7389\u306d\u304e\u306e\u3063\u3051\u4e3c\u98a8",
            reason: "\u6a19\u6e96\u301c\u3086\u3068\u308a\u30e2\u30fc\u30c9\u306b\u5408\u308f\u305b\u3084\u3059\u304f\u3001\u305f\u3093\u3071\u304f\u8cea\u3092\u4e3b\u5f79\u306b\u3057\u305f\u4e00\u54c1\u306b\u3067\u304d\u307e\u3059\u3002",
            ingredients: [chicken ? "\u9d8f\u8089" : "\u8c5a\u8089", "\u7389\u306d\u304e", "\u3057\u3087\u3046\u3086"],
            steps: ["\u7389\u306d\u304e\u3092\u5207\u308b", "\u8089\u3092\u5148\u306b\u713c\u304f", "\u7389\u306d\u304e\u3068\u8abf\u5473\u6599\u3092\u5408\u308f\u305b\u3066\u4e3c\u5411\u3051\u306b\u307e\u3068\u3081\u308b"],
            missingIngredients: rice ? [] : ["\u3054\u98ef"],
            level: mode === "luxury" ? "luxury" : "standard",
          },
    );
  }

  const prioritizedRecipes = recipes
    .sort((a, b) => {
      const score = (value: LifestyleMode) => {
        if (mode === "save") return value === "save" ? 3 : value === "standard" ? 2 : 1;
        if (mode === "standard") return value === "standard" ? 3 : value === "save" ? 2 : 1;
        return value === "luxury" ? 3 : value === "standard" ? 2 : 1;
      };
      return score(b.level) - score(a.level);
    })
    .slice(0, 3);

  const modeSummary =
    lang === "en"
      ? mode === "save"
        ? "Recipes are tuned for a lighter food budget."
        : mode === "standard"
          ? "Recipes are tuned for a balanced monthly pace."
          : "Recipes are tuned for a more comfortable meal plan."
      : mode === "save"
        ? "\u30ec\u30b7\u30d4\u306f\u98df\u8cbb\u3092\u6291\u3048\u3084\u3059\u3044\u65b9\u5411\u306b\u3057\u3066\u3044\u307e\u3059\u3002"
        : mode === "standard"
          ? "\u30ec\u30b7\u30d4\u306f\u4eca\u6708\u306e\u6a19\u6e96\u30da\u30fc\u30b9\u306b\u5408\u308f\u305b\u3066\u3044\u307e\u3059\u3002"
          : "\u30ec\u30b7\u30d4\u306f\u5c11\u3057\u3086\u3068\u308a\u3042\u308b\u98df\u4e8b\u306b\u5bc4\u305b\u3066\u3044\u307e\u3059\u3002";

  const recipeCards = prioritizedRecipes;
  if (recipeCards.length === 0) {
    return {
      summary:
        lang === "en"
          ? `Current pantry items are ${names.join(", ")}. ${modeSummary}`
          : `\u4eca\u3042\u308b\u98df\u6750\u306f ${names.join("\u3001")} \u3067\u3059\u3002${modeSummary}`,
      recipes: [],
      lifestyleSuggestions:
        lang === "en"
          ? [
              {
                title: "Use pantry items first",
                body: "Build meals from the ingredients already at home, then buy only what is missing.",
                budgetLabel: "Keep food spending steady",
              },
            ]
          : [
              {
                title: "\u307e\u305a\u5bb6\u306b\u3042\u308b\u7269\u304b\u3089\u4f7f\u3046",
                body: "\u4eca\u3042\u308b\u98df\u6750\u3092\u5148\u306b\u7d44\u307f\u5408\u308f\u305b\u3066\u3001\u8db3\u308a\u306a\u3044\u7269\u3060\u3051\u5f8c\u304b\u3089\u8cb7\u3044\u8db3\u3059\u6d41\u308c\u306b\u3059\u308b\u3068\u98df\u8cbb\u304c\u5b89\u5b9a\u3057\u3084\u3059\u3044\u3067\u3059\u3002",
                budgetLabel: "\u98df\u8cbb\u3092\u5b89\u5b9a\u3055\u305b\u308b",
              },
            ],
    };
  }

  return {
    summary:
      lang === "en"
        ? `Recipes were updated from ${names.join(", ")}. ${modeSummary}`
        : `\u5165\u308c\u305f\u98df\u6750 ${names.join("\u3001")} \u3092\u3082\u3068\u306b\u3001\u4f5c\u308c\u308b\u30ec\u30b7\u30d4\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f\u3002${modeSummary}`,
    recipes: recipeCards,
    lifestyleSuggestions:
      lang === "en"
        ? [
            {
              title: "Use what expires first",
              body: "Cook ingredients with the shortest remaining life first, then keep the next shopping trip small.",
              budgetLabel: "Reduce waste",
            },
          ]
        : [
            {
              title: "\u5148\u306b\u50b7\u307f\u3084\u3059\u3044\u7269\u304b\u3089\u4f7f\u3046",
              body: "\u6b8b\u308a\u65e5\u6570\u304c\u77ed\u3044\u98df\u6750\u3092\u5148\u306b\u4f7f\u3063\u3066\u3001\u6b21\u306e\u8cb7\u3044\u8db3\u3057\u306f\u5c11\u306a\u3081\u306b\u3059\u308b\u3068\u7121\u99c4\u304c\u51fa\u306b\u304f\u304f\u306a\u308a\u307e\u3059\u3002",
              budgetLabel: "\u98df\u54c1\u30ed\u30b9\u3092\u6e1b\u3089\u3059",
            },
          ],
  };
}

function parseAssistantResponse(raw: string, lang: "ja" | "en"): AssistantResponse {
  const parsed = JSON.parse(stripCodeFence(raw)) as Partial<AssistantResponse>;

  const recipes = Array.isArray(parsed.recipes)
    ? parsed.recipes
        .map((recipe) => ({
          title: typeof recipe?.title === "string" ? recipe.title : lang === "en" ? "Recipe idea" : "\u4f5c\u308c\u308b\u30ec\u30b7\u30d4",
          reason: typeof recipe?.reason === "string" ? recipe.reason : "",
          ingredients: Array.isArray(recipe?.ingredients) ? recipe.ingredients.filter((v): v is string => typeof v === "string") : [],
          steps: Array.isArray(recipe?.steps) ? recipe.steps.filter((v): v is string => typeof v === "string") : [],
          missingIngredients: Array.isArray(recipe?.missingIngredients)
            ? recipe.missingIngredients.filter((v): v is string => typeof v === "string")
            : [],
          level: normalizeLevel(recipe?.level),
        }))
        .slice(0, 3)
    : [];

  const lifestyleSuggestions = Array.isArray(parsed.lifestyleSuggestions)
    ? parsed.lifestyleSuggestions
        .map((card) => ({
          title: typeof card?.title === "string" ? card.title : lang === "en" ? "Lifestyle idea" : "\u66ae\u3089\u3057\u5b9f\u614b\u304a\u3059\u3059\u3081",
          body: typeof card?.body === "string" ? card.body : "",
          budgetLabel: typeof card?.budgetLabel === "string" ? card.budgetLabel : "",
        }))
        .slice(0, 3)
    : [];

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : FALLBACK_RESPONSE[lang].summary,
    recipes: recipes.length > 0 ? recipes : FALLBACK_RESPONSE[lang].recipes,
    lifestyleSuggestions: lifestyleSuggestions.length > 0 ? lifestyleSuggestions : FALLBACK_RESPONSE[lang].lifestyleSuggestions,
  };
}

export default function FoodLifestyleAssistant({
  transactions,
  currentMonth,
  area,
  supportMode,
  onLifestyleSuggestionsChange,
}: {
  transactions: Transaction[];
  currentMonth: string;
  area: string;
  supportMode: LifestyleMode;
  onLifestyleSuggestionsChange: (value: LifestyleSuggestion[]) => void;
}) {
  const lang = useLang();
  const aiProvider = useAIProvider();
  const locale = lang === "en" ? "en" : "ja";
  const t = useCallback((ja: string, en: string) => (lang === "en" ? en : ja), [lang]);

  const [items, setItems] = useState<PantryItem[]>([]);
  const [names, setNames] = useState("");
  const [amount, setAmount] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [result, setResult] = useState<AssistantResponse>(FALLBACK_RESPONSE[locale]);
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [lastRequestedProvider, setLastRequestedProvider] = useState<AIProvider | null>(null);
  const [responseProvider, setResponseProvider] = useState<AIProvider | null>(null);

  const selectedProviderMeta = AI_PROVIDERS.find((provider) => provider.key === aiProvider) ?? AI_PROVIDERS[0];
  const requestedProviderMeta = lastRequestedProvider
    ? (AI_PROVIDERS.find((provider) => provider.key === lastRequestedProvider) ?? selectedProviderMeta)
    : null;
  const responseProviderMeta = responseProvider
    ? (AI_PROVIDERS.find((provider) => provider.key === responseProvider) ?? selectedProviderMeta)
    : null;

  useEffect(() => {
    setResult(FALLBACK_RESPONSE[locale]);
  }, [locale]);

  useEffect(() => {
    onLifestyleSuggestionsChange(result.lifestyleSuggestions);
  }, [onLifestyleSuggestionsChange, result.lifestyleSuggestions]);

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

  const requestAnalysis = useCallback(
    async (nextItems: PantryItem[], nextArea: string) => {
      if (nextItems.length === 0) {
        setResult(FALLBACK_RESPONSE[locale]);
        setLastRequestedProvider(null);
        setResponseProvider(null);
        return;
      }

      const local = buildLocalResponse(nextItems, locale, mode);
      setResult(local);
      setAiError("");
      setLastRequestedProvider(aiProvider);
      setLoading(true);

      try {
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: aiProvider,
            type: "food_lifestyle",
            data: {
              lang,
              currentMonth,
              area: nextArea.trim(),
              pantryItems: nextItems.map((item) => ({
                name: item.name,
                amount: item.amount,
                expiresInDays: item.expiresInDays,
              })),
              stats,
              mode,
            },
          }),
        });

        const payload = (await response.json()) as { error?: string; result?: string; provider?: AIProvider };
        if (!response.ok || !payload.result) {
          throw new Error(payload.error ?? t("AI応答を取得できませんでした", "Could not get AI response"));
        }

        setResult(parseAssistantResponse(payload.result, locale));
        setResponseProvider(payload.provider ?? aiProvider);
      } catch (e) {
        setResponseProvider(null);
        setAiError(e instanceof Error ? e.message : t("AIレシピの取得に失敗しました", "Failed to get AI recipes"));
      } finally {
        setLoading(false);
      }
    },
    [aiProvider, currentMonth, lang, locale, mode, stats, t],
  );

  useEffect(() => {
    if (items.length === 0) return;
    const timer = window.setTimeout(() => {
      void requestAnalysis(items, area);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [area, items, requestAnalysis]);

  function addItems() {
    const nextItems = createPantryItems({ names, amount, expiresInDays });
    if (nextItems.length === 0) {
      return;
    }

    setItems((prev) => {
      const merged = [...nextItems, ...prev];
      void requestAnalysis(merged, area);
      return merged;
    });
    setNames("");
    setAmount("");
    setExpiresInDays("");
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      if (filtered.length > 0) {
        void requestAnalysis(filtered, area);
      } else {
        setResult(FALLBACK_RESPONSE[locale]);
      }
      return filtered;
    });
  }

  function clearAssistant() {
    setItems([]);
    setNames("");
    setAmount("");
    setExpiresInDays("");
    setResult(FALLBACK_RESPONSE[locale]);
    setAiError("");
    setLastRequestedProvider(null);
    setResponseProvider(null);
  }

  return (
    <div className="flex h-full min-w-0 flex-col rounded-[28px] board-card border p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-black drop-shadow-[0_2px_0_rgba(0,0,0,0.22)]">{t("\u0041\u0049\u98df\u4e8b\u30a2\u30b7\u30b9\u30c8", "Food AI assistant")}</h3>
          <p style={{ marginTop: "0.25rem", fontSize: "1rem", fontWeight: 900, color: "#000000", textShadow: "0 1px 0 rgba(0,0,0,0.14)" }}>
            {t("\u98df\u6750\u3092\u307e\u3068\u3081\u3066\u5165\u308c\u308b\u3068\u3001\u307e\u305a\u3059\u3050\u5019\u88dc\u3092\u51fa\u3057\u3001\u305d\u306e\u5f8c\u306b AI \u306e\u63d0\u6848\u3067\u66f4\u65b0\u3057\u307e\u3059\u3002", "Add pantry items to get instant local recipes first, then refine them with AI.")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-black">AI</span>
            {AI_PROVIDERS.map((provider) => (
              <button
                key={provider.key}
                type="button"
                onClick={() => setAIProvider(provider.key)}
                disabled={loading}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  aiProvider === provider.key
                    ? `${provider.color} text-white shadow-sm`
                    : "border border-slate-300 bg-white text-black hover:border-slate-400"
                }`}
              >
                {provider.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-700">
            {loading
              ? t(`${selectedProviderMeta.label} でAI更新中です。`, `Refreshing with ${selectedProviderMeta.label}.`)
              : responseProviderMeta && requestedProviderMeta && responseProviderMeta.key !== requestedProviderMeta.key
                ? t(
                    `${requestedProviderMeta.label} を選択し、${responseProviderMeta.label} で応答しました。`,
                    `Selected ${requestedProviderMeta.label}; responded with ${responseProviderMeta.label}.`,
                  )
                : responseProviderMeta
                  ? t(`${responseProviderMeta.label} が応答しました。`, `${responseProviderMeta.label} responded.`)
                  : t(
                      `${selectedProviderMeta.label} を使うように選べます。`,
                      `Choose which AI to use. Currently selected: ${selectedProviderMeta.label}.`,
                    )}
          </p>
        </div>
        <span
          className={`w-fit shrink-0 rounded-full border-2 px-3.5 py-2 text-sm font-black shadow-sm ${
            mode === "save"
              ? "border-slate-500 bg-amber-100 text-black"
              : mode === "standard"
                ? "border-slate-500 bg-cyan-100 text-black"
                : "border-slate-500 bg-pink-100 text-black"
          }`}
        >
          {mode === "save" ? t("\u7bc0\u7d04\u30e2\u30fc\u30c9", "Save mode") : mode === "standard" ? t("\u6a19\u6e96\u30e2\u30fc\u30c9", "Balanced mode") : t("\u3086\u3068\u308a\u30e2\u30fc\u30c9", "Treat mode")}
        </span>
      </div>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-3">
          <div className="rounded-2xl board-tile border p-3">
            <div className="mx-auto max-w-[640px]">
              <label className="block">
                <span className="mb-1.5 block text-sm font-extrabold text-black drop-shadow-[0_1px_0_rgba(0,0,0,0.22)]">{t("\u98df\u6750\u540d", "Ingredients")}</span>
                <textarea
                  value={names}
                  onChange={(event) => setNames(event.target.value)}
                  placeholder={t("\u4f8b: \u5375\u3001\u7389\u306d\u304e\u3001\u8c46\u8150\n\u8aad\u70b9\u30fb\u30ab\u30f3\u30de\u30fb\u6539\u884c\u3067\u8907\u6570\u5165\u529b\u3067\u304d\u307e\u3059", "e.g. eggs, onion, tofu\nUse commas or new lines for multiple items")}
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-extrabold text-black outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-extrabold text-black drop-shadow-[0_1px_0_rgba(0,0,0,0.22)]">{t("\u91cf", "Amount")}</span>
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder={t("\u4f8b: 2\u500b / 1\u30d1\u30c3\u30af", "e.g. 2 pieces / 1 pack")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-extrabold text-black outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-extrabold text-black drop-shadow-[0_1px_0_rgba(0,0,0,0.22)]">{t("\u6b8b\u308a\u65e5\u6570", "Days left")}</span>
                  <input
                    value={expiresInDays}
                    onChange={(event) => setExpiresInDays(event.target.value)}
                    placeholder={t("\u4f8b: 3", "e.g. 3")}
                    type="number"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-extrabold text-black outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={addItems} className="min-h-[50px] whitespace-nowrap rounded-full bg-cyan-400 px-5 text-sm font-semibold text-black">
                  {t("\u98df\u6750\u3092\u8ffd\u52a0", "Add ingredients")}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl board-tile border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-black">{t("\u5165\u308c\u305f\u98df\u6750", "Pantry items")}</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-black">{items.length}{t("\u4ef6", " items")}</span>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAssistant}
                    className="text-xs font-semibold text-black transition hover:text-black"
                  >
                    {t("\u8868\u793a\u3092\u524a\u9664", "Clear shown items")}
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3 max-h-[240px] space-y-2 overflow-y-auto pr-1">
              {items.length === 0 ? (
                <p className="text-sm text-black">{t("\u5375\u3001\u7389\u306d\u304e\u3001\u8c46\u8150\u306a\u3069\u3001\u4eca\u3042\u308b\u98df\u6750\u3092\u307e\u3068\u3081\u3066\u5165\u308c\u3066\u307f\u3066\u304f\u3060\u3055\u3044\u3002", "Add several pantry staples such as eggs, onion, or tofu.")}</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl board-tile border px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-black drop-shadow-[0_2px_0_rgba(0,0,0,0.65)]">{item.name}</p>
                      <p className="mt-1 text-xs font-extrabold text-black drop-shadow-[0_2px_0_rgba(0,0,0,0.65)]">
                        {[item.amount, item.expiresInDays != null ? t(`\u3042\u3068${item.expiresInDays}\u65e5`, `${item.expiresInDays} days left`) : ""].filter(Boolean).join(" / ")}
                      </p>
                    </div>
                    <button type="button" onClick={() => removeItem(item.id)} className="text-xs font-semibold text-black hover:text-black">
                      {t("\u524a\u9664", "Delete")}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="rounded-2xl board-tile border p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black text-black">{t("\u4f5c\u308c\u308b\u30ec\u30b7\u30d4", "Recipe ideas")}</p>
                <p className="mt-1 text-xs text-black">{t("\u4eca\u6708\u306e\u5dee\u984d", "Current balance")}: {formatCurrency(stats.balance)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={clearAssistant}
                  disabled={items.length === 0}
                  className="recipe-clear-button min-h-[50px] rounded-full px-4 py-2.5 text-sm font-semibold transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("\u30ec\u30b7\u30d4\u5019\u88dc\u3092\u6d88\u53bb", "Clear recipe ideas")}
                </button>
                <button
                  type="button"
                  onClick={() => void requestAnalysis(items, area)}
                  disabled={loading || items.length === 0}
                  className="rounded-full border border-slate-400 bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
                >
                  {loading ? t("\u66f4\u65b0\u4e2d...", "Updating...") : t("\u4eca\u3059\u3050\u66f4\u65b0", "Refresh now")}
                </button>
              </div>
            </div>

            {result.summary && (
              <p className="mt-2 text-xs text-slate-700">{result.summary}</p>
            )}

            {aiError && (
              <p className="mt-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {aiError}
              </p>
            )}

            <div className="mt-3 space-y-2">
              {result.recipes.length === 0 && items.length > 0 && !loading && (
                <p className="text-xs text-slate-700">
                  {t("今ある食材でのレシピ候補が見つかりませんでした。食材を追加するか「今すぐ更新」を押してAIに聞いてみてください。", "No local recipe matched your pantry. Add more items or tap Refresh now to ask AI.")}
                </p>
              )}
              {result.recipes.map((recipe) => (
                <div key={`${recipe.title}-${recipe.reason}`} className="rounded-2xl board-tile border p-3">
                  <p className="text-sm font-extrabold text-black drop-shadow-[0_2px_0_rgba(0,0,0,0.65)]">{recipe.title}</p>
                  {recipe.reason && (
                    <p className="mt-1 text-xs text-slate-900">{recipe.reason}</p>
                  )}
                </div>
              ))}
              {result.lifestyleSuggestions.map((card) => {
                const isWarning = card.title.includes("要改善") || card.body.includes("要改善") || card.budgetLabel.includes("要改善") || card.title.toLowerCase().includes("improve") || card.body.toLowerCase().includes("improve");
                const isGood = card.title.includes("良") || card.body.includes("良") || card.budgetLabel.includes("良") || card.title.toLowerCase().includes("good") || card.body.toLowerCase().includes("good");
                return (
                  <div key={card.title + card.body} className="rounded-2xl board-tile border p-3">
                    <p className={`text-sm font-extrabold drop-shadow-[0_2px_0_rgba(0,0,0,0.65)] ${isWarning ? 'text-red-600' : isGood ? 'text-emerald-600' : 'text-black'}`}>{card.title}</p>
                    <p className="mt-1 text-xs text-slate-900">{card.body}</p>
                    {card.budgetLabel && <span className="mt-1 inline-block text-xs font-bold text-black">{card.budgetLabel}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
