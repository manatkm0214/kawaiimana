# 家計簿アプリ

AI搭載のスマート家計管理アプリ（Next.js + TypeScript + Supabase + Auth0）

**本番URL:** https://manakare.netlify.app

---

## 技術スタック

- **フレームワーク**: Next.js 15 (App Router)
- **言語**: TypeScript
- **スタイル**: Tailwind CSS v4
- **DB**: Supabase (PostgreSQL + RLS)
- **認証**: Auth0（Google / LINE / メール）
- **AI**: Anthropic Claude / Google Gemini
- **デプロイ**: Netlify

---

## ローカル開発

```bash
npm install
npm run dev
# → http://localhost:3000
```

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
```

---

## 認証設定

### Auth0
- Allowed Callback URLs: `https://manakare.netlify.app/auth/callback`
- Allowed Logout URLs: `https://manakare.netlify.app`
- Allowed Web Origins: `https://manakare.netlify.app`

### Google OAuth (Google Cloud Console)
- 承認済みリダイレクトURI: `https://dev-mlg3q0p27ecq1qnh.us.auth0.com/login/callback`

---

## 機能

| 機能 | 説明 |
|------|------|
| 認証 | Google / LINE / メール＋パスワード |
| スマート入力 | 収入・支出・貯金・投資・固定費 |
| AI分析 | Claude / Gemini による家計分析・節約プラン |
| ダッシュボード | 指標・グラフ・予算進捗 |
| 年間レポート | PDF出力対応 |
| 多言語 | 日本語 / 英語 |

---

## 既知の問題

- Next.js 15.5.15 の `generateBuildId` バグ → `patches/next+15.5.15.patch` で対処済み
