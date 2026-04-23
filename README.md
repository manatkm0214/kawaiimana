# Balance — かわいい家計簿

> AI搭載のスマート家計管理アプリ（Next.js 15 + TypeScript + Supabase + Auth0）

**本番URL:** https://manakare.netlify.app

---

## 機能一覧

| カテゴリ | 機能 |
|---|---|
| **認証** | Google / LINE / メール＋パスワード / マジックリンク / ゲストモード |
| **収支入力** | 収入・支出・貯金・投資・固定費の記録、カテゴリ・支払方法・メモ |
| **固定費** | ワンクリックで前月固定費を今月分に一括生成 |
| **ダッシュボード** | 月別収支サマリー・予算進捗・グラフ・カレンダービュー |
| **予算管理** | 配分プリセット（手取り→固定費/変動費/貯蓄率を自動計算）、余剰振り分け、トレードオフ |
| **目標・負債** | 貯蓄目標・緊急資金・ローン残高・世代別ライフゴール |
| **AI分析** | Claude / Gemini による家計分析・節約プラン・AIチャット相談 |
| **年間レポート** | PDF出力対応（jsPDF） |
| **エクスポート** | CSVダウンロード・印刷・SNS共有 |
| **Kids** | 子ども向けお小遣い帳（収入・支出・貯金目標） |
| **シニアモード** | 大きな文字・シンプル表示に切替可能 |
| **カスタマイズ** | UIテーマ・キャラクター画像・背景デザイン |
| **多言語** | 日本語 / 英語（画面上部でいつでも切替） |
| **お問い合わせ** | Resend APIによるメール送信フォーム |

---

## 技術スタック

| レイヤー | 技術 | バージョン |
|---|---|---|
| フレームワーク | Next.js (App Router) | 15.5.15 |
| 言語 | TypeScript | 5.x |
| スタイル | Tailwind CSS | v4 |
| DB | Supabase (PostgreSQL + RLS) | 最新 |
| 認証 | Auth0 | 4.16.x |
| AI（主） | Anthropic Claude SDK | 0.82.x |
| AI（副） | Google Gemini | 0.24.x |
| グラフ | Recharts | 3.x |
| PDF | jsPDF | 4.x |
| メール | Resend | 6.x |
| 国際化 | next-intl | 4.9.x |
| デプロイ | Netlify | — |

---

## アーキテクチャ

```
ブラウザ（React / Tailwind）
    │
    ▼
Netlify Edge（Next.js App Router）
    ├── /app/page.tsx         ホーム・認証フロー
    ├── /app/api/*            REST APIエンドポイント群
    │       ├── home-data     初期データ取得
    │       ├── transactions  収支CRUD
    │       ├── ai / ai/chat  AI分析・チャット（Claude / Gemini）
    │       ├── auth/google   Google OAuth
    │       └── auth/line     LINE Login
    └── /middleware.ts        セキュリティヘッダー・SSRF対策
           │
           ├── Supabase（PostgreSQL）
           │       profiles / transactions / budgets
           │       Row Level Security で自分のデータのみ参照可
           │
           ├── Auth0
           │       Google / LINE OAuth2.0 仲介
           │
           └── AI API
                   Anthropic Claude / Google Gemini（切替可）
```

---

## ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx              ホーム画面（認証・ダッシュボード）
│   ├── layout.tsx            ルートレイアウト
│   ├── api/                  API Routes
│   │   ├── home-data/        初期データ
│   │   ├── transactions/     収支CRUD
│   │   ├── profile/          プロフィール
│   │   ├── preset/           予算プリセット
│   │   ├── fixed-costs/      固定費一括生成
│   │   ├── budget-surplus/   予算余剰
│   │   ├── budget-tradeoff/  予算トレードオフ
│   │   ├── debit-reservations/ 口座引落予約
│   │   ├── ai/               AI分析
│   │   ├── ai/chat/          AIチャット
│   │   ├── auth/google/      Google認証
│   │   ├── auth/line/        LINE認証
│   │   ├── reset-data/       データリセット
│   │   └── contact/          お問い合わせ
│   ├── auth/                 Auth0コールバック・ログアウト
│   ├── dashboard/            ダッシュボードページ
│   ├── settings/             設定ページ
│   ├── privacy/              プライバシーポリシー
│   └── terms/                利用規約
├── lib/
│   ├── components/           再利用コンポーネント
│   ├── hooks/                カスタムHooks
│   ├── supabase/             Supabaseクライアント
│   ├── auth/                 Auth0補助ロジック
│   ├── server/               サーバー専用ロジック（セキュリティ等）
│   └── ai/                   AIプロバイダー切替
└── i18n/                     多言語設定
```

---

## ローカル開発

```bash
npm install
npm run dev
# → http://localhost:3000
```

> **LINE Loginについて:** ローカルでLINEログインを試す場合は `ngrok` 等でhttpsトンネルを作成し、`APP_BASE_URL` を書き換えてください。

---

## 環境変数

`.env.local` に以下を設定：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth0
AUTH0_DOMAIN=dev-mlg3q0p27ecq1qnh.us.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_SECRET=
APP_BASE_URL=http://localhost:3000

# AI
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# LINE
LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=

# メール（お問い合わせ・パスワードリセット）
RESEND_API_KEY=
```

---

## Supabaseセットアップ

Supabase Dashboardの **SQL Editor** で以下のファイルを順番に実行してください：

```bash
# 1. 基本スキーマ（profiles / transactions / budgets テーブル + RLS）
supabase_schema_fixed.sql

# 2. Auth0プロフィール紐付け
supabase_auth0_profile_binding_migration.sql

# 3. 予算余剰機能
supabase_budget_surplus_migration.sql

# 4. 予算トレードオフ機能
supabase_budget_tradeoff_migration.sql

# 5. 口座引落予約機能
supabase_debit_reservations_migration.sql
```

> RLS（Row Level Security）が有効になっており、ユーザーは自分のデータのみアクセスできます。

---

## 認証設定

### Auth0

- **Allowed Callback URLs:** `https://manakare.netlify.app/auth/callback, http://localhost:3000/auth/callback`
- **Allowed Logout URLs:** `https://manakare.netlify.app, http://localhost:3000`
- **Allowed Web Origins:** `https://manakare.netlify.app, http://localhost:3000`

### Google OAuth (Google Cloud Console)

- **承認済みリダイレクトURI:** `https://{AUTH0_DOMAIN}/login/callback`

### LINE Login (LINE Developers)

- **Callback URL:** `https://manakare.netlify.app/api/auth/line/callback`
- Channel IDとChannel Secretを取得し、環境変数に設定

---

## Netlifyデプロイ

`netlify.toml` に設定済み。Gitリポジトリを接続して以下を設定するだけで自動デプロイされます：

1. Netlify Dashboard → **Site configuration > Environment variables** に上記の環境変数を設定
2. **Build command:** `npm run build`（自動検出）
3. **Publish directory:** `.next`（自動検出）

---

## セキュリティ

| 対策 | 実装 |
|---|---|
| 認証 | Auth0 + JWT（HttpOnly Cookie） |
| データ認可 | Supabase RLSでユーザーは自分のデータのみアクセス可 |
| SSRF対策 | `src/lib/server/ssrf.ts` で外部リクエストURLを検証 |
| セキュリティヘッダー | `src/lib/server/security.ts` でCSP・HSTS等を設定 |
| 依存パッケージ | `overrides` でaxios・dompurify・follow-redirectsの脆弱バージョンを強制更新 |

---

## 既知の問題

- **Next.js 15.5.15 の `generateBuildId` バグ:** `null` を返すと型エラーになる問題。`patches/next+15.5.15.patch` で型定義を修正済み。`postinstall` フックにより `npm install` 後に自動適用されます。

---

## ライセンス

Private — All rights reserved.
