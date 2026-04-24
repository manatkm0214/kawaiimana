# かわいい家計簿

収支記録・予算管理・AI相談・お店案内をひとつにまとめた家計簿 Web アプリです。

本番 URL: `https://kawaii0214.vercel.app`

## 主な機能

- 家計データの入力、集計、可視化
- 予算プリセットと予算超過 / トレードオフ支援
- AI 分析、AI チャット、生活支援
- お店案内 / 周辺店舗検索（Google Maps 優先・OSM フォールバック）
- Google / LINE / メール認証
- PDF 出力、問い合わせ、設定変更

## 技術スタック

| 分類 | 使用技術 |
|------|----------|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| DB / 認証 | Supabase / Auth0 |
| ホスティング | Vercel |
| 地図・店舗検索 | Google Maps API（優先）/ OpenStreetMap（フォールバック） |
| メール | Resend |
| AI | OpenAI / Gemini |

## 開発環境

```bash
npm install
cp .env.example .env.local
# .env.local に必要な環境変数を設定する
npm run dev
```

ブラウザ: `http://localhost:3000`

## 検証コマンド

```bash
npm run build
node ./node_modules/typescript/bin/tsc --noEmit
./node_modules/.bin/eslint.cmd .
```

## ブランチ運用

| ブランチ | 用途 |
|----------|------|
| `main` | 本番デプロイ（Vercel 自動デプロイ） |
| `kawaii0214` | 開発ブランチ |

## ドキュメント

- [仕様書](./docs/specification.md)
- [設計書](./docs/design.md)
- [取り扱い説明書](./docs/user-manual.md)
- [セキュリティチェック報告書](./docs/security-check.md)

## 注意

- 実シークレットは `.env.local` のみで管理してください
- `.vercel/` と `.env*` は Git 管理対象外です
- Supabase の migration は SQL Editor で順番に適用してください
