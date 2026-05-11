# かわいい家計簿

個人の資産形成を支援するフルスタック家計管理Webアプリケーションです。
収支記録・予算管理・目標設計・AI分析・周辺店舗検索を単一のダッシュボードに統合しています。

---

## 開発の背景

「お金の不安を、見える化と行動で解消する」をコンセプトに設計しました。
単なる収支記録にとどまらず、ローン返済・先取積み立て・大きな買い物の判断支援まで、家計に関する意思決定を一元的にサポートすることを目指しています。

---

## 主要機能

### 収支・予算管理
- 収支入力・月次集計・カテゴリ別グラフ可視化
- 予算プリセット設定、超過アラート、トレードオフ提案

### 目標設計
- **ローン管理** — 残高・月返済額・完済予定・返済進捗の可視化
- **先取積み立て** — 旅行・車検・家電など予定支出の計画的積み立て
- **個人目標** — ご褒美・推し活などの目標管理
- **固定費見直し** — 月次固定費候補のレビューと確認済み管理
- **徳ポイント** — 節約行動を可視化するポイントシステム

### AI機能
- 月次AI分析レポート（支出傾向・改善提案）
- AIチャット相談・AI節約アドバイス
- 位置情報連動のAI店案内

### 購入アドバイザー
- 大きな買い物を「労働日数」「貯蓄月数」「ローン返済可否」で多角的に評価
- 個人目標への追加連携

### その他
- Google / LINE / メール認証（Auth0）
- Google Maps優先 / OpenStreetMapフォールバックの周辺店舗検索
- PDF出力・問い合わせフォーム

---

## 技術スタック

| 分類 | 技術 |
|------|------|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| UI | React 18 / Tailwind CSS 4 |
| 認証 | Auth0 |
| データベース | Supabase (PostgreSQL) |
| AI | Google Gemini 2.5 Flash / OpenAI |
| 地図 | Google Maps API / OpenStreetMap |
| メール | Resend |
| ホスティング | Vercel |

---

## アーキテクチャ

```
クライアント (React / Tailwind CSS)
    │
    ├── Next.js App Router (サーバーコンポーネント / API Routes)
    │       ├── /api/ai         — Gemini / OpenAI 呼び出し
    │       ├── /api/nearby-shops — Google Maps / Overpass API
    │       └── /api/contact    — Resend メール送信
    │
    ├── Supabase (DB / Storage / Auth Hook)
    └── Auth0 (Google / LINE / メール認証)
```

---

## セキュリティ対策

- 全APIルートに同一オリジン検証（`requireSameOrigin`）とレートリミット実装
- シークレット類は環境変数で管理、`.env*` は Git 除外
- Auth0 + Supabase Row Level Security による多層認証・認可
- `npm audit` 脆弱性 0件・TypeScript エラー 0件・ESLint 警告 0件（2026-04-27 時点）

詳細は [セキュリティチェック報告書](./docs/security-check.md) を参照してください。

---

## ローカル環境構築

```bash
git clone https://sl1nk.com/v06etv4
cd kakeibo-propro1
npm install
cp .env.example .env.local   # 各サービスのキーを設定
npm run dev                  # http://localhost:3000
```

必要な外部サービス: Supabase / Auth0 / Google Cloud / Gemini API / Resend
詳細は [.env.example](./.env.example) を参照してください。

> **デモで試す場合:** デモアカウント（メール＋パスワード）でログインすれば、外部サービスの設定なしに主要機能を確認できます。

---

