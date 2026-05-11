# かわいい家計簿

収支記録・予算管理・目標管理・AI相談・周辺店舗検索を1つにまとめたWebアプリです。

**本番URL:** https://kawaii0214.vercel.app

---

## 機能一覧

- **家計管理** — 収支入力・月次集計・カテゴリ別グラフ可視化
- **予算管理** — プリセット設定・超過アラート・トレードオフ提案
- **目標タブ** — ローン管理・先取積み立て・個人目標・固定費見直し・徳ポイント
- **購入アドバイザー** — 労働日数・貯蓄月数換算による大きな買い物の判断支援
- **AI機能** — 月次AI分析・AIチャット・AI節約相談・AI店案内
- **周辺店舗検索** — Google Maps優先 / OpenStreetMapフォールバック
- **認証** — Google / LINE / メール（Auth0）
- **その他** — PDF出力・問い合わせフォーム・表示カスタマイズ

---

## 技術スタック

| 分類 | 技術 |
|------|------|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| UI | React 18 / Tailwind CSS 4 |
| 認証 | Auth0 |
| データベース | Supabase |
| AI | Google Gemini / OpenAI |
| 地図 | Google Maps API / OpenStreetMap |
| メール | Resend |
| ホスティング | Vercel |

---

## ローカルで動かす

### 1. リポジトリをクローン

```bash
git clone https://github.com/manatkm0214/kakeibo-propro1.git
cd kakeibo-propro1
npm install
```

### 2. 環境変数を設定

```bash
cp .env.example .env.local
```

`.env.local` を開き、各サービスから値を取得して設定してください。

| サービス | 取得場所 | 必要なキー |
|----------|----------|-----------|
| [Supabase](https://supabase.com) | Project Settings → API | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| [Auth0](https://auth0.com) | Applications → 対象アプリ | `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET` |
| [LINE Developers](https://developers.line.biz) | LINE Login チャネル | `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET` |
| [Google Cloud](https://console.cloud.google.com) | APIs & Services → 認証情報 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_MAPS_API_KEY` |
| [Google AI Studio](https://aistudio.google.com) | APIキー | `GEMINI_API_KEY` |
| [Resend](https://resend.com) | API Keys | `RESEND_API_KEY` |

### 3. 開発サーバーを起動

```bash
npm run dev
```

`http://localhost:3000` で確認できます。

> **デモアカウントで試す場合:** 外部サービスの設定なしに、デモ用メール＋パスワードでログインして主要機能を確認できます。

---

## 画面構成

```
/ (ランディング)
└── /dashboard
    ├── 収支タブ       — 入力・集計・グラフ
    ├── 予算タブ       — プリセット・超過確認
    ├── 目標タブ       — ローン・積み立て・個人目標・固定費・徳ポイント
    ├── AI相談タブ     — 分析・チャット・節約相談
    └── お店案内タブ   — 周辺店舗マップ検索
```

---

## ドキュメント

- [仕様書](./docs/specification.md)
- [設計書](./docs/design.md)
- [取り扱い説明書](./docs/user-manual.md)
- [セキュリティチェック報告書](./docs/security-check.md)
