"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Budget, Profile, Transaction } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import Dashboard from "@/lib/components/Dashboard";
import WelcomeView from "@/lib/components/WelcomeView";
import AuthView from "@/lib/components/AuthView";
import AccountSettings from "@/lib/components/AccountSettings";
import PresetSetup, { PRESET_CATEGORIES } from "@/lib/components/PresetSetup";
import LaunchSplash from "@/lib/components/LaunchSplash";
import { useCharacterImage } from "@/lib/hooks/useCharacterImage";
import { LANG_KEY, setLang, useLang } from "@/lib/hooks/useLang";

type OnboardingStep = "welcome" | "consent" | "auth";

const GUEST_DISPLAY_NAME_KEY = "kakeibo-guest-display-name";

function buildBoardTitle(displayName: string | null | undefined, lang: "ja" | "en") {
  if (displayName && displayName.trim()) {
    return lang === "en" ? `${displayName}'s Balance` : `${displayName}のBalance`;
  }
  return "Balance";
}

function buildGardenLead(lang: "ja" | "en") {
  return lang === "en"
    ? "A cute daily budget board with pastel ribbons, plush charm, and a soft sweet-room mood."
    : "パステルのリボンやぬいぐるみのやさしさを重ねた、毎日ひらきたくなるかわいい家計ボード。";
}

interface HomeUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  is_anonymous: boolean;
}

const HOUSEHOLD_LOCAL_KEYS = [
  "kakeibo-savings-goal",
  "kakeibo-kids-state",
  "kakeibo-gen-saving-goal",
  "kakeibo-gen-defense-goal",
  "kakeibo-gen-variable-goal",
  "kakeibo-calendar-events",
  "kakeibo-debts",
  "kakeibo-sinking-funds",
  "kakeibo-personal-goals",
  "kakeibo-ticket-value",
  "kakeibo-tickets-used",
  "kakeibo-pantry-items",
  "senior-finance-one-page",
] as const;

const HOUSEHOLD_LOCAL_SAVE_FLAG = "kakeibo-household-local-saved";
function toFriendlyAuthErrorMessage(message: string) {
  if (message.includes("Invalid login credentials")) return "メールアドレスかパスワードが違います。パスワード未登録なら、空欄でメールリンクログインを使ってください。";
  if (message.includes("Email not confirmed")) return "確認メールのリンクを開いてからログインしてください。";
  if (message.includes("User already registered")) return "このメールアドレスは既に登録されています。";
  if (message.includes("email rate limit exceeded")) return "メール送信が混み合っています。少し待ってからもう一度お試しください。";
  return message;
}

function PrivacyTermsDialog({ onAgree, onBack }: { onAgree: () => void; onBack?: () => void }) {
  const lang = useLang();
  const [checked, setChecked] = useState(false);

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center bg-slate-950 p-4">
      <div className="hero-stage w-full max-w-md rounded-[30px] p-6">
        <div className="hero-badge px-3 py-1.5 text-xs font-semibold tracking-[0.24em]">
          {lang === "en" ? "CHECK" : "確認"}
        </div>
        <h2 className="hero-title mt-4 text-xl font-bold">{lang === "en" ? "Before you continue" : "利用前の確認"}</h2>
        <p className="hero-copy mt-3 text-sm leading-6">
          {lang === "en"
            ? "Every login requires your agreement to the Terms of Service and Privacy Policy before you continue."
            : "すべてのログイン方法で、続ける前に利用規約とプライバシーポリシーへの同意が必要です。"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link href="/terms" className="app-chip">
            {lang === "en" ? "Read Terms" : "利用規約を読む"}
          </Link>
          <Link href="/privacy" className="app-chip">
            {lang === "en" ? "Read Privacy" : "プライバシーを読む"}
          </Link>
        </div>
        <label className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-400 bg-white/95 px-4 py-4 text-sm text-slate-800 backdrop-blur">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            className="h-4 w-4 accent-cyan-400"
          />
          {lang === "en" ? "I have reviewed and agree" : "内容を確認して同意しました"}
        </label>
        <button
          type="button"
          disabled={!checked}
          onClick={onAgree}
          className="mt-5 w-full rounded-full bg-[linear-gradient(135deg,#ec4899_0%,#f97316_45%,#38bdf8_100%)] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 border border-slate-500 shadow-lg"
        >
          {lang === "en" ? "Agree and continue" : "同意して進む"}
        </button>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-3 w-full rounded-full border border-slate-400 bg-white/95 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white"
          >
            {lang === "en" ? "Back" : "前のページへ行く"}
          </button>
        )}
      </div>
    </div>
  );
}

function NameSetupDialog({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const lang = useLang();
  const titlePreview = buildBoardTitle(value, lang);

  return (
    <div className="fixed inset-0 z-82 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="hero-stage w-full max-w-lg rounded-4xl p-6">
        <div className="hero-badge px-3 py-1.5 text-xs font-semibold tracking-[0.24em]">
          {lang === "en" ? "NAME" : "名前"}
        </div>
        <h2 className="hero-title mt-4 text-2xl font-black">
          {lang === "en" ? "Set your board name" : "最初に名前を登録"}
        </h2>
        <p className="hero-copy mt-3 text-sm leading-6">
          {lang === "en"
            ? "After agreeing to the terms, set the name you want to show on Balance."
            : "利用規約に同意したあと、Balance に表示する名前を登録します。"}
        </p>

        <label className="mt-5 block text-sm font-bold text-slate-900">
          {lang === "en" ? "Display name" : "表示名"}
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={lang === "en" ? "e.g. Mana" : "例: まな"}
            className="mt-2 w-full rounded-2xl border border-slate-400 bg-white/95 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-pink-600"
          />
        </label>

        <div className="idol-glass mt-4 rounded-3xl px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-pink-800">{lang === "en" ? "Cute Kakeibo Preview" : "かわいい家計簿プレビュー"}</p>
          <p className="mt-2 text-lg font-black text-slate-900">{titlePreview}</p>
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saving || !value.trim()}
          className="idol-cta mt-5 w-full rounded-full px-5 py-3 text-sm font-bold border border-slate-500 shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (lang === "en" ? "Saving..." : "保存中...") : (lang === "en" ? "Save name" : "名前を保存")}
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const lang = useLang();
  const { characterUrl, characterName } = useCharacterImage();

  const [user, setUser] = useState<HomeUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [authNotice, setAuthNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [showAuthView, setShowAuthView] = useState(false);
  const [authPrefillEmail, setAuthPrefillEmail] = useState("");
  const [lineFallbackEmail, setLineFallbackEmail] = useState("");
  const [authOtpEmail, setAuthOtpEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [resettingData, setResettingData] = useState(false);
  const [savingLocalData, setSavingLocalData] = useState(false);
  const [localDataSaved, setLocalDataSaved] = useState(false);
  const [showPresetSetup, setShowPresetSetup] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("welcome");
  const [pendingGuestLogin, setPendingGuestLogin] = useState(false);
  const [pendingDisplayName, setPendingDisplayName] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("kakeibo-splash-seen") !== "1";
  });
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthLabel = useMemo(() => {
    const [year, month] = currentMonth.split("-").map(Number);
    return lang === "en" ? `${year}-${String(month).padStart(2, "0")}` : `${year}年${month}月`;
  }, [currentMonth, lang]);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return currentMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, [currentMonth]);

  const summaryText = useMemo(() => {
    const monthly = transactions.filter((item) => item.date.startsWith(currentMonth));
    const income = monthly.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const expense = monthly.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
    const saving = monthly.filter((item) => item.type === "saving" || item.type === "investment").reduce((sum, item) => sum + item.amount, 0);
    const balance = income - expense - saving;

    if (lang === "en") {
      return `Household Board ${currentMonth}\nIncome: ${formatCurrency(income)}\nExpense: ${formatCurrency(expense)}\nSaving: ${formatCurrency(saving)}\nBalance: ${formatCurrency(balance)}`;
    }

    return `Balance ${monthLabel}\n収入: ${formatCurrency(income)}\n支出: ${formatCurrency(expense)}\n貯蓄: ${formatCurrency(saving)}\n差額: ${formatCurrency(balance)}`;
  }, [currentMonth, lang, monthLabel, transactions]);


  const clearHouseholdLocalState = useCallback(() => {
    if (typeof window === "undefined") return;
    HOUSEHOLD_LOCAL_KEYS.forEach((key) => window.localStorage.removeItem(key));
    window.dispatchEvent(new Event("kakeibo-goals-updated"));
    window.dispatchEvent(new Event("kakeibo-data-updated"));
  }, []);

  const shouldKeepHouseholdLocalState = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(HOUSEHOLD_LOCAL_SAVE_FLAG) === "1";
  }, []);

  const rememberHouseholdLocalState = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HOUSEHOLD_LOCAL_SAVE_FLAG, "1");
    setLocalDataSaved(true);
  }, []);

  const forgetHouseholdLocalState = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(HOUSEHOLD_LOCAL_SAVE_FLAG);
    setLocalDataSaved(false);
  }, []);

  const handleAgreePrivacy = useCallback(() => {
    setAgreedPrivacy(true);
  }, []);

  const openAccountEntrance = useCallback(() => {
    setPendingGuestLogin(false);
    setAgreedPrivacy(false);
    setOnboardingStep("consent");
  }, []);

  const openGuestEntrance = useCallback(() => {
    setPendingGuestLogin(true);
    setAgreedPrivacy(false);
    setOnboardingStep("consent");
  }, []);

  const syncSessionToHome = useCallback(async () => {
    window.location.href = "/auth/login";
  }, []);

  const loadData = useCallback(async () => {
    if (!user || !agreedPrivacy) return;
    setDataLoading(true);
    const response = await fetch("/api/home-data", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.authenticated) {
      setProfile(null);
      setTransactions([]);
      setBudgets([]);
      setDataLoading(false);
      return;
    }

    setProfile(payload.profile ?? null);
    setTransactions(payload.transactions ?? []);
    setBudgets(payload.budgets ?? []);
    setDataLoading(false);
  }, [agreedPrivacy, user]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPendingDisplayName(window.localStorage.getItem(GUEST_DISPLAY_NAME_KEY) || "");
  }, []);

  useEffect(() => {
    setLocalDataSaved(shouldKeepHouseholdLocalState());
  }, [shouldKeepHouseholdLocalState]);

  const guestOnboardingStep: OnboardingStep =
    !user && !agreedPrivacy && onboardingStep === "auth" ? "consent" : onboardingStep;
  const needsNameSetup = Boolean(user && agreedPrivacy && !profile?.display_name?.trim());

  useEffect(() => {
    let notice: { type: "error" | "success"; text: string } | null = null;
    let prefill = "";
    let fallbackEmail = "";

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const errorMessage = params.get("auth_error") || params.get("error_description");
      const successMessage = params.get("auth_success");
      const loginEmail = params.get("login_email");
      const lineFallback = params.get("line_fallback");
      if (errorMessage) {
        notice = { type: "error", text: toFriendlyAuthErrorMessage(decodeURIComponent(errorMessage)) };
      } else if (successMessage) {
        notice = { type: "success", text: decodeURIComponent(successMessage) };
      }
      if (loginEmail) {
        prefill = decodeURIComponent(loginEmail);
      }
      if (lineFallback === "email") {
        fallbackEmail = decodeURIComponent(loginEmail || "");
      }
      if (errorMessage || successMessage || loginEmail || lineFallback) {
        const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
        window.history.replaceState({}, "", cleanUrl);
      }
    }

    void fetch("/api/home-data", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(typeof payload?.error === "string" ? payload.error : "Could not load session");
        }

        if (notice) {
          setAuthNotice(notice);
          openAccountEntrance();
        }

        if (prefill) {
          setAuthPrefillEmail(prefill);
        }

        if (fallbackEmail) {
          setLineFallbackEmail(fallbackEmail);
          setAuthOtpEmail(fallbackEmail);
        }

        if (payload?.authenticated && payload.user) {
          const keepLocalState = shouldKeepHouseholdLocalState();
          setLocalDataSaved(keepLocalState);
          if (!keepLocalState) {
            clearHouseholdLocalState();
          }
          setAgreedPrivacy(true);
          setShowAuthView(false);
          setAuthNotice(notice);
          setUser({
            id: payload.user.supabaseUserId,
            email: payload.user.email,
            name: payload.user.name,
            picture: payload.user.picture,
            is_anonymous: false,
          });
          setProfile(payload.profile ?? null);
          setTransactions(payload.transactions ?? []);
          setBudgets(payload.budgets ?? []);
        } else {
          setUser(null);
        }

        setAuthLoading(false);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Could not load session";
        setAuthNotice({ type: "error", text: toFriendlyAuthErrorMessage(message) });
        openAccountEntrance();
        setUser(null);
        setAuthLoading(false);
      });
    return () => undefined;
  }, [clearHouseholdLocalState, openAccountEntrance, shouldKeepHouseholdLocalState]);

  useEffect(() => {
    if (!lineFallbackEmail) return;
    setAuthOtpEmail(lineFallbackEmail);
    setAuthNotice({
      type: "error",
      text:
        lang === "en"
          ? `LINE auto login could not complete. Continue with the email address ${lineFallbackEmail} from the login screen.`
          : `LINE自動ログインを完了できませんでした。ログイン画面で ${lineFallbackEmail} を使って続けてください。`,
    });
    setLineFallbackEmail("");
    openAccountEntrance();
  }, [lang, lineFallbackEmail, openAccountEntrance]);

  useEffect(() => {
    if (!user || !agreedPrivacy) return;
    void Promise.resolve().then(loadData);
    const refresh = () => void loadData();
    window.addEventListener("kakeibo-data-updated", refresh);
    return () => window.removeEventListener("kakeibo-data-updated", refresh);
  }, [agreedPrivacy, loadData, user]);

  useEffect(() => {
    if (!user || !agreedPrivacy) return;
    if (!pendingDisplayName.trim()) return;
    if (profile?.display_name?.trim()) return;
    if (user.is_anonymous) return;

    let active = true;
    setSavingDisplayName(true);

    void fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: pendingDisplayName.trim(),
        currency: profile?.currency ?? "JPY",
        allocation_take_home: profile?.allocation_take_home ?? null,
        allocation_target_fixed_rate: profile?.allocation_target_fixed_rate ?? null,
        allocation_target_variable_rate: profile?.allocation_target_variable_rate ?? null,
        allocation_target_savings_rate: profile?.allocation_target_savings_rate ?? null,
      }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!active || !response.ok || !payload.profile) return;
        setProfile(payload.profile);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(GUEST_DISPLAY_NAME_KEY);
        }
        setPendingDisplayName("");
      })
      .finally(() => {
        if (active) setSavingDisplayName(false);
      });

    return () => {
      active = false;
    };
  }, [agreedPrivacy, pendingDisplayName, profile, user]);

  function prevMonth() {
    const [year, month] = currentMonth.split("-").map(Number);
    const date = new Date(year, month - 2, 1);
    setCurrentMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }

  function nextMonth() {
    const [year, month] = currentMonth.split("-").map(Number);
    const date = new Date(year, month, 1);
    setCurrentMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }

  function goToday() {
    const now = new Date();
    setCurrentMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  }

  async function handleSignOut() {
    if (!shouldKeepHouseholdLocalState()) {
      clearHouseholdLocalState();
    }
    window.location.href = "/auth/logout";
    setUser(null);
    setProfile(null);
    setTransactions([]);
    setBudgets([]);
    setLocalDataSaved(shouldKeepHouseholdLocalState());
    setAgreedPrivacy(false);
    setShowAuthView(false);
    setOnboardingStep("welcome");
  }

  async function handleGuestLogin() {
    if (!shouldKeepHouseholdLocalState()) {
      clearHouseholdLocalState();
    }
    setUser({
      id: "guest",
      email: "",
      name: lang === "en" ? "Guest" : "ゲスト",
      picture: null,
      is_anonymous: true,
    });
    const guestName =
      (typeof window !== "undefined" ? window.localStorage.getItem(GUEST_DISPLAY_NAME_KEY) : "") || "";
    setProfile(
      guestName.trim()
        ? {
            id: "guest-profile",
            display_name: guestName,
            currency: "JPY",
            created_at: new Date().toISOString(),
            allocation_take_home: null,
            allocation_target_fixed_rate: null,
            allocation_target_variable_rate: null,
            allocation_target_savings_rate: null,
          }
        : null,
    );
    setTransactions([]);
    setBudgets([]);
    setAgreedPrivacy(true);
    setPendingGuestLogin(false);
    setShowAuthView(false);
    setAuthNotice({
      type: "success",
      text: lang === "en" ? "Guest mode is available as a preview. Some cloud features may be limited." : "ゲストモードでプレビュー利用できます。一部のクラウド保存機能は制限されます。",
    });
  }

  async function handleSaveLocalData() {
    setSavingLocalData(true);
    rememberHouseholdLocalState();
    setAuthNotice({
      type: "success",
      text:
        lang === "en"
          ? "Current local goals and personal data on this device will be kept for your next login."
          : "この端末の目標や個人データは、次回ログインでも残るように保存しました。",
    });
    setSavingLocalData(false);
  }

  async function handleResetData() {
    if (!user || typeof window === "undefined") return;

    const confirmed = window.confirm(
      lang === "en"
        ? "Reset all household data for this account? Transactions, budgets, and saved goals on this device will be cleared."
        : "このアカウントの家計データをリセットしますか？ 取引、予算、この端末に保存された目標データが消えます。",
    );

    if (!confirmed) return;

    setResettingData(true);
    setAuthNotice(null);

    const response = await fetch("/api/reset-data", { method: "POST" });
    const payload = await response.json();

    if (!response.ok) {
      setResettingData(false);
      setAuthNotice({
        type: "error",
        text:
          lang === "en"
            ? `Could not reset data: ${payload?.error ?? "Unknown error"}`
            : `データのリセットに失敗しました: ${payload?.error ?? "不明なエラー"}`,
      });
      return;
    }

    clearHouseholdLocalState();
    forgetHouseholdLocalState();

    setTransactions([]);
    setBudgets([]);
    setProfile((current) =>
      current
        ? {
            ...current,
            allocation_take_home: null,
            allocation_target_fixed_rate: null,
            allocation_target_variable_rate: null,
            allocation_target_savings_rate: null,
          }
        : null,
    );
    setResettingData(false);
    setAuthNotice({
      type: "success",
      text: lang === "en" ? "Your household data was reset." : "家計データをリセットしました。",
    });
  }

  async function exportCSV() {
    const rows = transactions.map((item) => [
      item.date,
      item.type,
      item.category,
      item.amount,
      item.payment_method,
      item.memo,
      item.is_fixed ? "fixed" : "",
    ]);
    const header = ["date", "type", "category", "amount", "payment", "memo", "fixed"];
    const csv = [header, ...rows].map((line) => line.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kakeibo-${currentMonth}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Balance", text: summaryText, url: window.location.href });
        return;
      }

      await navigator.clipboard.writeText(`${summaryText}\n${window.location.href}`);
      alert(lang === "en" ? "Copied to clipboard." : "クリップボードにコピーしました。");
    } catch {
      alert(lang === "en" ? "Share failed." : "共有に失敗しました。");
    }
  }

  async function generateFixedCosts() {
    const response = await fetch("/api/fixed-costs", { method: "POST" });
    const data = await response.json();
    alert(data.message);
    await loadData();
  }

  async function savePresetToBoard(result: { profile: Profile; categoryRatios: number[]; goals?: { monthlySavingsGoal: number; payYourselfFirstGoal: number; defenseMonths: number; passiveIncomeGoal: number; targetVariableRate: number } }) {
    if (!user) return;
    const takeHome = result.profile.allocation_take_home ?? 0;
    const response = await fetch("/api/preset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentMonth,
        profile: result.profile,
        categoryRatios: result.categoryRatios,
        categories: PRESET_CATEGORIES,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setAuthNotice({
        type: "error",
        text: lang === "en" ? `Could not apply preset: ${payload?.error ?? "Unknown error"}` : `プリセット反映に失敗しました: ${payload?.error ?? "不明なエラー"}`,
      });
      return;
    }

    if (typeof window !== "undefined") {
      const savingsGoal = result.goals?.monthlySavingsGoal ?? Math.round((takeHome * (result.profile.allocation_target_savings_rate ?? 0)) / 100);
      const payYourselfFirstGoal = result.goals?.payYourselfFirstGoal ?? savingsGoal;
      const variableGoal = result.goals?.targetVariableRate != null ? Math.round((takeHome * result.goals.targetVariableRate) / 100) : 0;
      const defenseGoal = result.goals?.defenseMonths != null
        ? Math.round((takeHome * ((result.profile.allocation_target_fixed_rate ?? 0) + (result.profile.allocation_target_variable_rate ?? 0)) / 100) * result.goals.defenseMonths)
        : 0;
      const passiveIncomeGoal = result.goals?.passiveIncomeGoal ?? 0;
      window.localStorage.setItem("kakeibo-savings-goal", String(savingsGoal));
      window.localStorage.setItem("kakeibo-gen-saving-goal", String(payYourselfFirstGoal));
      if (variableGoal > 0) window.localStorage.setItem("kakeibo-gen-variable-goal", String(variableGoal));
      if (defenseGoal > 0) window.localStorage.setItem("kakeibo-gen-defense-goal", String(defenseGoal));
      if (passiveIncomeGoal > 0) window.localStorage.setItem("kakeibo-gen-passive-income-goal", String(passiveIncomeGoal));
      window.dispatchEvent(new Event("kakeibo-goals-updated"));
    }

    await loadData();
    setShowPresetSetup(false);
  }

  async function handleSaveDisplayName() {
    const trimmed = pendingDisplayName.trim();
    if (!trimmed) return;

    setSavingDisplayName(true);

    try {
      if (user?.is_anonymous) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(GUEST_DISPLAY_NAME_KEY, trimmed);
        }
        setProfile((current) => ({
          id: current?.id ?? "guest-profile",
          display_name: trimmed,
          currency: current?.currency ?? "JPY",
          created_at: current?.created_at ?? new Date().toISOString(),
          allocation_take_home: current?.allocation_take_home ?? null,
          allocation_target_fixed_rate: current?.allocation_target_fixed_rate ?? null,
          allocation_target_variable_rate: current?.allocation_target_variable_rate ?? null,
          allocation_target_savings_rate: current?.allocation_target_savings_rate ?? null,
        }));
        return;
      }

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: trimmed,
          currency: profile?.currency ?? "JPY",
          allocation_take_home: profile?.allocation_take_home ?? null,
          allocation_target_fixed_rate: profile?.allocation_target_fixed_rate ?? null,
          allocation_target_variable_rate: profile?.allocation_target_variable_rate ?? null,
          allocation_target_savings_rate: profile?.allocation_target_savings_rate ?? null,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.profile) {
        setAuthNotice({
          type: "error",
          text: lang === "en" ? "Could not save your display name." : "表示名の保存に失敗しました。",
        });
        return;
      }
      setProfile(payload.profile);
    } finally {
      setSavingDisplayName(false);
    }
  }

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-full border border-slate-700 bg-slate-900 p-1">
        {([
          { code: "ja", label: "JA" },
          { code: "en", label: "EN" },
        ] as const).map((option) => (
          <button
            key={option.code}
            type="button"
            onClick={() => {
              setLang(option.code);
              if (typeof window !== "undefined") {
                window.localStorage.setItem(LANG_KEY, option.code);
              }
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              lang === option.code ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:text-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button type="button" onClick={handleShare} className="app-chip">{lang === "en" ? "Share" : "共有"}</button>
      <button type="button" onClick={() => window.print()} className="app-chip">{lang === "en" ? "Print" : "印刷"}</button>
      <button type="button" onClick={exportCSV} className="app-chip">CSV</button>
<Link href="/settings" className="app-chip">{lang === "en" ? "Settings" : "設定"}</Link>
      <button type="button" onClick={() => setShowAccountSettings(true)} className="app-chip">{lang === "en" ? "Account" : "アカウント"}</button>
    </div>
  );

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-slate-300">
        <div className="rounded-4xl border border-slate-700 bg-slate-900 px-6 py-5 text-sm shadow-2xl shadow-slate-950/30">
          {lang === "en" ? "Loading your board..." : "ボードを読み込んでいます..."}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen px-4 py-6 md:px-6">
        {showSplash && (
          <LaunchSplash
            onDone={() => {
              window.sessionStorage.setItem("kakeibo-splash-seen", "1");
              setShowSplash(false);
            }}
          />
        )}
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <header
            className="garden-stage sparkle-card relative overflow-hidden rounded-[40px] px-5 py-7 md:px-8"
          >
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <div className="absolute inset-3 rounded-[34px] border border-white/45" />
              <div className="absolute inset-x-[12%] -bottom-30 h-52 rounded-full bg-[radial-gradient(circle,rgba(125,211,252,0.52)_0%,rgba(186,230,253,0.3)_30%,rgba(255,255,255,0)_74%)] blur-2xl" />
              <div className="absolute left-[6%] top-[18%] text-2xl text-rose-300/80 animate-float-slow">♡</div>
              <div className="absolute left-[14%] top-[10%] text-3xl text-fuchsia-300/75 animate-float-slow" style={{ animationDelay: "0.4s" }}>✦</div>
              <div className="absolute right-[14%] top-[12%] text-2xl text-sky-300/80 animate-float-slow" style={{ animationDelay: "0.7s" }}>🎀</div>
              <div className="absolute right-[7%] top-[18%] text-3xl text-amber-300/80 animate-float-slow" style={{ animationDelay: "1.1s" }}>✿</div>
              <div className="absolute bottom-[18%] left-[8%] text-2xl text-pink-300/90 animate-float-slow" style={{ animationDelay: "0.9s" }}>🌸</div>
              <div className="absolute bottom-[22%] right-[10%] text-2xl text-violet-300/85 animate-float-slow" style={{ animationDelay: "0.6s" }}>🧸</div>
              <div className="absolute right-[20%] bottom-[30%] text-3xl text-cyan-300/75 animate-float-slow" style={{ animationDelay: "1.3s" }}>🫧</div>
              <div className="absolute left-[19%] bottom-[28%] text-lg text-rose-400/80 animate-float-slow" style={{ animationDelay: "0.5s" }}>✦</div>
            </div>
            <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl">
                <p className="hero-badge w-fit px-3 py-1.5 text-xs font-bold uppercase tracking-[0.36em]">
                  ✦KAKEIBO ✦
                </p>
                <div className="mt-4">
                  <p className="garden-kicker">Balance</p>
                  <h1 className="garden-title mt-1 text-3xl font-black md:text-5xl">
                    {lang === "en" ? "Cute Kakeibo" : "かわいい家計簿"}
                  </h1>
                  <p className="garden-copy mt-3 text-base font-semibold md:text-lg">
                    {lang === "en" ? "A sweet balance board you'll want to open every day." : "毎日ひらきたくなる ふわかわ家計ボード"}
                  </p>
                  <p className="garden-separator mt-4 text-sm font-bold tracking-[0.42em]">
                    🎀 ✦ 🧸 ✦ 🎀
                  </p>
                  <p className="garden-note mt-4 max-w-2xl text-sm leading-7 md:text-base">
                    {buildGardenLead(lang)}
                  </p>
                </div>
              </div>
              <div className="relative z-10 flex flex-col items-start gap-3 md:items-end">
                <div className="garden-mini-card max-w-sm rounded-[28px] px-4 py-4 text-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-rose-700/80">
                    {lang === "en" ? "Cute Mood" : "Cute Mood"}
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                    {lang === "en"
                      ? "Start in a soft pastel room with ribbons and plush accents, then move into login and your board."
                      : "はじめる前から、リボンやぬいぐるみの空気を感じるやさしいデザインで世界観に入れるようにしました。"}
                  </p>
                </div>
                {controls}
              </div>
            </div>
          </header>

          <footer className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-slate-500">
            <Link href="/privacy" className="hover:text-slate-300 transition">{lang === "en" ? "Privacy Policy" : "プライバシーポリシー"}</Link>
            <Link href="/terms" className="hover:text-slate-300 transition">{lang === "en" ? "Terms of Service" : "利用規約"}</Link>
            <Link href="/contact" className="hover:text-slate-300 transition">{lang === "en" ? "Contact" : "お問い合わせ"}</Link>
          </footer>

          {guestOnboardingStep === "welcome" ? (
            <WelcomeView onStartAuth={openAccountEntrance} onStartGuest={openGuestEntrance} />
          ) : guestOnboardingStep === "consent" ? (
            <PrivacyTermsDialog
              onAgree={() => {
                handleAgreePrivacy();
                if (pendingGuestLogin) {
                  void handleGuestLogin();
                } else {
                  setOnboardingStep("auth");
                }
              }}
              onBack={() => {
                setPendingGuestLogin(false);
                setOnboardingStep("welcome");
              }}
            />
          ) : (
            <AuthView
              onAuth={syncSessionToHome}
              onBack={() => setOnboardingStep("welcome")}
              initialMessage={authNotice}
              initialEmail={authPrefillEmail}
              otpEmail={authOtpEmail}
              onGuestLogin={handleGuestLogin}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-5 md:px-6">
      {needsNameSetup && (
        <NameSetupDialog
          value={pendingDisplayName}
          onChange={setPendingDisplayName}
          onSave={handleSaveDisplayName}
          saving={savingDisplayName}
        />
      )}

      {showAuthView && (
        <div className="fixed inset-0 z-70 overflow-y-auto bg-slate-950 p-4">
          <div className="mx-auto max-w-3xl">
            <AuthView
              onAuth={syncSessionToHome}
              onBack={() => setShowAuthView(false)}
              initialMessage={authNotice}
              initialEmail={authPrefillEmail}
              otpEmail={authOtpEmail}
              onGuestLogin={handleGuestLogin}
            />
          </div>
        </div>
      )}

      {showPresetSetup && (
        <div className="fixed inset-0 z-75 overflow-y-auto bg-slate-950 p-4">
          <div className="mx-auto max-w-5xl">
            <PresetSetup
              mode={profile ? "edit" : "create"}
              onCancel={() => setShowPresetSetup(false)}
              onComplete={savePresetToBoard}
            />
          </div>
        </div>
      )}

      {showAccountSettings && user && (
        <div className="fixed inset-0 z-76 overflow-y-auto bg-slate-950 p-4">
          <AccountSettings
            user={user}
            profile={profile}
            onClose={() => setShowAccountSettings(false)}
            onProfileUpdated={(nextProfile) => {
              setProfile(nextProfile);
              void loadData();
            }}
          />
        </div>
      )}

      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        {authNotice && (
          <div className={`rounded-3xl px-4 py-3 text-sm ${authNotice.type === "success" ? "border border-emerald-800 bg-emerald-950 text-emerald-100" : "border border-rose-800 bg-rose-950 text-rose-100"}`}>
            {authNotice.text}
          </div>
        )}

        {typeof characterUrl === "string" && characterUrl && (
          <div className="pointer-events-none fixed bottom-5 left-5 z-20 hidden md:block">
            <div className="animate-float-slow rounded-full border border-slate-700 bg-slate-900 p-1 shadow-2xl shadow-slate-950/40">
              <Image
                src={characterUrl}
                alt={characterName || (lang === "en" ? "Character image" : "キャラクター画像")}
                width={72}
                height={72}
                className="h-16 w-16 rounded-full object-cover"
                unoptimized
              />
            </div>
          </div>
        )}

        {user.is_anonymous && (
          <div className="rounded-[28px] border border-amber-400/25 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p>{lang === "en" ? "You are using a temporary guest account. Move to Account to register and keep your data." : "いまは一時的なゲスト利用です。アカウントへ進むと登録してデータを残せます。"}</p>
              <button type="button" onClick={() => setShowAuthView(true)} className="rounded-full bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200">
                {lang === "en" ? "Go to Account" : "アカウントへ"}
              </button>
            </div>
          </div>
        )}

        <header className="garden-stage sparkle-card rounded-[40px] px-5 py-6 md:px-7">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="hero-badge px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.28em]">✦KAKEIBO ✦</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div>
                  <p className="garden-kicker text-sm">Balance</p>
                  <h1 className="garden-title text-2xl font-black md:text-4xl">
                    {buildBoardTitle(profile?.display_name, lang)}
                  </h1>
                </div>
                <p className="garden-separator text-sm font-bold tracking-[0.34em]">🎀 ✦ 🧸 ✦ 🎀</p>
                <button type="button" onClick={() => setShowPresetSetup(true)} className="rounded-full bg-[linear-gradient(135deg,#ec4899_0%,#f97316_45%,#38bdf8_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(236,72,153,0.22)] transition hover:brightness-105">
                  {lang === "en" ? "Apply preset to board" : "配分プリセットをボードへ反映"}
                </button>
                <button type="button" onClick={handleSignOut} className="app-chip">
                  {lang === "en" ? "Back to start" : "最初のはじめるに戻る"}
                </button>
              </div>
              <p className="garden-copy mt-3 max-w-3xl text-sm md:text-base">
                {lang === "en"
                  ? "Keep your cute board bright with ribbons, plush charm, and your daily balance view."
                  : "リボンやぬいぐるみのかわいさをまとった家計ボードで、毎日のBalanceを見やすく整えます。"}
              </p>
              <p className="garden-note mt-2 max-w-3xl text-sm md:text-base">
                {lang === "en" ? "Navigation stays near the input area so the board feels simple and magical." : "切り替えは入力エリア付近のボードタブに集約し、世界観を保ったまま迷いにくくしています。"}
              </p>
            </div>
            {controls}
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="month-switch-group inline-flex items-center gap-1 rounded-full border border-white/75 bg-white/85 p-1 shadow-[0_14px_34px_rgba(15,23,42,0.08)] backdrop-blur">
              <button type="button" onClick={prevMonth} aria-label={lang === "en" ? "Previous month" : "前の月"} className="month-switch-arrow rounded-full px-3 py-2 text-sm text-slate-700 transition hover:bg-white hover:text-slate-950">‹</button>
              <button
                type="button"
                onClick={goToday}
                className={`month-switch-current rounded-full px-4 py-2 text-sm font-medium transition ${isCurrentMonth ? "bg-[linear-gradient(135deg,#ec4899_0%,#f97316_45%,#38bdf8_100%)] text-white" : "bg-white text-slate-800 hover:bg-slate-50"}`}
              >
                {monthLabel}
              </button>
              <button type="button" onClick={nextMonth} aria-label={lang === "en" ? "Next month" : "次の月"} className="month-switch-arrow rounded-full px-3 py-2 text-sm text-slate-700 transition hover:bg-white hover:text-slate-950">›</button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <button type="button" onClick={generateFixedCosts} className="app-chip">{lang === "en" ? "Generate fixed costs" : "固定費を生成"}</button>
              <button type="button" onClick={handleSaveLocalData} disabled={savingLocalData} className="app-chip disabled:opacity-50">
                {savingLocalData ? (lang === "en" ? "Saving..." : "保存中...") : localDataSaved ? (lang === "en" ? "Saved for next login" : "次回ログイン用に保存済み") : (lang === "en" ? "Save for next login" : "次回ログイン用に保存")}
              </button>
              <button type="button" onClick={handleResetData} disabled={resettingData} className="app-chip disabled:opacity-50">
                {resettingData ? (lang === "en" ? "Resetting..." : "リセット中...") : (lang === "en" ? "Reset data" : "データリセット")}
              </button>
              <Link href="/privacy" className="app-chip">{lang === "en" ? "Privacy" : "プライバシー"}</Link>
              <Link href="/terms" className="app-chip">{lang === "en" ? "Terms" : "利用規約"}</Link>
              <button type="button" onClick={handleSignOut} className="app-chip">{lang === "en" ? "Sign out" : "ログアウト"}</button>
            </div>
          </div>
        </header>

        <main className="app-panel holo-frame rounded-[34px] px-3 py-3 md:px-4 md:py-4">
          {dataLoading ? (
            <div className="flex min-h-105 items-center justify-center text-sm text-slate-300">
              {lang === "en" ? "Refreshing your data..." : "データを更新しています..."}
            </div>
          ) : (
            <Dashboard
              transactions={transactions}
              budgets={budgets}
              currentMonth={currentMonth}
              profile={profile}
            />
          )}
        </main>
      </div>
    </div>
  );
}
