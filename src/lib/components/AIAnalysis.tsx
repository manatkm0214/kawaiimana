"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { dispatchAIInputDraft, type AIInputDraft } from "@/lib/aiInputDraft";
import type { Transaction } from "@/lib/utils";
import { useCharacterImage } from "../hooks/useCharacterImage";
import { useLang } from "@/lib/hooks/useLang";
import { useAIProvider, setAIProvider, AI_PROVIDERS } from "@/lib/hooks/useAIProvider";

const mascotsByMode = {
  normal: [
    {
      key: "girl",
      lines: [
        "まずは今月のお金の流れを一緒に見ていこう。",
        "無理のない改善から始めれば大丈夫です。",
        "できたことから積み上げれば家計は整っていきます。",
      ],
    },
    {
      key: "boy",
      lines: [
        "焦らず、続けやすい形で整えていこう。",
        "家計は少しずつ整えるほうが長続きします。",
        "数字は責めるためではなく、整えるために使おう。",
      ],
    },
  ],
  kids: [
    {
      key: "kids",
      lines: [
        "できたことを少しずつ増やしていこうね。",
        "おこづかいも目標も、ゆっくりで大丈夫だよ。",
        "見やすくすると続けやすくなるよ。",
      ],
    },
  ],
  senior: [
    {
      key: "senior",
      lines: [
        "安心を大事にしながら見直していきましょう。",
        "生活費と備えの両方を無理なく整えましょう。",
        "落ち着いて続けられる形がいちばん大切です。",
      ],
    },
  ],
} as const;

type Mode = "normal" | "kids" | "senior";
type AnalysisType = "analysis" | "saving" | "advice";

type ActionDetail = {
  title?: string;
  expected_impact_yen?: number;
  priority?: string;
};

type AnalysisResultData = {
  summary?: string;
  positives?: string[];
  warnings?: string[];
  actions?: string[];
  actions_detailed?: ActionDetail[];
};

type SavingsPlanResultData = {
  fixed_savings?: string[];
  variable_savings?: string[];
  income_boost?: string[];
  monthly_save?: string;
  summary?: string;
};

type LifeAdviceResultData = {
  life_score?: number;
  life_comment?: string;
  advice?: string[];
  next_month_goal?: string;
};

type ApplySuggestion = {
  id: string;
  label: string;
  note: string;
  draft: AIInputDraft;
};

function parseJsonBlock<T>(value: string): T | null {
  if (!value.trim()) return null;
  const stripped = value.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  const jsonStr = start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

function extractYen(value?: string) {
  if (!value) return undefined;
  const matched = value.replace(/,/g, "").match(/(\d{3,})/);
  if (!matched) return undefined;
  const amount = Number(matched[1]);
  return Number.isFinite(amount) ? amount : undefined;
}

export default function AIAnalysis({
  transactions,
  currentMonth,
  onOpenInput,
}: {
  transactions: Transaction[];
  currentMonth: string;
  onOpenInput?: () => void;
}) {
  const { characterUrl, characterName } = useCharacterImage();
  const lang = useLang();
  const t = useCallback((ja: string, en: string) => (lang === "en" ? en : ja), [lang]);

  const [mode, setMode] = useState<Mode>("normal");
  const provider = useAIProvider();
  const [analysisType, setAnalysisType] = useState<AnalysisType>("analysis");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [applyStatus, setApplyStatus] = useState("");
  const [mascotLine, setMascotLine] = useState<string>(mascotsByMode.normal[0].lines[0]);

  const randomLine = useCallback((nextMode: Mode) => {
    const lines = mascotsByMode[nextMode][0].lines;
    return lines[Math.floor(Math.random() * lines.length)];
  }, []);

  const analysisJson = useMemo(() => parseJsonBlock<AnalysisResultData>(result), [result]);
  const savingJson = useMemo(() => parseJsonBlock<SavingsPlanResultData>(result), [result]);
  const adviceJson = useMemo(() => parseJsonBlock<LifeAdviceResultData>(result), [result]);

  const applySuggestions = useMemo<ApplySuggestion[]>(() => {
    if (analysisType === "analysis" && analysisJson) {
      const detailed = (analysisJson.actions_detailed ?? [])
        .filter((item) => item.title)
        .slice(0, 3)
        .map((item, index) => {
          const draft: AIInputDraft = {
            tab: "saving",
            amount: item.expected_impact_yen,
            memo: item.title ?? "",
          };

          return {
            id: `analysis-${index}`,
            label: item.title ?? "",
            note:
              item.expected_impact_yen && item.expected_impact_yen > 0
                ? t(`見込み効果 ${item.expected_impact_yen.toLocaleString()} 円`, `Estimated impact JPY ${item.expected_impact_yen.toLocaleString()}`)
                : t("入力欄のメモへ反映", "Reflect to input memo"),
            draft,
          };
        });

      if (detailed.length > 0) return detailed;

      return (analysisJson.actions ?? []).slice(0, 3).map((item, index) => {
        const draft: AIInputDraft = {
          tab: "saving",
          memo: item,
        };

        return {
          id: `analysis-text-${index}`,
          label: item,
          note: t("入力欄のメモへ反映", "Reflect to input memo"),
          draft,
        };
      });
    }

    if (analysisType === "saving" && savingJson) {
      const list = [
        ...(savingJson.fixed_savings ?? []),
        ...(savingJson.variable_savings ?? []),
        ...(savingJson.income_boost ?? []),
      ].slice(0, 3);
      const monthlySave = extractYen(savingJson.monthly_save);

      return list.map((item, index) => {
        const draft: AIInputDraft = {
          tab: "saving",
          amount: monthlySave,
          memo: item,
        };

        return {
          id: `saving-${index}`,
          label: item,
          note: monthlySave ? t(`目安 ${monthlySave.toLocaleString()} 円`, `Guide JPY ${monthlySave.toLocaleString()}`) : t("入力欄のメモへ反映", "Reflect to input memo"),
          draft,
        };
      });
    }

    if (analysisType === "advice" && adviceJson) {
      const entries = [
        ...(adviceJson.next_month_goal ? [adviceJson.next_month_goal] : []),
        ...(adviceJson.advice ?? []),
      ].slice(0, 3);

      return entries.map((item, index) => {
        const draft: AIInputDraft = {
          tab: "expense",
          memo: item,
        };

        return {
          id: `advice-${index}`,
          label: item,
          note: t("入力欄のメモへ反映", "Reflect to input memo"),
          draft,
        };
      });
    }

    if (!result.trim()) return [];

    const draft: AIInputDraft = {
      tab: analysisType === "saving" ? "saving" : "expense",
      memo: result.slice(0, 180),
    };

    return [
      {
        id: "raw-result",
        label: t("このAI提案を入力欄へ送る", "Send this AI suggestion to input"),
        note: t("要点をメモ欄へ入れます", "Adds the result to the memo field"),
        draft,
      },
    ];
  }, [adviceJson, analysisJson, analysisType, result, savingJson, t]);

  async function handleAnalysis() {
    setLoading(true);
    setError("");
    setResult("");
    setApplyStatus("");

    try {
      let data = transactions;

      if (mode === "kids") {
        data = transactions.filter((tx) => tx.date.slice(0, 7) === currentMonth);
      } else if (mode === "senior") {
        data = transactions.filter((tx) => ["income", "expense", "saving"].includes(tx.type));
      } else if (analysisType === "analysis") {
        const months = [...new Set(transactions.map((tx) => tx.date.slice(0, 7)))].sort().reverse().slice(0, 3);
        data = transactions.filter((tx) => months.includes(tx.date.slice(0, 7)));
      } else {
        data = transactions.filter((tx) => tx.date.slice(0, 7) === currentMonth);
      }

      let apiType: string = analysisType;
      if (analysisType === "saving") apiType = "savings_plan";
      if (analysisType === "advice") apiType = "life_advice";

      const income = data.filter((tx) => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);
      const expense = data.filter((tx) => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0);
      const saving = data.filter((tx) => tx.type === "saving").reduce((s, tx) => s + tx.amount, 0);
      const investment = data.filter((tx) => tx.type === "investment").reduce((s, tx) => s + tx.amount, 0);
      const fixedExpenses = data.filter((tx) => tx.type === "expense" && tx.is_fixed).reduce((s, tx) => s + tx.amount, 0);
      const variableExpenses = expense - fixedExpenses;
      const savingRate = income > 0 ? Math.round(((saving + investment) / income) * 100) : 0;
      const fixedRate = expense > 0 ? Math.round((fixedExpenses / expense) * 100) : 0;
      const categoryExpenses: Record<string, number> = {};
      for (const tx of data.filter((tx) => tx.type === "expense")) {
        categoryExpenses[tx.category] = (categoryExpenses[tx.category] ?? 0) + tx.amount;
      }

      const statsData = {
        currentMonth,
        income,
        expense,
        saving,
        investment,
        savingRate,
        fixedRate,
        fixedExpenses,
        variableExpenses,
        takeHome: income,
        categoryExpenses,
        goal: t("生活費を抑えて貯蓄を増やす", "Reduce living expenses and increase savings"),
      };

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          lang,
          type: apiType,
          data: statsData,
        }),
      });

      const payload = (await res.json()) as { result?: string; error?: string };
      if (!res.ok) {
        throw new Error(payload.error || t("AI分析に失敗しました", "AI analysis failed"));
      }

      setResult(payload.result || "");
      setMascotLine(randomLine(mode));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("AI分析に失敗しました", "AI analysis failed"));
    } finally {
      setLoading(false);
    }
  }

  function handleApplySuggestion(draft: AIInputDraft) {
    dispatchAIInputDraft(draft);
    onOpenInput?.();
    setApplyStatus(t("入力欄へ反映しました。金額やカテゴリを確認して保存してください。", "Reflected to the input form. Review the values, then save."));
  }

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      <div className="metric-shell mt-6 flex flex-col gap-4 rounded-[28px] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-black">{t("モード", "Mode")}</span>
          {([
            { key: "normal", label: t("通常", "Normal") },
            { key: "kids", label: t("こども", "Kids") },
            { key: "senior", label: t("シニア", "Senior") },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              className={`rounded-lg border-2 px-3 py-2 text-sm font-bold ${
                mode === item.key ? "border-emerald-400 bg-emerald-950 text-emerald-200" : "border-slate-500 bg-slate-800 text-slate-100 hover:border-slate-300 hover:text-white"
              }`}
              onClick={() => {
                setMode(item.key);
                setMascotLine(randomLine(item.key));
              }}
              disabled={loading}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="metric-tile rounded-2xl border border-pink-400/35 p-3">
          {characterUrl ? (
            <Image
              src={characterUrl}
              alt={characterName || t("キャラクター画像", "Character image")}
              width={48}
              height={48}
              className="h-12 w-12 rounded-full border-2 border-pink-300 bg-white object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-pink-300 bg-slate-800 text-xl text-pink-200">
              AI
            </div>
          )}
          <div>
            <div className="mb-1 text-sm font-bold text-pink-200">{characterName || "AI"} {t("からのひとこと", "message")}</div>
            <div className="text-xs text-pink-100">{mascotLine}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-black">{t("AIプロバイダー", "AI provider")}</span>
          {AI_PROVIDERS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-bold ${provider === p.key ? `${p.color} text-white` : "border border-slate-500 bg-slate-800 text-slate-100 hover:border-slate-300 hover:text-white"}`}
              onClick={() => setAIProvider(p.key)}
              disabled={loading}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-black">{t("分析の種類", "Analysis type")}</span>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-bold ${analysisType === "analysis" ? "bg-emerald-600 text-white" : "border border-slate-500 bg-slate-800 text-slate-100 hover:border-slate-300 hover:text-white"}`}
            onClick={() => setAnalysisType("analysis")}
            disabled={loading}
          >
            {t("AI分析", "AI analysis")}
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-bold ${analysisType === "saving" ? "bg-cyan-600 text-white" : "border border-slate-500 bg-slate-800 text-slate-100 hover:border-slate-300 hover:text-white"}`}
            onClick={() => setAnalysisType("saving")}
            disabled={loading}
          >
            {t("AI節約プラン", "AI savings plan")}
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-bold ${analysisType === "advice" ? "bg-pink-600 text-white" : "border border-slate-500 bg-slate-800 text-slate-100 hover:border-slate-300 hover:text-white"}`}
            onClick={() => setAnalysisType("advice")}
            disabled={loading}
          >
            {t("AI生活アドバイス", "AI life advice")}
          </button>
        </div>

        <button
          type="button"
          className="mt-1 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
          onClick={handleAnalysis}
          disabled={loading}
        >
          {loading
            ? analysisType === "analysis"
              ? t("分析中...", "Analyzing...")
              : analysisType === "saving"
                ? t("プラン作成中...", "Creating plan...")
                : t("アドバイス作成中...", "Generating advice...")
            : analysisType === "analysis"
              ? t("AI分析を実行", "Run AI analysis")
              : analysisType === "saving"
                ? t("AI節約プランを作る", "Create AI savings plan")
                : t("AI生活アドバイスを作る", "Create AI life advice")}
        </button>

        {error && <div className="font-bold text-rose-400">{error}</div>}

        {applyStatus && (
          <div className="rounded-2xl border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm text-emerald-200">
            {applyStatus}
          </div>
        )}

        {applySuggestions.length > 0 && (
          <div className="metric-tile rounded-2xl border border-cyan-800 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-black">{t("入力欄へ反映", "Reflect to input")}</p>
                <p className="mt-1 text-xs text-black">
                  {t("AI提案をそのまま入力欄へ送って、あとから金額やカテゴリを整えられます。", "Send an AI suggestion into the input form, then adjust the amount or category.")}
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {applySuggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleApplySuggestion(item.draft)}
                  className="w-full rounded-2xl border border-cyan-700 bg-slate-900 px-4 py-3 text-left transition hover:border-cyan-400 hover:bg-slate-800"
                >
                  <p className="text-sm font-semibold text-slate-100">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-200">{item.note}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="metric-tile mt-2 whitespace-pre-wrap rounded-2xl border border-slate-600 p-4 text-black">
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
