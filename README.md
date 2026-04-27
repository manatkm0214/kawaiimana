# かわいい家計簿

収支記録、予算管理、目標管理、AI 相談、周辺のお店案内を 1 つにまとめた Next.js 製の家計簿アプリです。

本番 URL: `https://kawaii0214.vercel.app`

## アプリ概要

- 家計データの入力、月次集計、カテゴリ可視化
- 予算プリセット、予算超過確認、トレードオフ支援
- 目標タブ内でのローン管理、先取積み立て、個人目標、固定費見直し、徳ポイント管理
- 購入アドバイザーによる大きな買い物判断と個人目標連携
- AI 分析、AI チャット、AI 節約相談、AI 店案内
- Google Maps 優先 / OpenStreetMap フォールバックの周辺店舗検索
- Google / LINE / メール認証
- PDF 出力、問い合わせ、表示カスタマイズ

## 目標タブの構成

ダッシュボードの「目標」周辺は次の 3 レイヤで構成されています。

- `GenerationGoals`: 「個人 / こども / シニア」の世代切替
- `GoalsAndDebt`: 一般向けの詳細管理 UI
- `PurchaseAdvisor`: 価格判断と個人目標への追加

`GoalsAndDebt` では次の 5 タブを扱います。

- ローン / 借入: 残高、月返済、完済予定、返済進捗
- 先取積み立て: 旅行、車検、家電など予定支出の積み立て
- 個人目標: ご褒美や推し活向けの目標管理
- 固定費見直し: 月内の固定費候補をレビュー、確認済み化、月単位で非表示
- 徳ポイント: 月別ポイント履歴、獲得チケット数、チケット価値の調整

## 環境

- Production: `https://kawaii0214.vercel.app`
- Demo / Preview: Vercel Preview Deployment を利用
  - `src/app/dashboard/page.tsx` にはダミーデータで UI を確認できるデモ用ダッシュボード実装があります
  - デモ確認時は preview デプロイ URL または `/dashboard` を利用します

## 技術スタック

| 分類 | 使用技術 |
|------|----------|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| UI | React 18 / Tailwind CSS 4 |
| 認証 | Auth0 |
| データ | Supabase |
| AI | OpenAI / Gemini |
| 地図・店舗検索 | Google Maps API / OpenStreetMap |
| メール | Resend |
| ホスティング | Vercel |

## ローカル開発

```bash
npm install
cp .env.example .env.local
# .env.local に必要な値を設定
npm run dev
```

ローカル URL: `http://localhost:3000`

## 検証コマンド

```bash
npm run build
node ./node_modules/typescript/bin/tsc --noEmit
./node_modules/.bin/eslint.cmd .
```

## デプロイ運用

- `main`: 本番用。Vercel の Production Deployment を想定
- 開発中の確認: Vercel Preview Deployment をデモ環境として利用
- `.env.local` はローカル専用
- 本番 / プレビュー用の環境変数は Vercel 側で管理

## ドキュメント

- [仕様書](./docs/specification.md)
- [設計書](./docs/design.md)
- [取り扱い説明書](./docs/user-manual.md)
- [セキュリティチェック報告書](./docs/security-check.md)

## 補足

- ローン、積み立て、個人目標、徳ポイント、固定費見直しの一部状態はブラウザの `localStorage` に保存されます
- `input[type="month"]` は一部ブラウザで専用ピッカーが出ないため、必要に応じて `YYYY-MM` 形式で手入力してください
- `.env*` と `.vercel/` は Git に含めません
