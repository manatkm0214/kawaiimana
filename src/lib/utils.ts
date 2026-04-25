export type TransactionType = "income" | "expense" | "saving" | "investment";

export type TabType = TransactionType | "fixed";

export type NavPage = "dashboard" | "input" | "charts" | "ai" | "report" | "calendar" | "goals";

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: string;
  memo: string;
  payment_method: string;
  is_fixed: boolean;
  date: string;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  month: string;
  created_at: string;
}

export type SurplusAllocation = "saving" | "carryover" | "expense";

export interface BudgetSurplus {
  id: string;
  user_id: string;
  month: string;
  amount: number;
  allocation: SurplusAllocation;
  target_category: string | null;
  note: string;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  currency: string;
  allocation_take_home?: number | null;
  allocation_target_fixed_rate?: number | null;
  allocation_target_variable_rate?: number | null;
  allocation_target_savings_rate?: number | null;
  work_hours_month?: number | null;
  created_at: string;
}

export const PAYMENT_METHODS = [
  "カード",
  "現金",
  "口座振替",
  "QR決済",
  "PayPay",
  "Suica/IC",
  "nanaco",
  "WAON",
  "その他",
] as const;

export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], { ja: string; en: string }> = {
  カード: { ja: "カード", en: "Card" },
  現金: { ja: "現金", en: "Cash" },
  口座振替: { ja: "口座振替", en: "Bank transfer" },
  QR決済: { ja: "QR決済", en: "QR payment" },
  PayPay: { ja: "PayPay", en: "PayPay" },
  "Suica/IC": { ja: "Suica/IC", en: "Suica/IC" },
  nanaco: { ja: "nanaco", en: "nanaco" },
  WAON: { ja: "WAON", en: "WAON" },
  その他: { ja: "その他", en: "Other" },
};

/** チャージ系支払い方法（チャージ額入力を表示する） */
export const CHARGE_PAYMENT_METHODS: ReadonlyArray<string> = ["PayPay", "Suica/IC", "nanaco", "WAON", "QR決済"];

export interface DebitReservation {
  id: string;
  user_id: string;
  amount: number;
  description: string;
  card_name: string;
  category: string;
  month_charged: string;
  debit_month: string;
  is_settled: boolean;
  created_at: string;
}

/** 受動収入として集計するカテゴリ（Dashboard・InputBoard 共通） */
export const PASSIVE_INCOME_CATEGORIES = ["副業", "事業収入", "投資収入", "年金"] as const;

export const CATEGORIES: Record<TransactionType, string[]> = {
  income: [
    "給与",
    "副業",
    "事業収入",
    "投資収入",
    "年金",
    "臨時収入",
    "お祝い",
    "おこづかい",
    "その他",
  ],
  expense: [
    "食費",
    "住居",
    "水道・光熱費",
    "通信費",
    "交通費",
    "医療費",
    "日用品",
    "娯楽",
    "レジャー",
    "趣味",
    "教育",
    "自己投資",
    "保険",
    "税金",
    "交際費",
    "サブスク",
    "ペット",
    "美容・衣服",
    "ゲーム",
    "推し活",
    "寄付・支援",
    "その他",
  ],
  saving: [
    "先取り貯金",
    "積立",
    "生活防衛費",
    "旅行準備",
    "その他",
  ],
  investment: [
    "つみたてNISA",
    "iDeCo",
    "株式",
    "投資信託",
    "暗号資産",
    "不動産",
    "その他",
  ],
};

export const CATEGORY_LABELS: Record<string, { ja: string; en: string }> = {
  給与: { ja: "給与", en: "Salary" },
  副業: { ja: "副業", en: "Side job" },
  事業収入: { ja: "事業収入", en: "Business income" },
  投資収入: { ja: "投資収入", en: "Investment income" },
  年金: { ja: "年金", en: "Pension" },
  臨時収入: { ja: "臨時収入", en: "Extra income" },
  お祝い: { ja: "お祝い", en: "Gift money" },
  おこづかい: { ja: "おこづかい", en: "Allowance" },
  食費: { ja: "食費", en: "Food" },
  住居: { ja: "住居", en: "Housing" },
  "水道・光熱費": { ja: "水道・光熱費", en: "Utilities" },
  通信費: { ja: "通信費", en: "Communication" },
  交通費: { ja: "交通費", en: "Transport" },
  医療費: { ja: "医療費", en: "Medical" },
  日用品: { ja: "日用品", en: "Daily goods" },
  娯楽: { ja: "娯楽", en: "Entertainment" },
  レジャー: { ja: "レジャー", en: "Leisure" },
  趣味: { ja: "趣味", en: "Hobby" },
  教育: { ja: "教育", en: "Education" },
  自己投資: { ja: "自己投資", en: "Self growth" },
  保険: { ja: "保険", en: "Insurance" },
  税金: { ja: "税金", en: "Tax" },
  交際費: { ja: "交際費", en: "Social" },
  サブスク: { ja: "サブスク", en: "Subscriptions" },
  ペット: { ja: "ペット", en: "Pets" },
  "美容・衣服": { ja: "美容・衣服", en: "Beauty / clothes" },
  ゲーム: { ja: "ゲーム", en: "Gaming" },
  推し活: { ja: "推し活", en: "Fandom" },
  "寄付・支援": { ja: "寄付・支援", en: "Donations" },
  先取り貯金: { ja: "先取り貯金", en: "Pay-yourself-first" },
  積立: { ja: "積立", en: "Recurring savings" },
  生活防衛費: { ja: "生活防衛費", en: "Emergency fund" },
  旅行準備: { ja: "旅行準備", en: "Travel fund" },
  つみたてNISA: { ja: "つみたてNISA", en: "NISA" },
  iDeCo: { ja: "iDeCo", en: "iDeCo" },
  株式: { ja: "株式", en: "Stocks" },
  投資信託: { ja: "投資信託", en: "Funds" },
  暗号資産: { ja: "暗号資産", en: "Crypto" },
  不動産: { ja: "不動産", en: "Real estate" },
  その他: { ja: "その他", en: "Other" },
};

export function getCategoryLabel(category: string, lang: "ja" | "en"): string {
  const labels = CATEGORY_LABELS[category];
  if (!labels) return category;
  return lang === "en" ? labels.en : labels.ja;
}

export function getPaymentMethodLabel(method: string, lang: "ja" | "en"): string {
  const labels = PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS];
  if (!labels) return method;
  return lang === "en" ? labels.en : labels.ja;
}

export function formatCurrency(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}${new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 0,
  }).format(Math.abs(value))}円`;
}
