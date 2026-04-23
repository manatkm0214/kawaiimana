# Kawaii Kakeibo

かわいい家計簿アプリの開発用リポジトリです。  
Next.js 15 / TypeScript / Supabase / Auth0 / Vercel を中心に構成しています。

本番 URL: `https://kawaii0214.vercel.app`

## ドキュメント

- [設計書](./docs/design.md)
- [仕様書](./docs/specification.md)
- [取り扱い説明書](./docs/user-manual.md)
- [セキュリティ / デプロイ補足](./SECURITY_DEPLOYMENT.md)

## 主な機能

- 家計データの入力、集計、可視化
- 予算プリセットと予算超過 / トレードオフ支援
- AI 分析、AI チャット、生活支援
- AI 店案内 / 周辺店舗検索
- Google / LINE / メール認証
- PDF 出力、問い合わせ、設定変更

## 開発環境

```bash
npm install
cp .env.example .env.local
npm run dev
```

ブラウザ: `http://localhost:3000`

## 検証コマンド

```bash
npm run build
node ./node_modules/typescript/bin/tsc --noEmit
./node_modules/.bin/eslint.cmd .
```

## デプロイ

Vercel 連携済みプロジェクトです。  
通常は Git push をトリガーにデプロイします。

## 注意

- 実シークレットは `.env.local` のみで管理してください
- `.vercel/` と `.env*` は Git 管理対象外です
- Supabase の migration は SQL Editor で順番に適用してください
