"use client";

import { useEffect, useMemo, useState } from "react";
import BudgetSurplusPanel from "./BudgetSurplusPanel";
import DebitReservationPanel from "./DebitReservationPanel";
import BudgetTradeoffPanel from "./BudgetTradeoffPanel";
import Charts from "./Charts";
import Calendar from "./Calendar";
import GoalsAndDebt from "./GoalsAndDebt";
import GenerationGoals from "./GenerationGoals";
import AIAnalysis from "./AIAnalysis";
import AIChat from "./AIChat";
import AnnualReportFull from "./AnnualReportFull";
import InputForm from "./InputForm";
import SeniorDashboard from "./SeniorDashboard";
import EconomicBenchmarkGuide from "./EconomicBenchmarkGuide";
import FoodLifestyleAssistant, { type LifestyleSuggestion } from "./FoodLifestyleAssistant";
import NearbyShopGuide from "./NearbyShopGuide";
import { KidsFinanceDashboard, type KidsFinanceState } from "./KidsDashboard";
import { KidsExpenseForm, type KidsExpense } from "./KidsExpenseForm";
import { KidsIncomeForm, type KidsIncome } from "./KidsIncomeForm";
import { KidsSavingForm } from "./KidsSavingForm";
import { KidsGoalForm } from "./KidsGoalForm";
import type { KidsSavingsGoal } from "../types/kids-finance";
import PurchaseAdvisor from "./PurchaseAdvisor";
import type { Budget, Profile, Transaction } from "@/lib/utils";
import { formatCurrency, getCategoryLabel, PASSIVE_INCOME_CATEGORIES } from "@/lib/utils";
import { useLang } from "@/lib/hooks/useLang";
import { buildFixedCostFlags, loadHiddenFixedCostFlagIds, loadReviewedFixedCostFlagIds } from "@/lib/fixed-cost-flags";

type ActivePage = "input" | "charts" | "calendar" | "goals" | "ai" | "annual" | "benchmarks" | "senior" | "kids";

function AIPageView({
  transactions,
  budgets,
  currentMonth,
  onOpenInput,
}: {
  transactions: Transaction[];
  budgets: Budget[];
  currentMonth: string;
  onOpenInput: () => void;
}) {
  const lang = useLang();
  const [activeTab, setActiveTab] = useState<'analysis' | 'chat'>('analysis');
  return (
    <div className="space-y-5">
      <div className="board-card border rounded-[28px] px-4 py-4 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-black">AI</p>
        <h2 className="mt-1 text-lg font-black text-black">
          {lang === "en" ? "AI support" : "AIサポート"}
        </h2>
        <p className="mt-1 text-sm font-extrabold text-black">
          {lang === "en"
            ? "You can use three AI features: analysis/advice, savings plan, and chat consultation."
            : "AI生活分析・AI節約アドバイス・AIチャット相談の三機能が使えます。"}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            className={`rounded-full border px-4 py-2 text-sm font-bold transition ${activeTab === 'analysis' ? 'border-cyan-700 bg-cyan-100 text-black' : 'border-slate-400 bg-white text-black hover:border-cyan-400'}`}
            onClick={() => setActiveTab('analysis')}
          >
            {lang === "en" ? "AI Analysis / Advice" : "AI分析・アドバイス"}
          </button>
          <button
            className={`rounded-full border px-4 py-2 text-sm font-bold transition ${activeTab === 'chat' ? 'border-cyan-700 bg-cyan-100 text-black' : 'border-slate-400 bg-white text-black hover:border-cyan-400'}`}
            onClick={() => setActiveTab('chat')}
          >
            {lang === "en" ? "AI Chat Consultation" : "AIチャット相談"}
          </button>
        </div>
      </div>
      <div>
        {activeTab === 'analysis' ? (
          <AIAnalysis
            transactions={transactions}
            currentMonth={currentMonth}
            onOpenInput={onOpenInput}
          />
        ) : (
          <AIChat
            transactions={transactions}
            budgets={budgets}
            currentMonth={currentMonth}
          />
        )}
      </div>
    </div>
  );
}
export const LABELS = {
  ja: {
    summary: "サマリー",
    goal: "目標",
    child: "こども",
    elder: "シニア",
    loan: "ローン",
    customize: "カスタマイズ",
    print: "印刷",
    share: "共有",
    category: {},
    categoryAllocation: "カテゴリごとの目安",
    detailMetrics: "家計の目安",
    forecast: "予測",
    defense: "生活防衛資金",
    improvement: "見直しポイント",
    setup: "設定",
    notSet: "未設定",
    actual: "実績",
    target: "目標",
  },
  en: {
    summary: "Summary",
    goal: "Goals",
    child: "Kids",
    elder: "Senior",
    loan: "Loan",
    customize: "Customize",
    print: "Print",
    share: "Share",
    category: {},
    categoryAllocation: "Category guide",
    detailMetrics: "Household highlights",
    forecast: "Forecast",
    defense: "Emergency fund",
    improvement: "Things to improve",
    setup: "Open settings",
    notSet: "Not set",
    actual: "Actual",
    target: "Target",
  },
} as const;

const LEGACY_CATEGORY_LABELS: Record<string, { ja: string; en: string }> = {
  Housing: { ja: "住まい", en: "Housing" },
  Food: { ja: "食費", en: "Food" },
  Utilities: { ja: "水道・光熱", en: "Utilities" },
  Transport: { ja: "交通", en: "Transport" },
  Daily: { ja: "日用品", en: "Daily goods" },
  Leisure: { ja: "レジャー", en: "Leisure" },
  Education: { ja: "教育", en: "Education" },
  Health: { ja: "医療", en: "Medical" },
  Other: { ja: "その他", en: "Other" },
  "Beauty / clothes": { ja: "衣服・美容", en: "Clothes / beauty" },
  "美容・衣服": { ja: "衣服・美容", en: "Clothes / beauty" },
  "衣服・美容": { ja: "衣服・美容", en: "Clothes / beauty" },
  "鄒主ｮｹ繝ｻ陦｣譛・": { ja: "衣服・美容", en: "Clothes / beauty" },
};

const BUDGET_CATEGORY_ALIASES: Record<string, string[]> = {
  "衣服・美容": ["衣服・美容", "美容・衣服", "Beauty / clothes", "鄒主ｮｹ繝ｻ陦｣譛・"],
};

function normalizeBudgetCategory(category: string) {
  for (const [canonical, aliases] of Object.entries(BUDGET_CATEGORY_ALIASES)) {
    if (aliases.includes(category)) return canonical;
  }
  return category;
}

function getBudgetCategoryLabel(category: string, lang: "ja" | "en") {
  const normalizedCategory = normalizeBudgetCategory(category);
  const legacy = LEGACY_CATEGORY_LABELS[normalizedCategory] ?? LEGACY_CATEGORY_LABELS[category];
  if (legacy) return lang === "en" ? legacy.en : legacy.ja;
  return getCategoryLabel(normalizedCategory, lang);
}

function getBudgetActualAmount(category: string, categoryMap: Record<string, number>) {
  const normalizedCategory = normalizeBudgetCategory(category);
  if (normalizedCategory === "衣服・美容") {
    return BUDGET_CATEGORY_ALIASES["衣服・美容"].reduce((sum, key) => sum + (categoryMap[key] ?? 0), 0);
  }
  return categoryMap[normalizedCategory] ?? categoryMap[category] ?? 0;
}

function readSavingsGoalFromStorage(): number {
  if (typeof window === "undefined") return 0;
  const raw = Number(window.localStorage.getItem("kakeibo-savings-goal") || 0);
  return Number.isFinite(raw) ? raw : 0;
}

function readGoalNumberFromStorage(key: string): number {
  if (typeof window === "undefined") return 0;
  const raw = Number(window.localStorage.getItem(key) || 0);
  return Number.isFinite(raw) ? raw : 0;
}

function getMonthSeries(currentMonth: string, count: number) {
  const [year, month] = currentMonth.split("-").map(Number);
  return Array.from({ length: count }).map((_, index) => {
    const date = new Date(year, month - 1 - index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

export default function Dashboard({
  transactions,
  budgets,
  currentMonth,
  profile,
}: {
  transactions: Transaction[];
  budgets: Budget[];
  currentMonth: string;
  profile?: Profile | null;
}) {
  const lang = useLang();
  const [activePage, setActivePage] = useState<ActivePage>("input");
  const [carryoverAmount, setCarryoverAmount] = useState(0);
  const [pendingDebitTotal, setPendingDebitTotal] = useState(0);
  const [tradeoffNotice, setTradeoffNotice] = useState<{ target_category: string; reduced_by: number }[]>([]);
  const [goalGeneration, setGoalGeneration] = useState<"general" | "kids" | "senior">("general");
  const [sharedArea, setSharedArea] = useState("");
  const [supportMode, setSupportMode] = useState<"save" | "standard" | "luxury">("standard");
  const [lifestyleSuggestions, setLifestyleSuggestions] = useState<LifestyleSuggestion[]>([]);
  const [reviewedFixedCostFlagIds, setReviewedFixedCostFlagIds] = useState<string[]>(() => loadReviewedFixedCostFlagIds());
  const [hiddenFixedCostFlagIds, setHiddenFixedCostFlagIds] = useState<string[]>(() => loadHiddenFixedCostFlagIds());

  const defaultSavingsGoal: KidsSavingsGoal = { title: "", targetAmount: 0, currentAmount: 0 };
  const [kidsState, setKidsState] = useState<KidsFinanceState>(() => {
    if (typeof window === "undefined") {
      return { incomes: [], expenses: [], savings: 0, monthlyBudget: 0, savingsGoal: defaultSavingsGoal };
    }
    try {
      const raw = window.localStorage.getItem("kakeibo-kids-state");
      return raw
        ? (JSON.parse(raw) as KidsFinanceState)
        : { incomes: [], expenses: [], savings: 0, monthlyBudget: 0, savingsGoal: defaultSavingsGoal };
    } catch {
      return { incomes: [], expenses: [], savings: 0, monthlyBudget: 0, savingsGoal: defaultSavingsGoal };
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("kakeibo-kids-state", JSON.stringify(kidsState));
  }, [kidsState]);

  useEffect(() => {
    function handleFixedCostFlagsUpdated(event: Event) {
      const detail = (event as CustomEvent<string[] | { reviewedIds?: string[]; hiddenIds?: string[] }>).detail;
      if (Array.isArray(detail)) {
        setReviewedFixedCostFlagIds(detail);
        setHiddenFixedCostFlagIds(loadHiddenFixedCostFlagIds());
        return;
      }
      setReviewedFixedCostFlagIds(Array.isArray(detail?.reviewedIds) ? detail.reviewedIds : loadReviewedFixedCostFlagIds());
      setHiddenFixedCostFlagIds(Array.isArray(detail?.hiddenIds) ? detail.hiddenIds : loadHiddenFixedCostFlagIds());
    }

    window.addEventListener("kakeibo-fixed-cost-flags-updated", handleFixedCostFlagsUpdated);
    return () => window.removeEventListener("kakeibo-fixed-cost-flags-updated", handleFixedCostFlagsUpdated);
  }, []);

  const stats = useMemo(() => {
    const monthly = transactions.filter((item) => item.date.startsWith(currentMonth));
    const income = monthly.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const expense = monthly.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
    const saving = monthly.filter((item) => item.type === "saving").reduce((sum, item) => sum + item.amount, 0);
    const investment = monthly.filter((item) => item.type === "investment").reduce((sum, item) => sum + item.amount, 0);
    const fixed = monthly.filter((item) => item.type === "expense" && item.is_fixed).reduce((sum, item) => sum + item.amount, 0);
    const waste = monthly
      .filter((item) => item.type === "expense")
      .filter((item) => {
        const label = getCategoryLabel(item.category, "en");
        return label === "Entertainment" || label === "Leisure" || label === "Hobby";
      })
      .reduce((sum, item) => sum + item.amount, 0);
    const passiveIncome = monthly
      .filter((item) => item.type === "income" && PASSIVE_INCOME_CATEGORIES.includes(item.category as typeof PASSIVE_INCOME_CATEGORIES[number]))
      .reduce((sum, item) => sum + item.amount, 0);
    const balance = income - expense - saving - investment;
    const savingRate = income > 0 ? Math.round(((saving + investment) / income) * 100) : 0;
    const fixedRate = expense > 0 ? Math.round((fixed / expense) * 100) : 0;
    const reserveStock = transactions
      .filter((item) => item.type === "saving" || item.type === "investment")
      .reduce((sum, item) => sum + item.amount, 0);

    const categoryMap: Record<string, number> = {};
    monthly.filter((item) => item.type === "expense").forEach((item) => {
      categoryMap[item.category] = (categoryMap[item.category] ?? 0) + item.amount;
    });

    const budgetProgress = budgets
      .filter((item) => item.month === currentMonth)
      .map((item) => {
        const spent = monthly
          .filter((tx) => tx.type === "expense" && tx.category === item.category)
          .reduce((sum, tx) => sum + tx.amount, 0);
        const pct = item.amount > 0 ? Math.round((spent / item.amount) * 100) : 0;
        return { ...item, spent, pct };
      });

    return {
      income,
      expense,
      saving,
      investment,
      fixed,
      waste,
      passiveIncome,
      balance,
      savingRate,
      fixedRate,
      reserveStock,
      budgetProgress,
      categoryMap,
    };
  }, [budgets, currentMonth, transactions]);

  const detailMetrics = useMemo(
    () => {
      const totalSaved = stats.saving + stats.investment;
      const investmentRate = stats.income > 0 ? Math.round((stats.investment / stats.income) * 100) : 0;
      const emergencyMonths = stats.expense > 0 ? Number((stats.reserveStock / stats.expense).toFixed(1)) : 0;
      const wasteRate = stats.expense > 0 ? Math.round((stats.waste / stats.expense) * 100) : 0;
      const passiveIncomeRate = stats.income > 0 ? Math.round((stats.passiveIncome / stats.income) * 100) : 0;
      const budgetTotal = stats.budgetProgress.reduce((sum, item) => sum + item.amount, 0);
      const budgetUsageRate = budgetTotal > 0 ? Math.round((stats.expense / budgetTotal) * 100) : 0;
      const savingEfficiency =
        budgetTotal > 0
          ? stats.expense <= 0
            ? 0
            : Math.max(-999, Math.min(999, Math.round(((budgetTotal - stats.expense) / budgetTotal) * 100)))
          : 0;
      const savingGoal = readGoalNumberFromStorage("kakeibo-gen-saving-goal") || readSavingsGoalFromStorage();
      const payYourselfFirstProgress = savingGoal > 0 ? Math.round((stats.saving / savingGoal) * 100) : 0;
      const defenseTarget = readGoalNumberFromStorage("kakeibo-gen-defense-goal") || Math.round(stats.expense * 6);
      const defenseAchievement = defenseTarget > 0 ? Math.round((stats.reserveStock / defenseTarget) * 100) : 0;
      const passiveIncomeGoal = readGoalNumberFromStorage("kakeibo-gen-passive-income-goal");
      const recentBalances = getMonthSeries(currentMonth, 3).map((monthKey) => {
        const monthly = transactions.filter((item) => item.date.startsWith(monthKey));
        const income = monthly.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
        const expense = monthly.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
        const saved = monthly
          .filter((item) => item.type === "saving" || item.type === "investment")
          .reduce((sum, item) => sum + item.amount, 0);
        return income - expense - saved;
      });
      const avgBalance =
        recentBalances.length > 0
          ? recentBalances.reduce((sum, value) => sum + value, 0) / recentBalances.length
          : stats.balance;
      const stabilityDeviation =
        recentBalances.length > 1
          ? Math.round(
              Math.sqrt(
                recentBalances.reduce((sum, value) => sum + (value - avgBalance) ** 2, 0) / recentBalances.length,
              ),
            )
          : 0;

      return [
        {
          label: lang === "en" ? "Savings rate" : "貯蓄率",
          value: `${stats.savingRate}%`,
          sub: lang === "en" ? "Classic benchmark: 20%+ is healthy" : "家計管理の定番目安は 20% 以上",
          ok: stats.savingRate >= 20,
        },
        {
          label: lang === "en" ? "Fixed-cost ratio" : "固定費比率",
          value: `${stats.fixedRate}%`,
          sub: lang === "en" ? "Lower fixed costs increase resilience" : "固定費を抑えるほど家計の柔軟性が増える",
          ok: stats.fixedRate <= 60,
        },
        {
          label: lang === "en" ? "Saving efficiency" : "節約率",
          value: `${savingEfficiency}%`,
          sub:
            budgetTotal > 0
              ? lang === "en"
                ? stats.expense <= 0
                  ? "Starts at 0% until spending begins"
                  : "Reflected from allocation preset budget"
                : stats.expense <= 0
                  ? "支出が始まるまでは 0% スタート"
                  : "配分プリセットの予算に対してどれだけ節約できたか"
              : lang === "en"
                ? "Starts at 0% until a preset budget is applied"
                : "配分プリセット反映前は 0% から開始",
          ok: budgetTotal === 0 ? true : stats.expense <= budgetTotal,
        },
        {
          label: lang === "en" ? "Waste rate" : "浪費率",
          value: `${wasteRate}%`,
          sub: lang === "en" ? "Entertainment, leisure, and hobby share in total expenses" : "娯楽・レジャー・趣味が支出全体に占める割合",
          ok: wasteRate <= 15,
        },
        {
          label: lang === "en" ? "Advance saving achievement" : "先取貯金達成度",
          value: savingGoal > 0 ? `${payYourselfFirstProgress}%` : (lang === "en" ? "No target" : "目標未設定"),
          sub: lang === "en" ? "Progress against the preset pay-yourself-first goal" : "配分プリセットの先取貯金目標に対する達成度",
          ok: savingGoal === 0 ? true : payYourselfFirstProgress >= 100,
        },
        {
          label: lang === "en" ? "Emergency fund achievement" : "生活防衛資金達成度",
          value: defenseTarget > 0 ? `${defenseAchievement}%` : (lang === "en" ? "No target" : "目標未設定"),
          sub:
            lang === "en"
              ? `Preset-linked target: ${formatCurrency(defenseTarget)} / ${emergencyMonths} months`
              : `配分プリセット連動目標: ${formatCurrency(defenseTarget)} / ${emergencyMonths}か月分`,
          ok: defenseTarget === 0 ? true : defenseAchievement >= 100,
        },
        {
          label: lang === "en" ? "Passive income rate" : "受動収入率",
          value: `${passiveIncomeRate}%`,
          sub:
            passiveIncomeGoal > 0
              ? lang === "en"
                ? `Preset passive-income goal: ${formatCurrency(passiveIncomeGoal)}`
                : `配分プリセットの受動収入目標: ${formatCurrency(passiveIncomeGoal)}`
              : lang === "en"
                ? "Passive income share of total income"
                : "総収入に対する受動収入の割合",
          ok: passiveIncomeGoal > 0 ? stats.passiveIncome >= passiveIncomeGoal : passiveIncomeRate >= 10,
        },
        {
          label: lang === "en" ? "Cashflow stability" : "収支安定性",
          value: formatCurrency(stabilityDeviation),
          sub: lang === "en" ? "3-month balance deviation, lower is steadier" : "直近3か月の差額ぶれ幅。小さいほど安定",
          ok: stabilityDeviation <= 30000,
        },
        {
          label: lang === "en" ? "Budget usage" : "予算消化率",
          value: budgetTotal > 0 ? `${budgetUsageRate}%` : (lang === "en" ? "No budget" : "予算未設定"),
          sub: lang === "en" ? "Keeping under 100% prevents overspending" : "100%以内なら予算内で推移",
          ok: budgetTotal === 0 ? true : budgetUsageRate <= 100,
        },
        {
          label: lang === "en" ? "Investment ratio" : "投資比率",
          value: `${investmentRate}%`,
          sub: lang === "en" ? "Asset-building share within income" : "収入のうち資産形成に回せた割合",
          ok: investmentRate >= 10,
        },
        {
          label: lang === "en" ? "Emergency reserve" : "現在の生活防衛資金",
          value: formatCurrency(stats.reserveStock),
          sub:
            lang === "en"
              ? `Current reserves. Saved + invested: ${formatCurrency(totalSaved)}`
              : `今ある備え。貯蓄と投資の累計は ${formatCurrency(totalSaved)}`,
          ok: stats.reserveStock >= readSavingsGoalFromStorage(),
        },
      ];
    },
    [
      currentMonth,
      lang,
      stats.balance,
      stats.budgetProgress,
      stats.expense,
      stats.fixedRate,
      stats.income,
      stats.investment,
      stats.passiveIncome,
      stats.reserveStock,
      stats.saving,
      stats.savingRate,
      stats.waste,
      transactions,
    ],
  );

  const forecast = useMemo(() => {
    const [year, month] = currentMonth.split("-").map(Number);
    const now = new Date();
    const daysInMonth = new Date(year, month, 0).getDate();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    const daysElapsed = isCurrentMonth ? Math.max(now.getDate(), 1) : daysInMonth;
    const projectedIncome = Math.round((stats.income / daysElapsed) * daysInMonth);
    const projectedExpense = Math.round((stats.expense / daysElapsed) * daysInMonth);
    const projectedSaving = Math.round(((stats.saving + stats.investment) / daysElapsed) * daysInMonth);
    const projectedBalance = projectedIncome - projectedExpense - projectedSaving;

    const recentBalances = getMonthSeries(currentMonth, 3).map((monthKey) => {
      const monthly = transactions.filter((item) => item.date.startsWith(monthKey));
      const income = monthly.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
      const expense = monthly.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
      const saving = monthly
        .filter((item) => item.type === "saving" || item.type === "investment")
        .reduce((sum, item) => sum + item.amount, 0);
      return income - expense - saving;
    });

    const averageBalance = recentBalances.length > 0
      ? Math.round(recentBalances.reduce((sum, value) => sum + value, 0) / recentBalances.length)
      : stats.balance;

    const daysRemaining = isCurrentMonth ? Math.max(daysInMonth - now.getDate(), 0) : 0;
    const dailyRemaining = daysRemaining > 0 ? Math.round(stats.balance / daysRemaining) : null;

    return {
      projectedIncome,
      projectedExpense,
      projectedSaving,
      projectedBalance,
      annualProjection: averageBalance * 12,
      daysRemaining,
      dailyRemaining,
      isCurrentMonth,
    };
  }, [currentMonth, stats.balance, stats.expense, stats.income, stats.investment, stats.saving, transactions]);

  const categoryAllocationView = useMemo(() => {
    const normalizedTargetMap = budgets
      .filter((item) => item.month === currentMonth)
      .reduce((map, item) => {
        const normalizedCategory = normalizeBudgetCategory(item.category);
        const current = map.get(normalizedCategory);
        if (current) {
          current.amount += item.amount;
        } else {
          map.set(normalizedCategory, { ...item, category: normalizedCategory });
        }
        return map;
      }, new Map<string, Budget>());
    const targets = Array.from(normalizedTargetMap.values());
    const hasClothesBudget = targets.some((item) => item.category === "衣服・美容");
    const clothesActual = BUDGET_CATEGORY_ALIASES["衣服・美容"].reduce((sum, key) => sum + (stats.categoryMap[key] ?? 0), 0);
    const normalizedTargets = hasClothesBudget
      ? targets
      : clothesActual > 0
        ? [...targets, { id: "virtual-clothes", user_id: "", category: "衣服・美容", amount: 0, month: currentMonth, created_at: "" }]
        : targets;
    const totalTarget = normalizedTargets.reduce((sum, item) => sum + item.amount, 0);
    return normalizedTargets.map((item) => {
      const actualAmount = getBudgetActualAmount(item.category, stats.categoryMap);
      return {
        category: item.category,
        targetAmount: item.amount,
        targetPct: totalTarget > 0 ? Math.round((item.amount / totalTarget) * 100) : 0,
        actualAmount,
      };
    });
  }, [budgets, currentMonth, stats.categoryMap]);

  const defenseGoal = useMemo(() => {
    const manualGoal = readSavingsGoalFromStorage();
    if (manualGoal > 0) return manualGoal * 6;
    return Math.max(stats.expense, stats.fixed || stats.expense) * 6;
  }, [stats.expense, stats.fixed]);

  const defenseProgress = defenseGoal > 0 ? Math.min(100, Math.round((stats.reserveStock / defenseGoal) * 100)) : 0;
  const safetyRating = useMemo(() => {
    const reserveMonths = stats.expense > 0 ? stats.reserveStock / stats.expense : 0;
    if (stats.balance >= 0 && stats.savingRate >= 20 && reserveMonths >= 3) {
      return {
        label: lang === "en" ? "Safe" : "安全",
        note: lang === "en" ? "Your household pace is stable." : "家計の流れはかなり安定しています。",
        textColor: "#000000",
        borderColor: "#16a34a",
        backgroundColor: "#86efac",
      };
    }
    if (stats.balance >= 0 && stats.savingRate >= 10) {
      return {
        label: lang === "en" ? "Watch" : "注意",
        note: lang === "en" ? "Stable, but keep watching fixed costs and reserves." : "大きくは崩れていませんが、固定費と備えは要チェックです。",
        textColor: "#000000",
        borderColor: "#d97706",
        backgroundColor: "#fcd34d",
      };
    }
    return {
      label: lang === "en" ? "Risk" : "要改善",
      note: lang === "en" ? "Balance or savings pace needs attention." : "差額か貯蓄ペースに改善余地があります。",
      textColor: "#000000",
      borderColor: "#e11d48",
      backgroundColor: "#fda4af",
    };
  }, [lang, stats.balance, stats.expense, stats.reserveStock, stats.savingRate]);

  const lifeLevel = useMemo(() => {
    const expenseRatio = stats.income > 0 ? stats.expense / stats.income : 0;
    if (expenseRatio <= 0.55 && stats.savingRate >= 20) {
      return {
        label: lang === "en" ? "Comfortable" : "ゆとりあり",
        note: lang === "en" ? "Lifestyle fits your take-home well." : "手取りに対して生活コストの余白があります。",
        textColor: "#000000",
        borderColor: "#7c3aed",
        backgroundColor: "#c4b5fd",
      };
    }
    if (expenseRatio <= 0.8) {
      return {
        label: lang === "en" ? "Balanced" : "標準",
        note: lang === "en" ? "Current lifestyle is manageable." : "今の生活レベルは概ね回せています。",
        textColor: "#000000",
        borderColor: "#0284c7",
        backgroundColor: "#7dd3fc",
      };
    }
    return {
      label: lang === "en" ? "Stretched" : "背伸び気味",
      note: lang === "en" ? "Lifestyle costs are pressing against take-home pay." : "生活コストが手取りをかなり圧迫しています。",
      textColor: "#000000",
      borderColor: "#ea580c",
      backgroundColor: "#fb923c",
    };
  }, [lang, stats.expense, stats.income, stats.savingRate]);

  const t = LABELS[lang];

  // トレードオフルール適用通知
  useEffect(() => {
    function handleTradeoff(e: Event) {
      const applied = (e as CustomEvent<{ target_category: string; reduced_by: number }[]>).detail;
      if (!applied?.length) return;
      setTradeoffNotice(applied);
      window.setTimeout(() => setTradeoffNotice([]), 6000);
    }
    window.addEventListener("kakeibo-tradeoff-applied", handleTradeoff);
    return () => window.removeEventListener("kakeibo-tradeoff-applied", handleTradeoff);
  }, []);

  // 隠れた支出（その他カテゴリ）
  const hiddenExpenses = useMemo(() => {
    return transactions.filter(
      (tx) => tx.type === "expense" && tx.date.startsWith(currentMonth) && tx.category === "その他"
    );
  }, [transactions, currentMonth]);

  // 手取り → 自由なお金（収益分岐点）
  const breakEven = useMemo(() => {
    const FIXED_CATS = ["住居", "水道・光熱費", "通信費", "保険", "税金", "サブスク"];
    const SURVIVAL_CATS = ["食費", "医療費", "日用品", "交通費"];
    const monthTx = transactions.filter((tx) => tx.date.startsWith(currentMonth) && tx.type === "expense");
    const fixed = monthTx.filter((tx) => FIXED_CATS.includes(tx.category)).reduce((s, tx) => s + tx.amount, 0);
    const survival = monthTx.filter((tx) => SURVIVAL_CATS.includes(tx.category)).reduce((s, tx) => s + tx.amount, 0);
    const free = stats.income - fixed - survival;
    return { fixed, survival, free, fixedCats: FIXED_CATS, survivalCats: SURVIVAL_CATS };
  }, [transactions, currentMonth, stats.income]);

  const fixedCostFlags = useMemo(
    () => buildFixedCostFlags(transactions, currentMonth, reviewedFixedCostFlagIds, hiddenFixedCostFlagIds),
    [transactions, currentMonth, reviewedFixedCostFlagIds, hiddenFixedCostFlagIds]
  );

  // 今日の支出
  const todayStats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayTx = transactions.filter((tx) => tx.date === today && tx.type === "expense");
    const todaySpent = todayTx.reduce((sum, tx) => sum + tx.amount, 0);
    return { todaySpent };
  }, [transactions]);

  return (
    <div className="dashboard-light-copy dashboard-clarity space-y-4">
      <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          <div className="board-card border shadow-sm rounded-[28px] p-4 bg-white">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: lang === "en" ? "Income" : "収入", value: formatCurrency(stats.income), tone: "text-black" },
                { label: lang === "en" ? "Expense" : "支出", value: formatCurrency(stats.expense), tone: "text-black" },
                { label: lang === "en" ? "Saving" : "貯蓄", value: formatCurrency(stats.saving + stats.investment), tone: "text-black" },
                { label: lang === "en" ? "Balance" : "差額", value: formatCurrency(stats.balance), tone: "text-black" },
              ].map((card) => (
                <div key={card.label} className="flex h-full min-h-32 flex-col justify-between rounded-3xl board-tile border p-4 shadow-sm bg-white min-w-0">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-black">{card.label}</p>
                  <p className="mt-3 text-2xl font-black text-black break-all">{card.value}</p>
                </div>
              ))}
            </div>
            {forecast.isCurrentMonth && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(() => {
                  const spendable = stats.balance + carryoverAmount - pendingDebitTotal;
                  const daily = forecast.daysRemaining > 0 ? Math.round(spendable / forecast.daysRemaining) : null;
                  return (
                    <>
                      <div className={`flex flex-col justify-between rounded-3xl border p-4 shadow-sm ${spendable >= 0 ? "bg-emerald-50 border-emerald-300" : "bg-rose-50 border-rose-300"}`}>
                        <p className="text-sm font-black uppercase tracking-[0.18em] text-black">
                          {lang === "en" ? "Monthly remaining" : "今月あと使える額"}
                        </p>
                        <p className={`mt-3 text-2xl font-black ${spendable >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {formatCurrency(spendable)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-black">
                          {carryoverAmount > 0
                            ? lang === "en"
                              ? `Incl. ${formatCurrency(carryoverAmount)} carryover · ${forecast.daysRemaining} days left`
                              : `繰越 ${formatCurrency(carryoverAmount)} 含む · 残り ${forecast.daysRemaining} 日`
                            : lang === "en"
                              ? `${forecast.daysRemaining} days left this month`
                              : `残り ${forecast.daysRemaining} 日`}
                        </p>
                      </div>
                      <div className={`flex flex-col justify-between rounded-3xl border p-4 shadow-sm ${(daily ?? 0) >= 0 ? "bg-cyan-50 border-cyan-300" : "bg-rose-50 border-rose-300"}`}>
                        <p className="text-sm font-black uppercase tracking-[0.18em] text-black">
                          {lang === "en" ? "Daily budget" : "1日あたり使える額"}
                        </p>
                        <p className={`mt-3 text-2xl font-black ${(daily ?? 0) >= 0 ? "text-cyan-700" : "text-rose-700"}`}>
                          {daily !== null ? formatCurrency(daily) : "—"}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-black">
                          {lang === "en"
                            ? `Remaining ÷ ${forecast.daysRemaining} days`
                            : `残高 ÷ 残り ${forecast.daysRemaining} 日`}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          <BudgetSurplusPanel
            currentMonth={currentMonth}
            balance={stats.balance}
            onCarryoverLoaded={setCarryoverAmount}
          />

          <DebitReservationPanel
            currentMonth={currentMonth}
            onPendingTotalChange={setPendingDebitTotal}
          />

          {/* トレードオフルール適用通知 */}
          {tradeoffNotice.length > 0 && (
            <div className="board-card rounded-[28px] border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-black text-amber-800">
                {lang === "en" ? "Budget tradeoff applied" : "予算トレードオフ自動適用"}
              </p>
              <ul className="mt-2 space-y-1">
                {tradeoffNotice.map((item, i) => (
                  <li key={i} className="text-xs text-amber-700">
                    {lang === "en"
                      ? `${item.target_category} budget reduced by ${formatCurrency(item.reduced_by)}`
                      : `${item.target_category} の予算を ${formatCurrency(item.reduced_by)} 削減しました`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 今日の使用額・明日の予算 */}
          {forecast.isCurrentMonth && (
            <div className="board-card border shadow-sm rounded-[28px] p-4 bg-white">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-black">
                {lang === "en" ? "Today & tomorrow" : "今日・明日の予算"}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-slate-300 bg-slate-50 p-3">
                  <p className="text-xs font-bold text-black">{lang === "en" ? "Spent today" : "今日の使用額"}</p>
                  <p className={`mt-2 text-xl font-black ${todayStats.todaySpent > 0 ? "text-rose-700" : "text-slate-700"}`}>
                    {todayStats.todaySpent > 0 ? formatCurrency(todayStats.todaySpent) : "—"}
                  </p>
                </div>
                {(() => {
                  const spendable = stats.balance + carryoverAmount - pendingDebitTotal;
                  const baseDaily = forecast.daysRemaining > 0 ? Math.round(spendable / forecast.daysRemaining) : 0;
                  const todayLeft = baseDaily - todayStats.todaySpent;
                  const tomorrowBudget = forecast.daysRemaining > 1
                    ? Math.round((spendable - todayStats.todaySpent) / (forecast.daysRemaining - 1))
                    : null;
                  return (
                    <>
                      <div className={`rounded-3xl border p-3 ${todayLeft >= 0 ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"}`}>
                        <p className="text-xs font-bold text-black">{lang === "en" ? "Left for today" : "今日あと使える"}</p>
                        <p className={`mt-2 text-xl font-black ${todayLeft >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {formatCurrency(todayLeft)}
                        </p>
                        {todayLeft < 0 && (
                          <p className="mt-1 text-xs font-semibold text-rose-600">
                            {lang === "en" ? "Over budget — deducted from tomorrow" : "使いすぎ → 明日に繰り越し"}
                          </p>
                        )}
                      </div>
                      <div className={`rounded-3xl border p-3 ${tomorrowBudget !== null && tomorrowBudget >= 0 ? "border-cyan-300 bg-cyan-50" : "border-rose-300 bg-rose-50"}`}>
                        <p className="text-xs font-bold text-black">{lang === "en" ? "Tomorrow's budget" : "明日の予算"}</p>
                        <p className={`mt-2 text-xl font-black ${tomorrowBudget !== null && tomorrowBudget >= 0 ? "text-cyan-700" : "text-rose-700"}`}>
                          {tomorrowBudget !== null ? formatCurrency(tomorrowBudget) : "—"}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-black">
                          {lang === "en" ? "Auto-adjusted for today's use" : "今日の使用分を自動反映"}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          <BudgetTradeoffPanel />

          {/* 隠れた支出・雑費の強制可視化 */}
          {hiddenExpenses.length > 0 && (
            <div className="board-card border shadow-sm rounded-[28px] p-4 bg-white">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-black">
                {lang === "en" ? "Hidden misc expenses" : "見えない雑費の強制可視化"}
              </p>
              <p className="mt-1 text-sm font-bold text-black">
                {lang === "en"
                  ? `${hiddenExpenses.length} uncategorized items this month`
                  : `今月「その他」に流れた支出 ${hiddenExpenses.length}件`}
              </p>
              <div className="mt-3 space-y-1">
                {hiddenExpenses.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-black truncate">{tx.memo || (lang === "en" ? "No description" : "説明なし")}</p>
                      <p className="text-xs font-semibold text-black">{tx.date}</p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-amber-800">{formatCurrency(tx.amount)}</span>
                  </div>
                ))}
                {hiddenExpenses.length > 5 && (
                  <p className="text-xs font-bold text-black pl-1">
                    {lang === "en" ? `+${hiddenExpenses.length - 5} more items` : `他 ${hiddenExpenses.length - 5}件`}
                  </p>
                )}
              </div>
              <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-100 px-3 py-2 flex items-center justify-between">
                <p className="text-sm font-bold text-black">{lang === "en" ? "Total misc" : "雑費合計"}</p>
                <span className="text-lg font-black text-amber-900">
                  {formatCurrency(hiddenExpenses.reduce((s, tx) => s + tx.amount, 0))}
                </span>
              </div>
            </div>
          )}

          {/* 収益分岐点・手取り → 自由なお金 */}
          {stats.income > 0 && (
            <div className="board-card border shadow-sm rounded-[28px] p-4 bg-white">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-black">
                {lang === "en" ? "Free money after essentials" : "収益分岐点・自由なお金"}
              </p>
              <p className="mt-1 text-sm font-bold text-black">
                {lang === "en"
                  ? "Take-home income minus survival costs"
                  : "手取りから固定費・生存コストを引いた自由なお金"}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-300 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-bold text-black">{lang === "en" ? "Take-home" : "手取り収入"}</p>
                  <p className="mt-1 text-lg font-black text-black">{formatCurrency(stats.income)}</p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3">
                  <p className="text-xs font-bold text-black">{lang === "en" ? "Fixed + survival" : "固定費＋生存コスト"}</p>
                  <p className="mt-1 text-lg font-black text-rose-700">
                    -{formatCurrency(breakEven.fixed + breakEven.survival)}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-black">
                    {lang === "en"
                      ? `Fixed: ${formatCurrency(breakEven.fixed)} / Survival: ${formatCurrency(breakEven.survival)}`
                      : `固定費: ${formatCurrency(breakEven.fixed)} / 生存: ${formatCurrency(breakEven.survival)}`}
                  </p>
                </div>
                <div className={`rounded-2xl border px-3 py-3 ${breakEven.free >= 0 ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"}`}>
                  <p className="text-xs font-bold text-black">{lang === "en" ? "Free money" : "自由なお金"}</p>
                  <p className={`mt-1 text-lg font-black ${breakEven.free >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {formatCurrency(breakEven.free)}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-black">
                    {breakEven.free >= 0
                      ? (lang === "en" ? "Available for wants & savings" : "娯楽・貯蓄に使える")
                      : (lang === "en" ? "Over essential budget" : "生存コスト超過")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 固定費・サブスク見直しフラグ */}
          <div className="board-card border shadow-sm rounded-[28px] p-4 bg-white">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-black">
              {lang === "en" ? "Fixed cost flags" : "固定費・サブスク見直しフラグ"}
            </p>
            <p className="mt-1 text-sm font-bold text-black">
              {lang === "en"
                ? "Cancellation and plan-change candidates from this month"
                : "今月の固定費から、解約・プラン変更を検討する候補を表示します。"}
            </p>
            {fixedCostFlags.length === 0 ? (
              <p className="mt-3 text-sm font-semibold text-black">
                {lang === "en"
                  ? "No fixed-cost cancellation candidates found for this month."
                  : "今月は固定費・サブスクの見直し候補が見つかりませんでした。"}
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {fixedCostFlags.slice(0, 5).map((flag) => {
                  const tone =
                    flag.priority === "high"
                      ? "border-rose-300 bg-rose-50 text-rose-700"
                      : flag.priority === "medium"
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-cyan-300 bg-cyan-50 text-cyan-700";
                  return (
                    <div key={flag.id} className={`rounded-2xl border px-3 py-3 ${flag.reviewed ? "border-slate-200 bg-slate-50" : tone}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-black">{flag.title}</p>
                          <p className="text-xs font-semibold text-black">
                            {lang === "en" ? flag.categoryLabelEn : flag.categoryLabelJa}
                            {flag.reviewed ? (lang === "en" ? " · reviewed" : " · 確認済み") : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-bold text-black">{lang === "en" ? "Monthly impact" : "月額影響"}</p>
                          <p className={`text-base font-black ${flag.reviewed ? "text-slate-600" : ""}`}>
                            {formatCurrency(flag.amount)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(lang === "en" ? flag.reasonsEn : flag.reasonsJa).map((reason) => (
                          <span key={reason} className="rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[10px] font-bold text-black">
                            {reason}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs font-semibold text-black">
                        {lang === "en" ? flag.actionEn : flag.actionJa}
                      </p>
                    </div>
                  );
                })}
                {fixedCostFlags.length > 5 && (
                  <p className="pl-1 text-xs font-bold text-black">
                    {lang === "en" ? `+${fixedCostFlags.length - 5} more in Goals` : `ほか ${fixedCostFlags.length - 5} 件は目標タブで確認できます`}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid items-stretch gap-3 lg:grid-cols-2">
            <div className="board-card border shadow-sm h-full rounded-[28px] p-4 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-black">{t.detailMetrics}</h3>
                <span className="text-sm font-semibold text-black">{currentMonth}</span>
              </div>
              <div className="mt-3 space-y-2">
                {detailMetrics.map((metric) => (
                  <div key={metric.label} className="board-tile border rounded-2xl px-3 py-3 bg-white">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold text-black drop-shadow-[0_1px_0_rgba(0,0,0,0.18)]">{metric.label}</p>
                        <p className="mt-1 text-sm font-bold text-black drop-shadow-[0_1px_0_rgba(0,0,0,0.12)]">{metric.sub}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-base font-extrabold text-black drop-shadow-[0_1px_0_rgba(0,0,0,0.22)] ${metric.ok ? "bg-emerald-100" : "bg-amber-100"}`}>{metric.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="board-card border shadow-sm h-full rounded-[28px] p-4 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-black drop-shadow-[0_2px_0_rgba(0,0,0,0.22)]">{t.forecast}</h3>
                <span className="text-base font-extrabold text-black drop-shadow-[0_1px_0_rgba(0,0,0,0.18)]">{lang === "en" ? "Monthly projection" : "月次予測"}</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  { label: lang === "en" ? "Projected income" : "収入見込み", value: formatCurrency(forecast.projectedIncome) },
                  { label: lang === "en" ? "Projected expense" : "支出見込み", value: formatCurrency(forecast.projectedExpense) },
                  { label: lang === "en" ? "Projected saving" : "貯蓄見込み", value: formatCurrency(forecast.projectedSaving) },
                  { label: lang === "en" ? "Annual pace" : "年間ペース", value: formatCurrency(forecast.annualProjection) },
                ].map((item) => (
                  <div key={item.label} className="board-tile border rounded-2xl p-3 bg-white">
                    <p className="text-sm font-extrabold text-black drop-shadow-[0_1px_0_rgba(0,0,0,0.22)]">{item.label}</p>
                    <p className="mt-2 text-xl font-extrabold text-black drop-shadow-[0_2px_0_rgba(0,0,0,0.28)]">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className={`board-tile mt-3 rounded-2xl border px-3 py-3 ${forecast.projectedBalance >= 0 ? "border-emerald-400" : "border-rose-400"} bg-white`}> 
                <p className="text-base font-extrabold text-black drop-shadow-[0_1px_0_rgba(0,0,0,0.22)]">{lang === "en" ? "Projected balance" : "差額見込み"}</p>
                <p className="mt-2 text-2xl font-extrabold text-black drop-shadow-[0_2px_0_rgba(0,0,0,0.32)]">{formatCurrency(forecast.projectedBalance)}</p>
              </div>
            </div>
          </div>

        </div>

        <div className="space-y-3">
          <div className="board-card safety-contrast-card border shadow-sm h-full rounded-[28px] p-4">
            <div className="flex items-center justify-between">
              <h3 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#111827", margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{lang === "en" ? "Safety and lifestyle" : "安全度と生活レベル"}</h3>
              <span style={{ fontSize: "1.75rem", fontWeight: 900, color: "#111827", lineHeight: 1 }}>{defenseProgress}%</span>
            </div>
            <div className="mt-3">
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: "9999px",
                  border: `3px solid ${safetyRating.borderColor}`,
                  background: safetyRating.backgroundColor,
                  color: safetyRating.textColor,
                  padding: "0.56rem 1.1rem",
                  fontSize: "1.35rem",
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                {safetyRating.label}
              </span>
            </div>
            <p style={{ marginTop: "0.55rem", fontSize: "1.05rem", fontWeight: 700, color: "#374151", lineHeight: 1.5 }}>{safetyRating.note}</p>
            <div className="board-tile safety-contrast-tile mt-4 rounded-2xl border p-3">
              <p style={{ fontSize: "1.1rem", fontWeight: 800, color: "#111827", lineHeight: 1.15, letterSpacing: "-0.01em" }}>{lang === "en" ? "Living level" : "生活レベル"}</p>
              <div className="mt-2">
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: "9999px",
                    border: `3px solid ${lifeLevel.borderColor}`,
                    background: lifeLevel.backgroundColor,
                    color: lifeLevel.textColor,
                    padding: "0.56rem 1.1rem",
                    fontSize: "1.35rem",
                    fontWeight: 900,
                    lineHeight: 1,
                  }}
                >
                  {lifeLevel.label}
                </span>
              </div>
              <p style={{ marginTop: "0.55rem", fontSize: "1.05rem", fontWeight: 700, color: "#374151", lineHeight: 1.5 }}>{lifeLevel.note}</p>
            </div>
            <div className="mt-4 h-3 rounded-full bg-cyan-100">
              <div className="h-3 rounded-full bg-cyan-400" style={{ width: `${defenseProgress}%` }} />
            </div>
            <p style={{ marginTop: "0.75rem", fontSize: "1.05rem", fontWeight: 800, color: "#111827", lineHeight: 1.3 }}>{formatCurrency(stats.reserveStock)} / {formatCurrency(defenseGoal)}</p>
            <p style={{ marginTop: '0.25rem', fontSize: '0.9rem', fontWeight: 600, color: '#6b7280' }}>
              {lang === "en" ? "Calculated from current saving goal or six months of expenses." : "現在の貯蓄目標、または支出6か月分を基準に計算しています。"}
            </p>

            <div className="mt-6 flex items-center justify-between">
              <h3 className="text-base font-bold text-black">{t.categoryAllocation}</h3>
              <span className="text-sm font-semibold text-black">{lang === "en" ? "Targets from preset" : "プリセット反映"}</span>
            </div>
            {categoryAllocationView.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-black">
                {lang === "en"
                  ? "No allocation preset yet. Apply a preset from the top button to reflect it here."
                  : "まだ配分プリセットがありません。上のボタンからプリセットを反映するとここに表示されます。"}
              </p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {categoryAllocationView.map((row) => {
                  const pct = row.targetAmount > 0 ? Math.min(100, Math.round((row.actualAmount / row.targetAmount) * 100)) : 0;
                  return (
                    <div key={row.category} className="board-tile border rounded-2xl p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-bold text-black">{getBudgetCategoryLabel(row.category, lang)}</span>
                        <span className="rounded-full bg-cyan-100 px-2.5 py-1 font-black text-black">{formatCurrency(row.targetAmount)}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-cyan-100">
                        <div className={`h-2 rounded-full ${pct <= 100 ? "bg-cyan-400" : "bg-rose-400"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm font-bold text-black">
                        <span>{t.actual}: {formatCurrency(row.actualAmount)}</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="space-y-3">
        <div className="board-card rounded-[28px] border px-4 py-4 shadow-sm bg-white">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-black drop-shadow-[0_2px_0_rgba(0,0,0,0.22)]">{lang === "en" ? "AI daily support" : "AI生活サポート"}</h3>
              <p className="mt-1 text-base font-extrabold text-black drop-shadow-[0_1px_0_rgba(0,0,0,0.12)]">
                {lang === "en"
                  ? "Recipe ideas and nearby store guidance are grouped here so they are easier to scan on desktop."
                  : "食事の提案と近くのお店案内をここにまとめて、パソコンでも見やすくしています。"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                { key: "save", label: lang === "en" ? "Save" : "節約" },
                { key: "standard", label: lang === "en" ? "Balanced" : "標準" },
                { key: "luxury", label: lang === "en" ? "Treat" : "ゆとり" },
              ] as const).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSupportMode(option.key)}
                  className={`rounded-full border px-3 py-2 text-base font-extrabold drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition
                    ${option.key === "save"
                      ? supportMode === "save"
                        ? "border-amber-700 bg-amber-300 text-black shadow-sm"
                        : "border-amber-400 bg-amber-100 text-black hover:border-amber-500"
                      : option.key === "standard"
                        ? supportMode === "standard"
                          ? "border-cyan-700 bg-cyan-300 text-black shadow-sm"
                          : "border-cyan-400 bg-cyan-100 text-black hover:border-cyan-500"
                        : supportMode === "luxury"
                          ? supportMode === "luxury"
                            ? "border-pink-700 bg-pink-300 text-black shadow-sm"
                            : "border-pink-400 bg-pink-100 text-black hover:border-pink-500"
                          : ""
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid items-stretch gap-4 xl:grid-cols-1">
          <FoodLifestyleAssistant
            transactions={transactions}
            currentMonth={currentMonth}
            area={sharedArea}
            supportMode={supportMode}
            onLifestyleSuggestionsChange={setLifestyleSuggestions}
          />
          <NearbyShopGuide
            transactions={transactions}
            currentMonth={currentMonth}
            area={sharedArea}
            onAreaChange={setSharedArea}
            supportMode={supportMode}
            lifestyleSuggestions={lifestyleSuggestions}
          />
        </div>
      </div>

      <div className="board-card rounded-[28px] border p-1.5 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {([
            { key: "input", label: lang === "en" ? "Input" : "入力" },
            { key: "charts", label: lang === "en" ? "Board" : "ボード" },
            { key: "calendar", label: lang === "en" ? "Calendar" : "カレンダー" },
            { key: "goals", label: lang === "en" ? "Goals" : "目標" },
            { key: "ai", label: lang === "en" ? "AI" : "AI" },
            { key: "annual", label: lang === "en" ? "Annual" : "年次" },
            { key: "benchmarks", label: lang === "en" ? "Benchmarks" : "基準" },
            { key: "senior", label: lang === "en" ? "Senior" : "シニア" },
            { key: "kids", label: lang === "en" ? "Kids" : "こども" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActivePage(tab.key)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                activePage === tab.key
                  ? "border-slate-950 bg-cyan-500 text-black shadow-sm"
                  : "border-slate-400 bg-white/90 text-black hover:border-slate-500 hover:text-black"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="board-card rounded-[28px] border p-3 shadow-sm md:p-4">
        {activePage === "input" && (
          <InputForm
            recentTransactions={transactions}
            onSuccess={() => window.dispatchEvent(new Event("kakeibo-data-updated"))}
          />
        )}
        {activePage === "charts" && <Charts transactions={transactions} currentMonth={currentMonth} />}
        {activePage === "calendar" && <Calendar transactions={transactions} currentMonth={currentMonth} />}
        {activePage === "goals" && (
          <div className="space-y-5">
            <GenerationGoals
              key={[
                currentMonth,
                profile?.allocation_take_home ?? 0,
                profile?.allocation_target_fixed_rate ?? 0,
                profile?.allocation_target_variable_rate ?? 0,
                profile?.allocation_target_savings_rate ?? 0,
              ].join(":")}
              transactions={transactions}
              currentMonth={currentMonth}
              profile={profile}
              generation={goalGeneration}
              onGenerationChange={setGoalGeneration}
            />
            {goalGeneration === "general" && <GoalsAndDebt transactions={transactions} currentMonth={currentMonth} />}
            <PurchaseAdvisor transactions={transactions} currentMonth={currentMonth} />
          </div>
        )}
        {activePage === "ai" && (
          <AIPageView
            transactions={transactions}
            budgets={budgets}
            currentMonth={currentMonth}
            onOpenInput={() => setActivePage("input")}
          />
        )}
        {activePage === "annual" && <AnnualReportFull transactions={transactions} currentMonth={currentMonth} />}
        {activePage === "benchmarks" && <EconomicBenchmarkGuide />}
        {activePage === "senior" && <SeniorDashboard />}
        {activePage === "kids" && (
          <div className="space-y-5">
            <KidsFinanceDashboard state={kidsState} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="board-card rounded-[28px] border border-slate-300 bg-white p-4 shadow-sm">
                <h3 className="text-base font-bold text-black">{lang === "en" ? "Kids income" : "こどもの収入"}</h3>
                <div className="mt-3">
                  <KidsIncomeForm onAdd={(item: KidsIncome) => setKidsState((prev) => ({ ...prev, incomes: [...prev.incomes, item] }))} />
                </div>
              </div>
              <div className="board-card rounded-[28px] border border-slate-300 bg-white p-4 shadow-sm">
                <h3 className="text-base font-bold text-black">{lang === "en" ? "Kids expense" : "こどもの支出"}</h3>
                <div className="mt-3">
                  <KidsExpenseForm onAdd={(item: KidsExpense) => setKidsState((prev) => ({ ...prev, expenses: [...prev.expenses, item] }))} />
                </div>
              </div>
              <div className="board-card rounded-[28px] border border-slate-300 bg-white p-4 shadow-sm">
                <h3 className="text-base font-bold text-black">{lang === "en" ? "Kids savings" : "こどもの貯蓄"}</h3>
                <div className="mt-3">
                  <KidsSavingForm onAdd={(item) => setKidsState((prev) => ({ ...prev, savings: prev.savings + item.amount }))} />
                </div>
              </div>
              <div className="board-card rounded-[28px] border border-slate-300 bg-white p-4 shadow-sm">
                <h3 className="text-base font-bold text-black">{lang === "en" ? "Kids goal" : "こどもの目標"}</h3>
                <div className="mt-3">
                  <KidsGoalForm
                    currentGoal={kidsState.savingsGoal}
                    monthlyBudget={kidsState.monthlyBudget}
                    onUpdateGoal={(goal) => setKidsState((prev) => ({ ...prev, savingsGoal: goal }))}
                    onUpdateBudget={(budget) => setKidsState((prev) => ({ ...prev, monthlyBudget: budget }))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
