"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency, type Transaction } from "@/lib/utils";
import { useLang } from "@/lib/hooks/useLang";
import {
  buildFixedCostFlags,
  buildFixedCostFlagVisibilityId,
  loadHiddenFixedCostFlagIds,
  loadReviewedFixedCostFlagIds,
  saveHiddenFixedCostFlagIds,
  saveReviewedFixedCostFlagIds,
  type FixedCostFlag,
} from "@/lib/fixed-cost-flags";

interface Debt {
  id: string;
  name: string;
  type: "loan" | "mortgage" | "credit" | "other";
  totalAmount: number;
  remainingAmount: number;
  monthlyPayment: number;
  interestRate: number;
  memo: string;
}

type GoalStatus = "active" | "completed" | "archived";

interface GoalLifecycle {
  status?: GoalStatus;
  createdAt?: string;
  completedAt?: string;
  archivedAt?: string;
}

interface SinkingFund extends GoalLifecycle {
  id: string;
  name: string;
  emoji: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  memo: string;
}

interface PersonalGoal extends GoalLifecycle {
  id: string;
  name: string;
  emoji: string;
  targetAmount: number;
  currentAmount: number;
  memo: string;
}

interface Props {
  transactions: Transaction[];
  currentMonth: string;
}

const KEY_DEBTS = "kakeibo-debts";
const KEY_SINKING = "kakeibo-sinking-funds";
const KEY_GOALS = "kakeibo-personal-goals";
const KEY_TICKET_VALUE = "kakeibo-ticket-value";
const KEY_TICKETS_USED = "kakeibo-tickets-used";
const ARCHIVE_AFTER_MONTHS = 1;

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

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function todayMonth(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(ym: string, count: number): string {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(year, month - 1 + count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

function isMonthValue(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

function isTargetComplete(item: { targetAmount: number; currentAmount: number }) {
  return item.targetAmount > 0 && item.currentAmount >= item.targetAmount;
}

function normalizeGoalStatus<T extends GoalLifecycle & { targetAmount: number; currentAmount: number }>(item: T): T {
  const now = todayMonth();
  const complete = isTargetComplete(item);
  let status: GoalStatus = item.status === "completed" || item.status === "archived" ? item.status : "active";
  let completedAt = isMonthValue(item.completedAt) ? item.completedAt : undefined;
  let archivedAt = isMonthValue(item.archivedAt) ? item.archivedAt : undefined;

  if (status !== "archived" && !complete) {
    status = "active";
    completedAt = undefined;
    archivedAt = undefined;
  }

  if (complete && status === "active") {
    status = "completed";
    completedAt = completedAt ?? now;
  }

  if (complete && status === "completed" && completedAt && monthsBetween(completedAt, now) >= ARCHIVE_AFTER_MONTHS) {
    status = "archived";
    archivedAt = archivedAt ?? now;
  }

  if (status === "archived") {
    archivedAt = archivedAt ?? now;
    completedAt = complete ? completedAt ?? now : undefined;
  }

  return {
    ...item,
    status,
    createdAt: isMonthValue(item.createdAt) ? item.createdAt : now,
    completedAt,
    archivedAt,
  };
}

function normalizeSinkingFunds(items: SinkingFund[]): SinkingFund[] {
  return Array.isArray(items) ? items.map((item) => normalizeGoalStatus(item)) : [];
}

function normalizePersonalGoals(items: PersonalGoal[]): PersonalGoal[] {
  return Array.isArray(items) ? items.map((item) => normalizeGoalStatus(item)) : [];
}

function calcVirtuePoints(transactions: Transaction[]) {
  const months = [...new Set(transactions.map((transaction) => transaction.date.slice(0, 7)))].sort();

  const byMonth = months.map((ym) => {
    const txs = transactions.filter((transaction) => transaction.date.startsWith(ym));
    const income = txs.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
    const expense = txs.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + transaction.amount, 0);
    const saving = txs.filter((transaction) => transaction.type === "saving").reduce((sum, transaction) => sum + transaction.amount, 0);
    const investment = txs.filter((transaction) => transaction.type === "investment").reduce((sum, transaction) => sum + transaction.amount, 0);
    const fixed = txs.filter((transaction) => transaction.type === "expense" && transaction.is_fixed).reduce((sum, transaction) => sum + transaction.amount, 0);
    const balance = income - expense - saving - investment;
    const savingRate = income > 0 ? ((saving + investment) / income) * 100 : 0;
    const fixedRate = income > 0 ? (fixed / income) * 100 : 100;
    const variableRate = income > 0 ? ((expense - fixed) / income) * 100 : 100;
    const reasons: string[] = [];
    let points = 0;

    if (income > 0) {
      if (savingRate >= 20) {
        points += 10;
        reasons.push("貯蓄率20%以上 +10");
      } else if (savingRate >= 10) {
        points += 5;
        reasons.push("貯蓄率10%以上 +5");
      }
      if (balance > 0) {
        points += 5;
        reasons.push("黒字 +5");
      }
      if (fixedRate <= 35) {
        points += 3;
        reasons.push("固定費率35%以下 +3");
      }
      if (variableRate <= 25) {
        points += 5;
        reasons.push("変動費率25%以下 +5");
      }
      if (saving + investment > 0) {
        points += 2;
        reasons.push("貯蓄・投資あり +2");
      }
    }

    return { ym, points, reasons };
  });

  return {
    total: byMonth.reduce((sum, month) => sum + month.points, 0),
    byMonth,
  };
}

function FixedCostFlagItem({
  flag,
  onHide,
  onToggleReviewed,
}: {
  flag: FixedCostFlag;
  onHide: (id: string) => void;
  onToggleReviewed: (id: string) => void;
}) {
  const lang = useLang();
  const t = (ja: string, en: string) => (lang === "en" ? en : ja);
  const priorityLabel = {
    high: t("優先度 高", "High priority"),
    medium: t("優先度 中", "Medium priority"),
    low: t("優先度 低", "Low priority"),
  }[flag.priority];
  const tone = flag.reviewed
    ? "border-slate-700 bg-slate-900/60"
    : flag.priority === "high"
      ? "border-rose-500/50 bg-rose-950/30"
      : flag.priority === "medium"
        ? "border-amber-500/50 bg-amber-950/30"
        : "border-cyan-500/40 bg-cyan-950/20";

  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-100">{flag.title}</p>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
              {priorityLabel}
            </span>
            {flag.reviewed && (
              <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                {t("確認済み", "Reviewed")}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {lang === "en" ? flag.categoryLabelEn : flag.categoryLabelJa}
            {flag.count > 1 ? ` / ${flag.count}${t("件", " charges")}` : ""}
            {flag.paymentMethods.length > 0 ? ` / ${flag.paymentMethods.join(", ")}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-slate-400">{t("月額候補", "Monthly impact")}</p>
          <p className="text-base font-black text-slate-100">{formatCurrency(flag.amount)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {(lang === "en" ? flag.reasonsEn : flag.reasonsJa).map((reason) => (
          <span key={reason} className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
            {reason}
          </span>
        ))}
      </div>

      <div className="mt-3 rounded-lg bg-slate-950/70 px-3 py-2">
        <p className="text-xs font-semibold text-slate-200">{lang === "en" ? flag.actionEn : flag.actionJa}</p>
        <p className="mt-1 text-[10px] text-slate-500">
          {t("最終発生日", "Last charged")}: {flag.lastDate}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onToggleReviewed(flag.id)}
        className="mt-3 w-full rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
      >
        {flag.reviewed ? t("未確認に戻す", "Mark as unreviewed") : t("確認済みにする", "Mark as reviewed")}
      </button>
      <button
        type="button"
        onClick={() => onHide(flag.id)}
        className="mt-2 w-full rounded-lg border border-emerald-600/60 bg-emerald-700/25 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-600/35"
      >
        {t("対応済みで非表示", "Done & hide")}
      </button>
    </div>
  );
}

function SinkingFundItem({
  fund,
  onAdd,
  onArchive,
  onEdit,
  onDelete,
}: {
  fund: SinkingFund;
  onAdd: (id: string, amount: number) => void;
  onArchive: (id: string) => void;
  onEdit: (fund: SinkingFund) => void;
  onDelete: (id: string) => void;
}) {
  const lang = useLang();
  const t = (ja: string, en: string) => (lang === "en" ? en : ja);
  const [addAmount, setAddAmount] = useState("");
  const progress = fund.targetAmount > 0 ? Math.min(100, Math.round((fund.currentAmount / fund.targetAmount) * 100)) : 0;
  const done = fund.targetAmount > 0 && fund.currentAmount >= fund.targetAmount;
  const monthsLeft = Math.max(0, monthsBetween(todayMonth(), fund.targetDate));
  const overdue = !done && monthsBetween(fund.targetDate, todayMonth()) > 0;
  const remaining = Math.max(0, fund.targetAmount - fund.currentAmount);
  const monthlyNeeded = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;

  return (
    <div className={`rounded-xl border p-3 ${done ? "border-emerald-700/40 bg-emerald-950/20" : "border-slate-700/50 bg-slate-800/60"}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-lg">{fund.emoji}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-100">{fund.name}</span>
              {overdue && <span className="rounded bg-amber-700/40 px-1.5 py-0.5 text-[10px] text-amber-200">{t("期限超過", "Overdue")}</span>}
              {done && <span className="rounded bg-emerald-700/40 px-1.5 py-0.5 text-[10px] text-emerald-200">{t("達成", "Done")}</span>}
            </div>
            <p className="text-[10px] text-slate-500">
              {t("目標月", "Target")}: {fund.targetDate}
            </p>
            {fund.completedAt && (
              <p className="text-[10px] text-slate-500">
                {t("達成", "Completed")}: {fund.completedAt}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {done && fund.status !== "archived" && (
            <button type="button" onClick={() => onArchive(fund.id)} className="rounded-lg border border-emerald-700/40 bg-emerald-700/20 px-2 py-1 text-[10px] text-emerald-200 transition-colors hover:bg-emerald-600/30">
              {t("過去へ", "Archive")}
            </button>
          )}
          <button type="button" onClick={() => onEdit(fund)} className="rounded-lg bg-slate-700/40 px-2 py-1 text-[10px] text-slate-300 transition-colors hover:bg-slate-600">
            {t("編集", "Edit")}
          </button>
          <button type="button" onClick={() => onDelete(fund.id)} className="rounded-lg px-2 py-1 text-[10px] text-red-300 transition-colors hover:text-red-100">
            {t("削除", "Delete")}
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-[10px] text-slate-500">{t("目標", "Target")}</p>
          <p className="font-semibold text-emerald-300">{formatCurrency(fund.targetAmount)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">{t("積立済み", "Saved")}</p>
          <p className="font-semibold text-sky-300">{formatCurrency(fund.currentAmount)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">{t("月々必要", "Monthly")}</p>
          <p className="font-semibold text-orange-300">{done ? "-" : formatCurrency(monthlyNeeded)}</p>
        </div>
      </div>

      {!done && monthsLeft > 0 && (
        <p className="mb-2 text-[10px] text-slate-500">
          {t("残り", "Left")}: {monthsLeft}{t("ヶ月", " months")} / {formatCurrency(remaining)}
        </p>
      )}

      <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-700">
        <div className={`h-2 rounded-full ${done ? "bg-emerald-500" : "bg-violet-500"}`} style={{ width: `${progress}%` }} />
      </div>
      <p className="mb-2 text-[10px] text-slate-500">
        {t("達成率", "Progress")}: {progress}%
      </p>

      {!done && (
        <div className="flex gap-1">
          <input
            type="number"
            placeholder={t("積立額を入力", "Enter amount")}
            value={addAmount}
            onChange={(event) => setAddAmount(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs focus:border-violet-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const amount = Number(addAmount);
              if (amount > 0) {
                onAdd(fund.id, amount);
                setAddAmount("");
              }
            }}
            className="rounded-lg bg-violet-600 px-3 py-1 text-xs transition-all hover:bg-violet-500"
          >
            {t("積立", "Save")}
          </button>
        </div>
      )}
      {fund.memo && <p className="mt-2 text-[10px] text-slate-500">{fund.memo}</p>}
    </div>
  );
}

function GoalItem({
  goal,
  ticketsAvailable,
  ticketValue,
  onAddManual,
  onUseTicket,
  onArchive,
  onEdit,
  onDelete,
}: {
  goal: PersonalGoal;
  ticketsAvailable: number;
  ticketValue: number;
  onAddManual: (id: string, amount: number) => void;
  onUseTicket: (id: string) => void;
  onArchive: (id: string) => void;
  onEdit: (goal: PersonalGoal) => void;
  onDelete: (id: string) => void;
}) {
  const lang = useLang();
  const t = (ja: string, en: string) => (lang === "en" ? en : ja);
  const [addAmount, setAddAmount] = useState("");
  const progress = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
  const done = goal.targetAmount > 0 && goal.currentAmount >= goal.targetAmount;

  return (
    <div className={`rounded-xl border p-3 ${done ? "border-pink-700/40 bg-pink-950/20" : "border-slate-700/50 bg-slate-800/60"}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xl">{goal.emoji}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-100">{goal.name}</span>
              {done && <span className="rounded bg-pink-700/40 px-1.5 py-0.5 text-[10px] text-pink-200">{t("達成", "Done")}</span>}
            </div>
            {goal.completedAt && <p className="text-[10px] text-slate-500">{t("達成", "Completed")}: {goal.completedAt}</p>}
            {goal.memo && <p className="text-[10px] text-slate-500">{goal.memo}</p>}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {done && goal.status !== "archived" && (
            <button type="button" onClick={() => onArchive(goal.id)} className="rounded-lg border border-pink-700/40 bg-pink-700/20 px-2 py-1 text-[10px] text-pink-200 transition-colors hover:bg-pink-600/30">
              {t("過去へ", "Archive")}
            </button>
          )}
          <button type="button" onClick={() => onEdit(goal)} className="rounded-lg bg-slate-700/40 px-2 py-1 text-[10px] text-slate-300 transition-colors hover:bg-slate-600">
            {t("編集", "Edit")}
          </button>
          <button type="button" onClick={() => onDelete(goal.id)} className="rounded-lg px-2 py-1 text-[10px] text-red-300 transition-colors hover:text-red-100">
            {t("削除", "Delete")}
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[10px] text-slate-500">{t("目標", "Target")}</p>
          <p className="font-semibold text-pink-300">{goal.targetAmount > 0 ? formatCurrency(goal.targetAmount) : t("未設定", "Not set")}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">{t("貯まった", "Saved")}</p>
          <p className="font-semibold text-violet-300">{formatCurrency(goal.currentAmount)}</p>
        </div>
      </div>

      {goal.targetAmount > 0 && (
        <>
          <div className="mb-1 h-2 overflow-hidden rounded-full bg-slate-700">
            <div className={`h-2 rounded-full ${done ? "bg-pink-500" : "bg-violet-500"}`} style={{ width: `${progress}%` }} />
          </div>
          <p className="mb-2 text-[10px] text-slate-500">
            {t("達成率", "Progress")}: {progress}% / {t("あと", "Left")} {formatCurrency(Math.max(0, goal.targetAmount - goal.currentAmount))}
          </p>
        </>
      )}

      {!done && (
      <div className="flex gap-1">
        {ticketsAvailable > 0 && !done && (
          <button
            type="button"
            onClick={() => onUseTicket(goal.id)}
            className="rounded-lg border border-violet-600/40 bg-violet-700/40 px-2 py-1 text-[10px] text-violet-200 transition-all hover:bg-violet-600/60"
          >
            {t("チケット使用", "Use ticket")} (+{formatCurrency(ticketValue)})
          </button>
        )}
        <input
          type="number"
          placeholder={t("手動で追加", "Add manually")}
          value={addAmount}
          onChange={(event) => setAddAmount(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs focus:border-violet-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            const amount = Number(addAmount);
            if (amount > 0) {
              onAddManual(goal.id, amount);
              setAddAmount("");
            }
          }}
          className="rounded-lg bg-pink-600/70 px-3 py-1 text-xs transition-all hover:bg-pink-500"
        >
          {t("追加", "Add")}
        </button>
      </div>
      )}
    </div>
  );
}

export default function GoalsAndDebt({ transactions, currentMonth }: Props) {
  const lang = useLang();
  const t = (ja: string, en: string) => (lang === "en" ? en : ja);
  const [tab, setTab] = useState<"debt" | "sinking" | "goals" | "fixedCostFlags" | "virtue">("debt");
  const [debts, setDebts] = useState<Debt[]>(() => load(KEY_DEBTS, []));
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [debtForm, setDebtForm] = useState<Omit<Debt, "id">>({
    name: "",
    type: "loan",
    totalAmount: 0,
    remainingAmount: 0,
    monthlyPayment: 0,
    interestRate: 0,
    memo: "",
  });
  const [editDebtId, setEditDebtId] = useState<string | null>(null);
  const [sinkingFunds, setSinkingFunds] = useState<SinkingFund[]>(() => normalizeSinkingFunds(load(KEY_SINKING, [])));
  const [showSinkingForm, setShowSinkingForm] = useState(false);
  const [sinkingForm, setSinkingForm] = useState<Omit<SinkingFund, "id">>({
    name: "",
    emoji: "💰",
    targetAmount: 0,
    currentAmount: 0,
    targetDate: addMonths(todayMonth(), 12),
    memo: "",
  });
  const [editSinkingId, setEditSinkingId] = useState<string | null>(null);
  const [goals, setGoals] = useState<PersonalGoal[]>(() => normalizePersonalGoals(load(KEY_GOALS, [])));
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState<Omit<PersonalGoal, "id">>({
    name: "",
    emoji: "🎯",
    targetAmount: 0,
    currentAmount: 0,
    memo: "",
  });
  const [editGoalId, setEditGoalId] = useState<string | null>(null);
  const [ticketValue, setTicketValue] = useState<number>(() => load(KEY_TICKET_VALUE, 1000));
  const [ticketsUsed, setTicketsUsed] = useState<number>(() => load(KEY_TICKETS_USED, 0));
  const [reviewedFixedCostFlagIds, setReviewedFixedCostFlagIds] = useState<string[]>(() => loadReviewedFixedCostFlagIds());
  const [hiddenFixedCostFlagIds, setHiddenFixedCostFlagIds] = useState<string[]>(() => loadHiddenFixedCostFlagIds());

  const fixedCostFlags = useMemo(
    () => buildFixedCostFlags(transactions, currentMonth, reviewedFixedCostFlagIds, hiddenFixedCostFlagIds),
    [transactions, currentMonth, reviewedFixedCostFlagIds, hiddenFixedCostFlagIds]
  );
  const openFixedCostFlags = fixedCostFlags.filter((flag) => !flag.reviewed);
  const monthlyFlagTotal = openFixedCostFlags.reduce((sum, flag) => sum + flag.amount, 0);
  const hiddenFixedCostFlagsThisMonth = hiddenFixedCostFlagIds.filter((id) => id.startsWith(`${currentMonth}:`)).length;
  const virtue = useMemo(() => calcVirtuePoints(transactions), [transactions]);
  const ticketsEarned = Math.floor(virtue.total / 100);
  const ticketsAvailable = Math.max(0, ticketsEarned - ticketsUsed);
  const activeSinkingFunds = useMemo(() => sinkingFunds.filter((fund) => fund.status !== "archived"), [sinkingFunds]);
  const archivedSinkingFunds = useMemo(() => sinkingFunds.filter((fund) => fund.status === "archived"), [sinkingFunds]);
  const activeGoals = useMemo(() => goals.filter((goal) => goal.status !== "archived"), [goals]);
  const archivedGoals = useMemo(() => goals.filter((goal) => goal.status === "archived"), [goals]);

  useEffect(() => {
    save(KEY_SINKING, sinkingFunds);
  }, [sinkingFunds]);

  useEffect(() => {
    save(KEY_GOALS, goals);
  }, [goals]);

  useEffect(() => {
    function handleGoalsUpdated() {
      setGoals(normalizePersonalGoals(load(KEY_GOALS, [])));
    }
    window.addEventListener("kakeibo-goals-updated", handleGoalsUpdated);
    return () => window.removeEventListener("kakeibo-goals-updated", handleGoalsUpdated);
  }, []);

  const saveDebts = useCallback((next: Debt[]) => {
    setDebts(next);
    save(KEY_DEBTS, next);
  }, []);
  const saveSinkingFunds = useCallback((next: SinkingFund[]) => {
    const normalized = normalizeSinkingFunds(next);
    setSinkingFunds(normalized);
    save(KEY_SINKING, normalized);
  }, []);
  const saveGoals = useCallback((next: PersonalGoal[]) => {
    const normalized = normalizePersonalGoals(next);
    setGoals(normalized);
    save(KEY_GOALS, normalized);
  }, []);

  function submitDebt() {
    if (!debtForm.name.trim()) return;

    if (editDebtId) {
      saveDebts(debts.map((debt) => (debt.id === editDebtId ? { id: editDebtId, ...debtForm } : debt)));
    } else {
      saveDebts([...debts, { id: newId(), ...debtForm }]);
    }

    setDebtForm({ name: "", type: "loan", totalAmount: 0, remainingAmount: 0, monthlyPayment: 0, interestRate: 0, memo: "" });
    setEditDebtId(null);
    setShowDebtForm(false);
  }

  function editDebt(debt: Debt) {
    setDebtForm({
      name: debt.name,
      type: debt.type,
      totalAmount: debt.totalAmount,
      remainingAmount: debt.remainingAmount,
      monthlyPayment: debt.monthlyPayment,
      interestRate: debt.interestRate,
      memo: debt.memo,
    });
    setEditDebtId(debt.id);
    setShowDebtForm(true);
  }

  function deleteDebt(id: string) {
    saveDebts(debts.filter((debt) => debt.id !== id));
  }

  function payDebt(id: string) {
    saveDebts(
      debts.map((debt) => {
        if (debt.id !== id) return debt;
        return { ...debt, remainingAmount: Math.max(0, debt.remainingAmount - debt.monthlyPayment) };
      })
    );
  }

  function submitSinkingFund() {
    if (!sinkingForm.name.trim()) return;

    if (editSinkingId) {
      saveSinkingFunds(sinkingFunds.map((fund) => (fund.id === editSinkingId ? { ...fund, ...sinkingForm } : fund)));
    } else {
      saveSinkingFunds([...sinkingFunds, { id: newId(), ...sinkingForm, status: "active", createdAt: todayMonth() }]);
    }

    setSinkingForm({ name: "", emoji: "💰", targetAmount: 0, currentAmount: 0, targetDate: addMonths(todayMonth(), 12), memo: "" });
    setEditSinkingId(null);
    setShowSinkingForm(false);
  }

  function editSinkingFund(fund: SinkingFund) {
    setSinkingForm({
      name: fund.name,
      emoji: fund.emoji,
      targetAmount: fund.targetAmount,
      currentAmount: fund.currentAmount,
      targetDate: fund.targetDate,
      memo: fund.memo,
    });
    setEditSinkingId(fund.id);
    setShowSinkingForm(true);
  }

  function deleteSinkingFund(id: string) {
    saveSinkingFunds(sinkingFunds.filter((fund) => fund.id !== id));
  }

  function archiveSinkingFund(id: string) {
    saveSinkingFunds(
      sinkingFunds.map((fund) =>
        fund.id === id
          ? {
              ...fund,
              status: "archived",
              completedAt: fund.completedAt ?? (isTargetComplete(fund) ? todayMonth() : undefined),
              archivedAt: todayMonth(),
            }
          : fund
      )
    );
  }

  function restoreSinkingFund(id: string) {
    saveSinkingFunds(
      sinkingFunds.map((fund) =>
        fund.id === id
          ? {
              ...fund,
              status: isTargetComplete(fund) ? "completed" : "active",
              completedAt: isTargetComplete(fund) ? todayMonth() : undefined,
              archivedAt: undefined,
            }
          : fund
      )
    );
  }

  function addToSinkingFund(id: string, amount: number) {
    saveSinkingFunds(
      sinkingFunds.map((fund) =>
        fund.id === id ? { ...fund, currentAmount: Math.min(fund.targetAmount, fund.currentAmount + amount) } : fund
      )
    );
  }

  function submitGoal() {
    if (!goalForm.name.trim()) return;

    if (editGoalId) {
      saveGoals(goals.map((goal) => (goal.id === editGoalId ? { ...goal, ...goalForm } : goal)));
    } else {
      saveGoals([...goals, { id: newId(), ...goalForm, status: "active", createdAt: todayMonth() }]);
    }

    setGoalForm({ name: "", emoji: "🎯", targetAmount: 0, currentAmount: 0, memo: "" });
    setEditGoalId(null);
    setShowGoalForm(false);
  }

  function editGoal(goal: PersonalGoal) {
    setGoalForm({
      name: goal.name,
      emoji: goal.emoji,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      memo: goal.memo,
    });
    setEditGoalId(goal.id);
    setShowGoalForm(true);
  }

  function deleteGoal(id: string) {
    saveGoals(goals.filter((goal) => goal.id !== id));
  }

  function archiveGoal(id: string) {
    saveGoals(
      goals.map((goal) =>
        goal.id === id
          ? {
              ...goal,
              status: "archived",
              completedAt: goal.completedAt ?? (isTargetComplete(goal) ? todayMonth() : undefined),
              archivedAt: todayMonth(),
            }
          : goal
      )
    );
  }

  function restoreGoal(id: string) {
    saveGoals(
      goals.map((goal) =>
        goal.id === id
          ? {
              ...goal,
              status: isTargetComplete(goal) ? "completed" : "active",
              completedAt: isTargetComplete(goal) ? todayMonth() : undefined,
              archivedAt: undefined,
            }
          : goal
      )
    );
  }

  function addManualToGoal(id: string, amount: number) {
    saveGoals(goals.map((goal) => (goal.id === id ? { ...goal, currentAmount: goal.currentAmount + amount } : goal)));
  }

  function useTicketOnGoal(id: string) {
    if (ticketsAvailable <= 0) return;

    saveGoals(
      goals.map((goal) =>
        goal.id === id ? { ...goal, currentAmount: Math.min(goal.targetAmount || Infinity, goal.currentAmount + ticketValue) } : goal
      )
    );
    const nextTicketsUsed = ticketsUsed + 1;
    setTicketsUsed(nextTicketsUsed);
    save(KEY_TICKETS_USED, nextTicketsUsed);
  }

  function toggleReviewedFixedCostFlag(id: string) {
    const next = reviewedFixedCostFlagIds.includes(id)
      ? reviewedFixedCostFlagIds.filter((item) => item !== id)
      : [...reviewedFixedCostFlagIds, id];
    setReviewedFixedCostFlagIds(next);
    saveReviewedFixedCostFlagIds(next);
  }

  function hideFixedCostFlag(id: string) {
    const hiddenId = buildFixedCostFlagVisibilityId(id, currentMonth);
    const next = [...new Set([...hiddenFixedCostFlagIds, hiddenId])];
    setHiddenFixedCostFlagIds(next);
    saveHiddenFixedCostFlagIds(next);
  }

  function restoreHiddenFixedCostFlagsThisMonth() {
    const next = hiddenFixedCostFlagIds.filter((id) => !id.startsWith(`${currentMonth}:`));
    setHiddenFixedCostFlagIds(next);
    saveHiddenFixedCostFlagIds(next);
  }

  const debtTypeLabel: Record<Debt["type"], string> = {
    loan: t("ローン", "Loan"),
    mortgage: t("住宅ローン", "Mortgage"),
    credit: t("クレジット", "Credit"),
    other: t("その他", "Other"),
  };
  const sinkingEmojis = ["💰", "🚗", "✈️", "🏠", "🎓", "🧾", "🛠️", "🎁"];
  const goalEmojis = ["🎯", "🎤", "🌸", "🎮", "🎬", "💄", "👗", "📚", "🏃", "✨"];

  return (
    <div className="goal-clarity flex flex-col gap-3">
      <div className="flex gap-1 rounded-xl border border-slate-500/80 bg-slate-950/90 p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
        {([
          { key: "debt", label: t("ローン", "Loans"), fullLabel: t("ローン・借入", "Loans & debt") },
          { key: "sinking", label: t("積立", "Savings"), fullLabel: t("先取積み立て", "Sinking funds") },
          { key: "goals", label: t("個人", "Personal"), fullLabel: t("個人目標", "Personal goals") },
          { key: "fixedCostFlags", label: t("固定費", "Fixed"), fullLabel: t("固定費見直し", "Fixed cost flags") },
          { key: "virtue", label: t("徳", "Virtue"), fullLabel: t("徳ポイント", "Virtue points") },
        ] as const).map(({ key, label, fullLabel }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              tab === key ? "bg-violet-600 text-white shadow-sm" : "bg-slate-900/75 text-slate-50 hover:bg-slate-700/90 hover:text-white"
            }`}
          >
            <span className="sm:hidden">{label}</span>
            <span className="hidden sm:inline">{fullLabel}</span>
          </button>
        ))}
      </div>

      {tab === "debt" && (
        <div className="flex flex-col gap-2">
          {debts.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2 text-center">
                <p className="text-[10px] text-slate-400">{t("残高合計", "Total balance")}</p>
                <p className="text-sm font-bold text-red-300">{formatCurrency(debts.reduce((sum, debt) => sum + debt.remainingAmount, 0))}</p>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2 text-center">
                <p className="text-[10px] text-slate-400">{t("月返済", "Monthly pay")}</p>
                <p className="text-sm font-bold text-orange-300">{formatCurrency(debts.reduce((sum, debt) => sum + debt.monthlyPayment, 0))}</p>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2 text-center">
                <p className="text-[10px] text-slate-400">{t("完済", "Paid off")}</p>
                <p className="text-sm font-bold text-emerald-300">{debts.filter((debt) => debt.remainingAmount <= 0).length} / {debts.length}</p>
              </div>
            </div>
          )}

          {debts.map((debt) => {
            const paidRate = debt.totalAmount > 0 ? Math.round((1 - debt.remainingAmount / debt.totalAmount) * 100) : 100;
            const monthsLeft = debt.monthlyPayment > 0 ? Math.ceil(debt.remainingAmount / debt.monthlyPayment) : null;
            const eta = monthsLeft != null ? addMonths(todayMonth(), monthsLeft) : null;
            const done = debt.remainingAmount <= 0;

            return (
              <div key={debt.id} className={`rounded-xl border p-3 ${done ? "border-emerald-700/40 bg-emerald-950/20" : "border-slate-700/50 bg-slate-800/60"}`}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">{debt.name}</span>
                      <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">{debtTypeLabel[debt.type]}</span>
                      {done && <span className="rounded bg-emerald-700/40 px-1.5 py-0.5 text-[10px] text-emerald-200">{t("完済", "Paid off")}</span>}
                    </div>
                    {debt.memo && <p className="mt-0.5 text-[10px] text-slate-500">{debt.memo}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {!done && (
                      <button type="button" onClick={() => payDebt(debt.id)} className="rounded-lg border border-emerald-700/40 bg-emerald-700/30 px-2 py-1 text-[10px] text-emerald-200 transition-colors hover:bg-emerald-600/40">
                        {t("返済", "Pay")}
                      </button>
                    )}
                    <button type="button" onClick={() => editDebt(debt)} className="rounded-lg bg-slate-700/40 px-2 py-1 text-[10px] text-slate-300 transition-colors hover:bg-slate-600">
                      {t("編集", "Edit")}
                    </button>
                    <button type="button" onClick={() => deleteDebt(debt.id)} className="rounded-lg px-2 py-1 text-[10px] text-red-300 transition-colors hover:text-red-100">
                      {t("削除", "Delete")}
                    </button>
                  </div>
                </div>

                <div className="mb-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-500">{t("残高", "Balance")}</p>
                    <p className={`font-semibold ${done ? "text-emerald-300" : "text-red-300"}`}>{formatCurrency(debt.remainingAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">{t("月返済", "Monthly")}</p>
                    <p className="font-semibold text-orange-300">{formatCurrency(debt.monthlyPayment)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">{t("完済予定", "ETA")}</p>
                    <p className="font-semibold text-sky-300">{done ? t("完済", "Done") : eta ?? "-"}</p>
                  </div>
                </div>

                {!done && monthsLeft != null && (
                  <p className="mb-2 text-[10px] text-slate-500">
                    {t("完済まで", "Months left")}: {monthsLeft}{t("ヶ月", " months")}
                  </p>
                )}
                <div className="h-2 overflow-hidden rounded-full bg-slate-700">
                  <div className={`h-2 rounded-full transition-all ${done ? "bg-emerald-500" : "bg-violet-500"}`} style={{ width: `${Math.max(0, Math.min(100, paidRate))}%` }} />
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {t("返済率", "Paid")}: {Math.max(0, Math.min(100, paidRate))}%{debt.interestRate > 0 ? ` / ${t("年利", "APR")} ${debt.interestRate}%` : ""}
                </p>
              </div>
            );
          })}

          {showDebtForm ? (
            <div className="space-y-2 rounded-xl border border-violet-700/40 bg-slate-800/60 p-3">
              <p className="text-xs font-semibold text-slate-200">{editDebtId ? t("ローンを編集", "Edit loan") : t("ローンを追加", "Add loan")}</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={t("名前", "Name")}
                  value={debtForm.name}
                  onChange={(event) => setDebtForm((form) => ({ ...form, name: event.target.value }))}
                  className="col-span-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
                <select
                  value={debtForm.type}
                  onChange={(event) => setDebtForm((form) => ({ ...form, type: event.target.value as Debt["type"] }))}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                >
                  <option value="loan">{t("ローン", "Loan")}</option>
                  <option value="mortgage">{t("住宅ローン", "Mortgage")}</option>
                  <option value="credit">{t("クレジット", "Credit")}</option>
                  <option value="other">{t("その他", "Other")}</option>
                </select>
                <input
                  type="number"
                  placeholder={t("年利(%)", "APR (%)")}
                  value={debtForm.interestRate || ""}
                  onChange={(event) => setDebtForm((form) => ({ ...form, interestRate: Number(event.target.value) }))}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder={t("借入総額", "Original amount")}
                  value={debtForm.totalAmount || ""}
                  onChange={(event) => setDebtForm((form) => ({ ...form, totalAmount: Number(event.target.value) }))}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder={t("現在の残高", "Current balance")}
                  value={debtForm.remainingAmount || ""}
                  onChange={(event) => setDebtForm((form) => ({ ...form, remainingAmount: Number(event.target.value) }))}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder={t("月返済額", "Monthly payment")}
                  value={debtForm.monthlyPayment || ""}
                  onChange={(event) => setDebtForm((form) => ({ ...form, monthlyPayment: Number(event.target.value) }))}
                  className="col-span-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder={t("メモ", "Memo")}
                  value={debtForm.memo}
                  onChange={(event) => setDebtForm((form) => ({ ...form, memo: event.target.value }))}
                  className="col-span-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={submitDebt} disabled={!debtForm.name.trim()} className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-medium transition-all hover:bg-violet-500 disabled:opacity-40">
                  {editDebtId ? t("更新", "Update") : t("追加", "Add")}
                </button>
                <button type="button" onClick={() => { setShowDebtForm(false); setEditDebtId(null); }} className="rounded-lg bg-slate-700 px-4 py-2 text-sm transition-all hover:bg-slate-600">
                  {t("キャンセル", "Cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowDebtForm(true)} className="w-full rounded-xl border border-dashed border-slate-500/90 bg-slate-950/70 py-2 text-sm font-semibold text-slate-100 transition-all hover:border-violet-400 hover:text-white">
              {t("ローンを追加", "Add loan")}
            </button>
          )}
        </div>
      )}

      {tab === "sinking" && (
        <div className="flex flex-col gap-2">
          {activeSinkingFunds.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2 text-center">
                <p className="text-[10px] text-slate-400">{t("目標合計", "Targets")}</p>
                <p className="text-sm font-bold text-emerald-300">{formatCurrency(activeSinkingFunds.reduce((sum, fund) => sum + fund.targetAmount, 0))}</p>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2 text-center">
                <p className="text-[10px] text-slate-400">{t("積立済み", "Saved")}</p>
                <p className="text-sm font-bold text-sky-300">{formatCurrency(activeSinkingFunds.reduce((sum, fund) => sum + fund.currentAmount, 0))}</p>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2 text-center">
                <p className="text-[10px] text-slate-400">{t("達成", "Done")}</p>
                <p className="text-sm font-bold text-violet-300">{activeSinkingFunds.filter(isTargetComplete).length} / {activeSinkingFunds.length}</p>
              </div>
            </div>
          )}

          {activeSinkingFunds.length === 0 && !showSinkingForm && (
            <div className="rounded-xl border border-slate-600/80 bg-slate-900/80 px-4 py-8 text-center text-sm text-slate-200">
              <p className="font-semibold text-slate-200">{t("先取積み立てはまだありません", "No sinking funds yet")}</p>
              <p className="mt-1 text-xs text-slate-100">{t("旅行・車検・家電など、予定支出の積立を残せます。", "Keep savings plans for travel, maintenance, appliances, and planned costs.")}</p>
            </div>
          )}

          {activeSinkingFunds.map((fund) => (
            <SinkingFundItem
              key={fund.id}
              fund={fund}
              onAdd={addToSinkingFund}
              onArchive={archiveSinkingFund}
              onEdit={editSinkingFund}
              onDelete={deleteSinkingFund}
            />
          ))}

          {archivedSinkingFunds.length > 0 && (
            <details className="rounded-xl border border-slate-700/50 bg-slate-800/50">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-100">
                {t("過去の先取積み立て", "Past sinking funds")} ({archivedSinkingFunds.length})
              </summary>
              <div className="space-y-2 border-t border-slate-700/60 p-3">
                {archivedSinkingFunds.map((fund) => (
                  <div key={fund.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-900 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-200">
                        {fund.emoji} {fund.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {formatCurrency(fund.currentAmount)} / {formatCurrency(fund.targetAmount)}
                        {fund.archivedAt ? ` / ${t("過去化", "Archived")}: ${fund.archivedAt}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => restoreSinkingFund(fund.id)} className="rounded-lg border border-violet-700/40 px-2 py-1 text-[10px] text-violet-200 transition-colors hover:bg-violet-700/30">
                        {t("戻す", "Restore")}
                      </button>
                      <button type="button" onClick={() => deleteSinkingFund(fund.id)} className="rounded-lg px-2 py-1 text-[10px] text-red-300 transition-colors hover:text-red-100">
                        {t("削除", "Delete")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {showSinkingForm ? (
            <div className="space-y-2 rounded-xl border border-violet-700/40 bg-slate-800/60 p-3">
              <p className="text-xs font-semibold text-slate-200">{editSinkingId ? t("先取積み立てを編集", "Edit sinking fund") : t("先取積み立てを追加", "Add sinking fund")}</p>
              <div className="flex flex-wrap gap-1">
                {sinkingEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSinkingForm((form) => ({ ...form, emoji }))}
                    className={`h-9 w-9 rounded-lg text-base ${sinkingForm.emoji === emoji ? "bg-violet-600" : "bg-slate-800 hover:bg-slate-700"}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={t("名前", "Name")}
                  value={sinkingForm.name}
                  onChange={(event) => setSinkingForm((form) => ({ ...form, name: event.target.value }))}
                  className="col-span-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder={t("目標金額", "Target amount")}
                  value={sinkingForm.targetAmount || ""}
                  onChange={(event) => setSinkingForm((form) => ({ ...form, targetAmount: Number(event.target.value) }))}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder={t("現在額", "Current amount")}
                  value={sinkingForm.currentAmount || ""}
                  onChange={(event) => setSinkingForm((form) => ({ ...form, currentAmount: Number(event.target.value) }))}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="month"
                  value={sinkingForm.targetDate}
                  onChange={(event) => setSinkingForm((form) => ({ ...form, targetDate: event.target.value || form.targetDate }))}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder={t("メモ", "Memo")}
                  value={sinkingForm.memo}
                  onChange={(event) => setSinkingForm((form) => ({ ...form, memo: event.target.value }))}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={submitSinkingFund} disabled={!sinkingForm.name.trim()} className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-medium transition-all hover:bg-violet-500 disabled:opacity-40">
                  {editSinkingId ? t("更新", "Update") : t("追加", "Add")}
                </button>
                <button type="button" onClick={() => { setShowSinkingForm(false); setEditSinkingId(null); }} className="rounded-lg bg-slate-700 px-4 py-2 text-sm transition-all hover:bg-slate-600">
                  {t("キャンセル", "Cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowSinkingForm(true)} className="w-full rounded-xl border border-dashed border-slate-500/90 bg-slate-950/70 py-2 text-sm font-semibold text-slate-100 transition-all hover:border-violet-400 hover:text-white">
              {t("先取積み立てを追加", "Add sinking fund")}
            </button>
          )}
        </div>
      )}

      {tab === "goals" && (
        <div className="flex flex-col gap-2">
          <div className="rounded-xl border border-violet-700/40 bg-violet-950/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-200">{t("推し活チケット", "Goal tickets")}</p>
                <p className="mt-1 text-[10px] text-slate-400">{t("徳ポイント100ごとに1枚。目標に加算できます。", "Earn 1 ticket per 100 virtue points and apply it to a goal.")}</p>
              </div>
              <p className="shrink-0 text-2xl font-black text-violet-200">{ticketsAvailable}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
              <span>{t("獲得", "Earned")} {ticketsEarned}</span>
              <span>{t("使用済み", "Used")} {ticketsUsed}</span>
              <label className="flex items-center gap-1">
                <span>{t("1枚", "1 ticket")}=</span>
                <input
                  type="number"
                  value={ticketValue}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (value > 0) {
                      setTicketValue(value);
                      save(KEY_TICKET_VALUE, value);
                    }
                  }}
                  className="h-7 w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-right text-xs text-violet-200 focus:outline-none"
                />
              </label>
            </div>
          </div>

          {activeGoals.length === 0 && !showGoalForm && (
            <div className="rounded-xl border border-slate-600/80 bg-slate-900/80 px-4 py-8 text-center text-sm text-slate-200">
              <p className="font-semibold text-slate-200">{t("個人目標はまだありません", "No personal goals yet")}</p>
              <p className="mt-1 text-xs text-slate-100">{t("ライブ・美容・趣味など、楽しみのための貯金を残せます。", "Keep savings goals for concerts, beauty, hobbies, and personal joys.")}</p>
            </div>
          )}

          {activeGoals.map((goal) => (
            <GoalItem
              key={goal.id}
              goal={goal}
              ticketsAvailable={ticketsAvailable}
              ticketValue={ticketValue}
              onAddManual={addManualToGoal}
              onUseTicket={useTicketOnGoal}
              onArchive={archiveGoal}
              onEdit={editGoal}
              onDelete={deleteGoal}
            />
          ))}

          {archivedGoals.length > 0 && (
            <details className="rounded-xl border border-slate-700/50 bg-slate-800/50">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-100">
                {t("過去の個人目標", "Past personal goals")} ({archivedGoals.length})
              </summary>
              <div className="space-y-2 border-t border-slate-700/60 p-3">
                {archivedGoals.map((goal) => (
                  <div key={goal.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-900 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-200">
                        {goal.emoji} {goal.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {formatCurrency(goal.currentAmount)} / {goal.targetAmount > 0 ? formatCurrency(goal.targetAmount) : t("未設定", "Not set")}
                        {goal.archivedAt ? ` / ${t("過去化", "Archived")}: ${goal.archivedAt}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => restoreGoal(goal.id)} className="rounded-lg border border-violet-700/40 px-2 py-1 text-[10px] text-violet-200 transition-colors hover:bg-violet-700/30">
                        {t("戻す", "Restore")}
                      </button>
                      <button type="button" onClick={() => deleteGoal(goal.id)} className="rounded-lg px-2 py-1 text-[10px] text-red-300 transition-colors hover:text-red-100">
                        {t("削除", "Delete")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {showGoalForm ? (
            <div className="space-y-2 rounded-xl border border-violet-700/40 bg-slate-800/60 p-3">
              <p className="text-xs font-semibold text-slate-200">{editGoalId ? t("個人目標を編集", "Edit goal") : t("個人目標を追加", "Add goal")}</p>
              <div className="flex flex-wrap gap-1">
                {goalEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setGoalForm((form) => ({ ...form, emoji }))}
                    className={`h-9 w-9 rounded-lg text-base ${goalForm.emoji === emoji ? "bg-violet-600" : "bg-slate-800 hover:bg-slate-700"}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={t("目標名", "Goal name")}
                  value={goalForm.name}
                  onChange={(event) => setGoalForm((form) => ({ ...form, name: event.target.value }))}
                  className="col-span-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder={t("目標金額", "Target amount")}
                  value={goalForm.targetAmount || ""}
                  onChange={(event) => setGoalForm((form) => ({ ...form, targetAmount: Number(event.target.value) }))}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder={t("現在額", "Current amount")}
                  value={goalForm.currentAmount || ""}
                  onChange={(event) => setGoalForm((form) => ({ ...form, currentAmount: Number(event.target.value) }))}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder={t("メモ", "Memo")}
                  value={goalForm.memo}
                  onChange={(event) => setGoalForm((form) => ({ ...form, memo: event.target.value }))}
                  className="col-span-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={submitGoal} disabled={!goalForm.name.trim()} className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-medium transition-all hover:bg-violet-500 disabled:opacity-40">
                  {editGoalId ? t("更新", "Update") : t("追加", "Add")}
                </button>
                <button type="button" onClick={() => { setShowGoalForm(false); setEditGoalId(null); }} className="rounded-lg bg-slate-700 px-4 py-2 text-sm transition-all hover:bg-slate-600">
                  {t("キャンセル", "Cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowGoalForm(true)} className="w-full rounded-xl border border-dashed border-slate-500/90 bg-slate-950/70 py-2 text-sm font-semibold text-slate-100 transition-all hover:border-violet-400 hover:text-white">
              {t("個人目標を追加", "Add personal goal")}
            </button>
          )}
        </div>
      )}

      {tab === "fixedCostFlags" && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2 text-center">
              <p className="text-[10px] text-slate-400">{t("未確認", "Open")}</p>
              <p className="text-sm font-bold text-rose-300">{openFixedCostFlags.length}</p>
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2 text-center">
              <p className="text-[10px] text-slate-400">{t("月額候補", "Monthly")}</p>
              <p className="text-sm font-bold text-amber-300">{formatCurrency(monthlyFlagTotal)}</p>
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2 text-center">
              <p className="text-[10px] text-slate-400">{t("確認済み", "Reviewed")}</p>
              <p className="text-sm font-bold text-emerald-300">{fixedCostFlags.filter((flag) => flag.reviewed).length}</p>
            </div>
          </div>

          {hiddenFixedCostFlagsThisMonth > 0 && (
            <button
              type="button"
              onClick={restoreHiddenFixedCostFlagsThisMonth}
              className="rounded-xl border border-slate-600 bg-slate-800/60 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-violet-500 hover:text-violet-200"
            >
              {t(`今月の非表示 ${hiddenFixedCostFlagsThisMonth} 件を戻す`, `Restore ${hiddenFixedCostFlagsThisMonth} hidden this month`)}
            </button>
          )}

          {fixedCostFlags.length === 0 ? (
            <div className="rounded-xl border border-slate-600/80 bg-slate-900/80 px-4 py-8 text-center text-sm text-slate-200">
              <p className="font-semibold text-slate-200">{t("今月の固定費フラグはありません", "No fixed cost flags this month")}</p>
              <p className="mt-1 text-xs text-slate-100">{t("固定費またはサブスクを入力すると、ここに解約・見直し候補が出ます。", "Enter fixed costs or subscriptions to see cancellation and review candidates here.")}</p>
            </div>
          ) : (
            fixedCostFlags.map((flag) => (
              <FixedCostFlagItem key={flag.id} flag={flag} onHide={hideFixedCostFlag} onToggleReviewed={toggleReviewedFixedCostFlag} />
            ))
          )}
        </div>
      )}

      {tab === "virtue" && (
        <div className="flex flex-col gap-2">
          <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-4 text-center">
            <p className="text-xs font-semibold text-slate-300">{t("累計徳ポイント", "Total virtue points")}</p>
            <p className="mt-1 text-4xl font-black text-amber-200">{virtue.total}</p>
            <p className="mt-1 text-xs text-slate-400">{t("黒字・貯蓄・固定費率で自動計算", "Calculated from surplus, savings, and fixed-cost ratio")}</p>
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-200">{t("ポイント条件", "Point rules")}</p>
            <div className="space-y-1 text-xs text-slate-400">
              {[
                { label: t("貯蓄率20%以上", "Savings rate 20%+"), pts: "+10" },
                { label: t("貯蓄率10%以上", "Savings rate 10%+"), pts: "+5" },
                { label: t("黒字", "Positive balance"), pts: "+5" },
                { label: t("変動費率25%以下", "Variable cost ratio 25% or less"), pts: "+5" },
                { label: t("固定費率35%以下", "Fixed cost ratio 35% or less"), pts: "+3" },
                { label: t("貯蓄・投資あり", "Has savings or investing"), pts: "+2" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded bg-slate-900 px-2 py-1">
                  <span>{item.label}</span>
                  <span className="font-semibold text-amber-300">{item.pts}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-200">{t("月別履歴", "Monthly history")}</p>
            {virtue.byMonth.length === 0 ? (
              <p className="text-xs text-slate-500">{t("取引データがありません", "No transaction data")}</p>
            ) : (
              <div className="max-h-60 space-y-1 overflow-y-auto">
                {[...virtue.byMonth].reverse().map((month) => (
                  <div key={month.ym} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">{month.ym}</span>
                      <span className={`text-sm font-bold ${month.points > 0 ? "text-amber-300" : "text-slate-500"}`}>{month.points}pt</span>
                    </div>
                    {month.reasons.length > 0 && (
                      <p className="mt-0.5 text-[10px] text-slate-500">{month.reasons.join(" / ")}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
