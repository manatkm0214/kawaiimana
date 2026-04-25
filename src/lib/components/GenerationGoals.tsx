"use client";

import { useMemo, useState } from "react";
import { formatCurrency, type Profile, type Transaction } from "@/lib/utils";
import { useLang } from "@/lib/hooks/useLang";

type Generation = "general" | "kids" | "senior";

type Props = {
  transactions: Transaction[];
  currentMonth: string;
  profile?: Profile | null;
  generation?: Generation;
  onGenerationChange?: (generation: Generation) => void;
};

type KidsState = {
  incomes: { amount: number; date: string }[];
  expenses: { amount: number; date: string }[];
  savings: number;
  monthlyBudget: number;
  savingsGoal: { title: string; targetAmount: number; currentAmount: number };
};

type SeniorState = {
  monthlyBudget: number;
  savingGoal: number;
  entries: { type: string; amount: number; date: string }[];
};

function normalizeSeniorState(value: SeniorState): SeniorState {
  const entries = Array.isArray(value.entries) ? value.entries : [];
  const monthlyBudget = Number.isFinite(value.monthlyBudget) ? value.monthlyBudget : 0;
  const savingGoal = Number.isFinite(value.savingGoal) ? value.savingGoal : 0;

  if (entries.length === 0 && monthlyBudget === 120000 && savingGoal === 20000) {
    return { monthlyBudget: 0, savingGoal: 0, entries: [] };
  }

  return {
    monthlyBudget: Math.max(0, monthlyBudget),
    savingGoal: Math.max(0, savingGoal),
    entries,
  };
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

function save(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readNumber(key: string) {
  if (typeof window === "undefined") return 0;
  const raw = Number(window.localStorage.getItem(key) || 0);
  return Number.isFinite(raw) ? raw : 0;
}

function getRecentMonths(currentMonth: string, count: number) {
  const [year, month] = currentMonth.split("-").map(Number);
  return Array.from({ length: count }).map((_, index) => {
    const date = new Date(year, month - 1 - index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-900 p-4">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function MetricBox({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}

function FieldRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-44 shrink-0 text-xs text-slate-400">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        className="flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
      />
    </label>
  );
}

function GoalSimulator({
  reserveStock,
  monthlySaving,
  currentMonth,
  lang,
}: {
  reserveStock: number;
  monthlySaving: number;
  currentMonth: string;
  lang: string;
}) {
  const t = (ja: string, en: string) => (lang === "en" ? en : ja);
  const [goalAmount, setGoalAmount] = useState(0);
  const [customMonthly, setCustomMonthly] = useState(0);

  const monthly = customMonthly > 0 ? customMonthly : monthlySaving;
  const gap = Math.max(0, goalAmount - reserveStock);
  const monthsNeeded = goalAmount > 0 && monthly > 0 ? Math.ceil(gap / monthly) : null;

  const achieveDate = useMemo(() => {
    if (monthsNeeded === null) return null;
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + monthsNeeded, 1);
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  }, [monthsNeeded, currentMonth]);

  const milestones = useMemo(() => {
    if (!goalAmount || !monthly) return [];
    const rows: { pct: number; months: number; date: string; amount: number }[] = [];
    for (const pct of [25, 50, 75, 100]) {
      const target = Math.round((goalAmount * pct) / 100);
      const remaining = Math.max(0, target - reserveStock);
      const months = monthly > 0 ? Math.ceil(remaining / monthly) : 0;
      const [y, m] = currentMonth.split("-").map(Number);
      const d = new Date(y, m - 1 + months, 1);
      const date = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      rows.push({ pct, months, date, amount: target });
    }
    return rows;
  }, [goalAmount, monthly, reserveStock, currentMonth]);

  return (
    <SectionCard title={t("目標達成シミュレーター", "Goal achievement simulator")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-slate-400">{t("目標金額 (円)", "Goal amount (¥)")}</label>
          <input
            type="number"
            min={0}
            value={goalAmount || ""}
            onChange={(e) => setGoalAmount(Math.max(0, Number(e.target.value) || 0))}
            placeholder="1000000"
            className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">
            {t("月間積立額 (空欄=実績値)", "Monthly saving (blank = actual)")}
          </label>
          <input
            type="number"
            min={0}
            value={customMonthly || ""}
            onChange={(e) => setCustomMonthly(Math.max(0, Number(e.target.value) || 0))}
            placeholder={String(monthlySaving)}
            className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {goalAmount > 0 && (
        <>
          <div className="mt-3 rounded-2xl border border-cyan-700 bg-slate-950 p-3">
            <p className="text-xs text-slate-400">{t("現在の貯蓄残高", "Current savings")}</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{formatCurrency(reserveStock)}</p>
            <p className="mt-2 text-xs text-slate-400">{t("月間積立ペース", "Monthly saving pace")}</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{formatCurrency(monthly)}</p>
          </div>

          {monthsNeeded !== null && achieveDate ? (
            <>
              <div className={`mt-3 rounded-2xl border p-3 ${monthsNeeded === 0 ? "border-emerald-500 bg-emerald-950" : "border-cyan-600 bg-slate-950"}`}>
                <p className="text-xs text-slate-400">{t("目標達成予定", "Expected achievement")}</p>
                <p className="mt-1 text-2xl font-black text-white">
                  {monthsNeeded === 0 ? t("達成済み！", "Already achieved!") : achieveDate}
                </p>
                {monthsNeeded > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    {t(`あと約 ${monthsNeeded} か月`, `About ${monthsNeeded} months to go`)}
                  </p>
                )}
              </div>

              <div className="mt-3 space-y-1">
                <p className="text-xs font-semibold text-slate-400">{t("マイルストーン", "Milestones")}</p>
                {milestones.map((m) => (
                  <div key={m.pct} className="flex items-center gap-2">
                    <div className="w-10 shrink-0 text-xs text-slate-500">{m.pct}%</div>
                    <div className="flex-1 h-2 rounded-full bg-slate-800">
                      <div
                        className={`h-2 rounded-full ${reserveStock >= m.amount ? "bg-emerald-500" : "bg-cyan-600"}`}
                        style={{ width: `${Math.min(100, reserveStock >= m.amount ? 100 : Math.round((reserveStock / m.amount) * 100))}%` }}
                      />
                    </div>
                    <div className="w-28 shrink-0 text-right text-xs text-slate-400">{m.date}</div>
                    <div className="w-24 shrink-0 text-right text-xs text-slate-300">{formatCurrency(m.amount)}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-400">
              {t("月間積立額を入力するか、貯蓄実績を記録してください。", "Enter a monthly saving amount or record saving transactions.")}
            </p>
          )}
        </>
      )}
    </SectionCard>
  );
}

function GeneralGoals({ transactions, currentMonth, profile }: Props) {
  const lang = useLang();
  const t = (ja: string, en: string) => (lang === "en" ? en : ja);

  const stats = useMemo(() => {
    const months = getRecentMonths(currentMonth, 3);
    const avgByType = (type: Transaction["type"]) => {
      const totals = months
        .map((month) =>
          transactions
            .filter((item) => item.date.startsWith(month) && item.type === type)
            .reduce((sum, item) => sum + item.amount, 0),
        )
        .filter((value) => value > 0);
      return totals.length > 0 ? Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length) : 0;
    };

    const income = avgByType("income");
    const expense = avgByType("expense");
    const saving = avgByType("saving");
    const investment = avgByType("investment");
    const totalSaving = saving + investment;
    const reserveStock = transactions
      .filter((item) => item.type === "saving" || item.type === "investment")
      .reduce((sum, item) => sum + item.amount, 0);
    const currentFixed = transactions
      .filter((item) => item.date.startsWith(currentMonth) && item.type === "expense" && item.is_fixed)
      .reduce((sum, item) => sum + item.amount, 0);

    return {
      income,
      expense,
      saving,
      investment,
      totalSaving,
      reserveStock,
      currentFixed,
      savingRate: income > 0 ? Math.round((totalSaving / income) * 100) : 0,
    };
  }, [currentMonth, transactions]);

  const recommendation = useMemo(() => {
    const incomeBase = profile?.allocation_take_home && profile.allocation_take_home > 0 ? profile.allocation_take_home : stats.income;
    const fixedRate = profile?.allocation_target_fixed_rate ?? 50;
    const variableRate = profile?.allocation_target_variable_rate ?? 25;
    const savingsRate = profile?.allocation_target_savings_rate ?? 20;
    const savingTarget = readNumber("kakeibo-gen-saving-goal") || Math.round((incomeBase * savingsRate) / 100);
    const variableTarget = readNumber("kakeibo-gen-variable-goal") || Math.round((incomeBase * variableRate) / 100);
    const defenseTarget = readNumber("kakeibo-gen-defense-goal") || Math.round(Math.max(stats.expense, stats.currentFixed) * 6);
    const defenseGap = Math.max(0, defenseTarget - stats.reserveStock);
    const monthsToDefense = stats.totalSaving > 0 ? Math.ceil(defenseGap / stats.totalSaving) : null;

    return {
      incomeBase,
      fixedRate,
      variableRate,
      savingsRate,
      savingTarget,
      variableTarget,
      defenseTarget,
      defenseGap,
      monthsToDefense,
      fixedTargetAmount: Math.round((incomeBase * fixedRate) / 100),
    };
  }, [profile, stats.currentFixed, stats.expense, stats.income, stats.reserveStock, stats.totalSaving]);

  const [savingGoal, setSavingGoal] = useState(() => recommendation.savingTarget);
  const [defenseGoal, setDefenseGoal] = useState(() => recommendation.defenseTarget);
  const [variableGoal, setVariableGoal] = useState(() => recommendation.variableTarget);

  function applyRecommendation() {
    setSavingGoal(recommendation.savingTarget);
    setDefenseGoal(recommendation.defenseTarget);
    setVariableGoal(recommendation.variableTarget);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kakeibo-savings-goal", String(recommendation.savingTarget));
      window.localStorage.setItem("kakeibo-gen-saving-goal", String(recommendation.savingTarget));
      window.localStorage.setItem("kakeibo-gen-defense-goal", String(recommendation.defenseTarget));
      window.localStorage.setItem("kakeibo-gen-variable-goal", String(recommendation.variableTarget));
      window.dispatchEvent(new Event("kakeibo-goals-updated"));
    }
  }

  function updateSavingGoal(value: number) {
    setSavingGoal(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kakeibo-savings-goal", String(value));
      window.localStorage.setItem("kakeibo-gen-saving-goal", String(value));
      window.dispatchEvent(new Event("kakeibo-goals-updated"));
    }
  }

  function updateDefenseGoal(value: number) {
    setDefenseGoal(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kakeibo-gen-defense-goal", String(value));
    }
  }

  function updateVariableGoal(value: number) {
    setVariableGoal(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kakeibo-gen-variable-goal", String(value));
    }
  }

  const defenseProgress = defenseGoal > 0 ? Math.min(100, Math.round((stats.reserveStock / defenseGoal) * 100)) : 0;

  return (
    <div className="space-y-4">
      <SectionCard title={t("個人の目標", "Personal goals")}>
        <div className="grid gap-3 md:grid-cols-3">
          <MetricBox label={t("直近3か月の平均収入", "3-month average income")} value={formatCurrency(stats.income)} />
          <MetricBox label={t("直近3か月の平均支出", "3-month average expense")} value={formatCurrency(stats.expense)} />
          <MetricBox label={t("直近3か月の平均貯蓄", "3-month average saving")} value={formatCurrency(stats.totalSaving)} note={`${stats.savingRate}%`} />
        </div>
      </SectionCard>

      <SectionCard title={t("プリセットと生活実態からの推奨", "Recommended from preset and real spending")}>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {profile?.allocation_take_home
              ? t("プリセットの手取り・目標率を基準に、実際の支出と貯蓄ペースで補正しています。", "Uses your preset take-home and target rates, then adjusts with actual spending and saving pace.")
              : t("プリセット未設定のため、直近の実績ベースで推奨を作っています。", "No preset found, so recommendations are based on recent actuals.")}
          </p>
          <button type="button" onClick={applyRecommendation} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-cyan-400">
            {t("推奨を反映", "Apply recommendation")}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <MetricBox label={t("月間貯金目標", "Monthly savings target")} value={formatCurrency(recommendation.savingTarget)} note={`${recommendation.savingsRate}%`} />
          <MetricBox label={t("変動費上限", "Variable spending cap")} value={formatCurrency(recommendation.variableTarget)} note={`${recommendation.variableRate}%`} />
          <MetricBox
            label={t("生活防衛資金目標", "Emergency fund target")}
            value={formatCurrency(recommendation.defenseTarget)}
            note={recommendation.monthsToDefense != null ? t(`今のペースなら約${recommendation.monthsToDefense}か月`, `About ${recommendation.monthsToDefense} months at current pace`) : t("積立実績が少なく算出待ち", "Need more saving history")}
          />
        </div>
      </SectionCard>

      <SectionCard title={t("手動調整", "Manual adjustment")}>
        <FieldRow label={t("月間貯金目標 (円)", "Monthly savings target (¥)")} value={savingGoal} onChange={updateSavingGoal} />
        <FieldRow label={t("防衛資金目標 (円)", "Emergency fund target (¥)")} value={defenseGoal} onChange={updateDefenseGoal} />
        <FieldRow label={t("変動費上限 (円)", "Variable expense cap (¥)")} value={variableGoal} onChange={updateVariableGoal} />
      </SectionCard>

      <SectionCard title={t("防衛資金の進み具合", "Emergency fund progress")}>
        <div className="h-3 rounded-full bg-slate-800">
          <div className={`h-3 rounded-full ${defenseProgress >= 100 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${defenseProgress}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{formatCurrency(stats.reserveStock)}</span>
          <span>{formatCurrency(defenseGoal)}</span>
        </div>
      </SectionCard>

      <GoalSimulator
        reserveStock={stats.reserveStock}
        monthlySaving={stats.totalSaving}
        currentMonth={currentMonth}
        lang={lang}
      />
    </div>
  );
}

function KidsGoals() {
  const lang = useLang();
  const t = (ja: string, en: string) => (lang === "en" ? en : ja);
  const kidsState = useMemo(
    () =>
      load<KidsState>("kakeibo-kids-state", {
        incomes: [],
        expenses: [],
        savings: 0,
        monthlyBudget: 0,
        savingsGoal: { title: "", targetAmount: 0, currentAmount: 0 },
      }),
    [],
  );

  const stats = useMemo(() => {
    const recentMonths = [...new Set(kidsState.incomes.map((item) => item.date.slice(0, 7)).concat(kidsState.expenses.map((item) => item.date.slice(0, 7))))].sort().slice(-3);
    const avgIncome = recentMonths.length > 0
      ? Math.round(recentMonths.reduce((sum, month) => sum + kidsState.incomes.filter((item) => item.date.startsWith(month)).reduce((inner, item) => inner + item.amount, 0), 0) / recentMonths.length)
      : 0;
    const avgExpense = recentMonths.length > 0
      ? Math.round(recentMonths.reduce((sum, month) => sum + kidsState.expenses.filter((item) => item.date.startsWith(month)).reduce((inner, item) => inner + item.amount, 0), 0) / recentMonths.length)
      : 0;
    const monthlySaving = Math.max(0, avgIncome - avgExpense);
    const saveRate = avgIncome > 0 ? Math.round((monthlySaving / avgIncome) * 100) : 0;
    const budgetTarget = avgIncome > 0 ? Math.round(clamp(Math.max(avgExpense * 1.1, avgIncome * 0.7), avgIncome * 0.55, avgIncome * 0.85)) : kidsState.monthlyBudget;
    const monthlySavingTarget = avgIncome > 0 ? Math.round(clamp(Math.max(monthlySaving, avgIncome * 0.15), avgIncome * 0.1, avgIncome * 0.35)) : 0;
    const goalRemaining = Math.max(0, kidsState.savingsGoal.targetAmount - kidsState.savings);
    const monthsToGoal = monthlySavingTarget > 0 ? Math.ceil(goalRemaining / monthlySavingTarget) : null;

    return {
      avgIncome,
      avgExpense,
      monthlySaving,
      saveRate,
      budgetTarget,
      monthlySavingTarget,
      goalRemaining,
      monthsToGoal,
    };
  }, [kidsState.expenses, kidsState.incomes, kidsState.monthlyBudget, kidsState.savings, kidsState.savingsGoal.targetAmount]);

  const [budget, setBudget] = useState(() => kidsState.monthlyBudget || stats.budgetTarget);
  const [goalTitle, setGoalTitle] = useState(kidsState.savingsGoal.title);
  const [goalAmount, setGoalAmount] = useState(kidsState.savingsGoal.targetAmount);

  function applyRecommendation() {
    const next: KidsState = {
      ...kidsState,
      monthlyBudget: stats.budgetTarget,
      savingsGoal: {
        ...kidsState.savingsGoal,
        title: kidsState.savingsGoal.title || t("ほしいもの", "Wish item"),
        targetAmount: goalAmount || kidsState.savingsGoal.targetAmount,
      },
    };
    save("kakeibo-kids-state", next);
    setBudget(stats.budgetTarget);
    window.dispatchEvent(new Event("storage"));
  }

  function saveGoal() {
    const next: KidsState = {
      ...kidsState,
      monthlyBudget: budget,
      savingsGoal: {
        ...kidsState.savingsGoal,
        title: goalTitle,
        targetAmount: goalAmount,
      },
    };
    save("kakeibo-kids-state", next);
    window.dispatchEvent(new Event("storage"));
  }

  const progress = goalAmount > 0 ? Math.min(100, Math.round((kidsState.savings / goalAmount) * 100)) : 0;

  return (
    <div className="space-y-4">
      <SectionCard title={t("こどもの生活実態", "Kids real-life summary")}>
        <div className="grid gap-3 md:grid-cols-3">
          <MetricBox label={t("平均おこづかい・収入", "Average allowance / income")} value={formatCurrency(stats.avgIncome)} />
          <MetricBox label={t("平均つかう額", "Average spending")} value={formatCurrency(stats.avgExpense)} />
          <MetricBox label={t("平均ためる額", "Average saving")} value={formatCurrency(stats.monthlySaving)} note={`${stats.saveRate}%`} />
        </div>
      </SectionCard>

      <SectionCard title={t("生活実態からの推奨", "Recommended from actual behavior")}>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {t("使いすぎでも厳しすぎでもないように、直近の収入と支出の平均から目安を出しています。", "Recommendations are based on recent average income and spending so they stay realistic.")}
          </p>
          <button type="button" onClick={applyRecommendation} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-cyan-400">
            {t("推奨を反映", "Apply recommendation")}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <MetricBox label={t("おすすめ予算", "Suggested budget")} value={formatCurrency(stats.budgetTarget)} />
          <MetricBox label={t("おすすめ毎月貯金", "Suggested monthly saving")} value={formatCurrency(stats.monthlySavingTarget)} />
          <MetricBox
            label={t("目標までの目安", "Pace to goal")}
            value={stats.monthsToGoal != null ? t(`約${stats.monthsToGoal}か月`, `About ${stats.monthsToGoal} mo`) : t("未計算", "N/A")}
            note={kidsState.savingsGoal.title || t("目標名を入れると見やすいです", "Add a goal title for clarity")}
          />
        </div>
      </SectionCard>

      <SectionCard title={t("目標を整える", "Adjust the goal")}>
        <label className="block">
          <span className="text-xs text-slate-400">{t("目標名", "Goal title")}</span>
          <input
            type="text"
            value={goalTitle}
            onChange={(event) => setGoalTitle(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
          />
        </label>
        <FieldRow label={t("目標金額 (円)", "Goal amount (¥)")} value={goalAmount} onChange={setGoalAmount} />
        <FieldRow label={t("毎月つかう予算 (円)", "Monthly spending budget (¥)")} value={budget} onChange={setBudget} />
        <button type="button" onClick={saveGoal} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-cyan-400">
          {t("保存", "Save")}
        </button>
      </SectionCard>

      {goalAmount > 0 && (
        <SectionCard title={t("目標の進み具合", "Goal progress")}>
          <div className="h-3 rounded-full bg-slate-800">
            <div className="h-3 rounded-full bg-violet-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{formatCurrency(kidsState.savings)}</span>
            <span>{formatCurrency(goalAmount)}</span>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function SeniorGoals() {
  const lang = useLang();
  const t = (ja: string, en: string) => (lang === "en" ? en : ja);
  const seniorState = useMemo(
    () =>
      normalizeSeniorState(
        load<SeniorState>("senior-finance-one-page", {
          monthlyBudget: 0,
          savingGoal: 0,
          entries: [],
        }),
      ),
    [],
  );

  const stats = useMemo(() => {
    const recentMonths = [...new Set(seniorState.entries.map((item) => item.date.slice(0, 7)))].sort().slice(-3);
    const average = (type: string) =>
      recentMonths.length > 0
        ? Math.round(
            recentMonths.reduce(
              (sum, month) => sum + seniorState.entries.filter((item) => item.date.startsWith(month) && item.type === type).reduce((inner, item) => inner + item.amount, 0),
              0,
            ) / recentMonths.length,
          )
        : 0;

    const income = average("income");
    const expense = average("expense");
    const saving = average("saving");
    const balance = income - expense - saving;
    const recommendedBudget = income > 0 ? Math.round(clamp(Math.max(expense * 1.02, income * 0.82), income * 0.75, income * 0.95)) : seniorState.monthlyBudget;
    const recommendedSaving = income > 0
      ? balance > 0
        ? Math.round(clamp(Math.min(balance * 0.8, income * 0.15), income * 0.03, income * 0.15))
        : 0
      : seniorState.savingGoal;
    const shortfall = Math.max(0, expense - income);
    const cautionBuffer = shortfall > 0 ? shortfall * 12 : 0;

    return {
      income,
      expense,
      saving,
      balance,
      recommendedBudget,
      recommendedSaving,
      shortfall,
      cautionBuffer,
    };
  }, [seniorState.entries, seniorState.monthlyBudget, seniorState.savingGoal]);

  const [budget, setBudget] = useState(seniorState.monthlyBudget);
  const [savingGoal, setSavingGoal] = useState(seniorState.savingGoal);

  function applyRecommendation() {
    const next: SeniorState = {
      ...seniorState,
      monthlyBudget: stats.recommendedBudget,
      savingGoal: stats.recommendedSaving,
    };
    save("senior-finance-one-page", next);
    setBudget(stats.recommendedBudget);
    setSavingGoal(stats.recommendedSaving);
    window.dispatchEvent(new Event("storage"));
  }

  function saveGoals() {
    const next: SeniorState = {
      ...seniorState,
      monthlyBudget: budget,
      savingGoal,
    };
    save("senior-finance-one-page", next);
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <div className="space-y-4">
      <SectionCard title={t("シニアの生活実態", "Senior real-life summary")}>
        <div className="grid gap-3 md:grid-cols-3">
          <MetricBox label={t("平均収入・年金", "Average income / pension")} value={formatCurrency(stats.income)} />
          <MetricBox label={t("平均支出", "Average spending")} value={formatCurrency(stats.expense)} />
          <MetricBox label={t("月の差額", "Monthly balance")} value={formatCurrency(stats.balance)} />
        </div>
      </SectionCard>

      <SectionCard title={t("生活実態からの推奨", "Recommended from actual living costs")}>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {t("年金や収入に対して無理のない生活費上限と貯蓄目標に直しています。赤字ならまず黒字化優先です。", "Recommendations focus on a realistic living budget and savings goal. If you are in deficit, returning to surplus comes first.")}
          </p>
          <button type="button" onClick={applyRecommendation} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-cyan-400">
            {t("推奨を反映", "Apply recommendation")}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <MetricBox label={t("おすすめ生活予算", "Suggested living budget")} value={formatCurrency(stats.recommendedBudget)} />
          <MetricBox label={t("おすすめ月間貯金", "Suggested monthly saving")} value={formatCurrency(stats.recommendedSaving)} />
          <MetricBox
            label={t("不足時の1年分目安", "1-year shortfall buffer")}
            value={stats.cautionBuffer > 0 ? formatCurrency(stats.cautionBuffer) : t("不足なし", "No shortfall")}
            note={stats.shortfall > 0 ? t("毎月の不足を12か月分で見ています", "Monthly shortfall multiplied by 12") : undefined}
          />
        </div>
      </SectionCard>

      <SectionCard title={t("目標を調整", "Adjust goals")}>
        <FieldRow label={t("毎月の生活予算 (円)", "Monthly living budget (¥)")} value={budget} onChange={setBudget} />
        <FieldRow label={t("毎月の貯金目標 (円)", "Monthly savings goal (¥)")} value={savingGoal} onChange={setSavingGoal} />
        <button type="button" onClick={saveGoals} className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-cyan-400">
          {t("保存", "Save")}
        </button>
      </SectionCard>
    </div>
  );
}

export default function GenerationGoals({ transactions, currentMonth, profile, generation: generationProp, onGenerationChange }: Props) {
  const lang = useLang();
  const [internalGeneration, setInternalGeneration] = useState<Generation>("general");
  const t = (ja: string, en: string) => (lang === "en" ? en : ja);
  const generation = generationProp ?? internalGeneration;

  function handleGenerationChange(next: Generation) {
    if (onGenerationChange) {
      onGenerationChange(next);
      return;
    }
    setInternalGeneration(next);
  }

  return (
    <div className="goal-clarity space-y-4">
      <div className="flex gap-2 rounded-2xl border border-slate-500/80 bg-slate-950/90 p-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
        {([
          { key: "general", label: t("個人", "Personal") },
          { key: "kids", label: t("こども", "Kids") },
          { key: "senior", label: t("シニア", "Senior") },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleGenerationChange(tab.key)}
            className={`flex-1 rounded-xl border px-4 py-2 text-xs font-bold transition ${
              generation === tab.key ? "border-violet-500 bg-violet-600 text-white shadow-sm" : "border-slate-600 bg-slate-900/80 text-slate-50 hover:border-slate-400 hover:bg-slate-700/90 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {generation === "general" && <GeneralGoals transactions={transactions} currentMonth={currentMonth} profile={profile} />}
      {generation === "kids" && <KidsGoals />}
      {generation === "senior" && <SeniorGoals />}
    </div>
  );
}
