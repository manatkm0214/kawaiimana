# 設計書

## 1. システム概要

本システムは、家計の記録、分析、目標管理、AI 支援を 1 つの Web アプリにまとめた Next.js ベースの家計簿です。  
フロントエンドと API は同一リポジトリの App Router で管理し、主要データは Supabase、認証は Auth0、配信は Vercel を利用します。

## 2. 全体構成

```text
Browser
  ├─ App Router UI
  ├─ Dashboard / Input / AI / Goals / Settings / Contact
  └─ Fetch to /api/*

Next.js App Router
  ├─ src/app/*                画面
  ├─ src/app/api/*            API Route Handlers
  ├─ src/lib/components/*     UI コンポーネント
  ├─ src/lib/auth/*           認証連携
  ├─ src/lib/server/*         セキュリティ / サーバーユーティリティ
  └─ src/lib/supabase/*       DB アクセス

External Services
  ├─ Supabase                 profiles / transactions / budgets
  ├─ Auth0                    Google / LINE / メール認証
  ├─ OpenAI / Gemini          AI 機能
  ├─ Google Maps API          店舗検索 / Geocoding（優先）
  ├─ Nominatim / Overpass     地図検索フォールバック
  ├─ Resend                   メール送信
  └─ Vercel                   Preview / Production Deploy
```

## 3. レイヤ設計

### 3.1 Presentation Layer

- `src/app/`
- `src/lib/components/`

役割:

- 入力画面、ダッシュボード、設定、法務ページ、問い合わせページを表示
- API 結果とローカル状態を統合して画面に反映
- 一部の軽量な目標管理状態を `localStorage` に保持

### 3.2 Application Layer

- `src/app/api/`

役割:

- 認証済みリクエストの入力検証
- same-origin、rate limit、認可の適用
- 外部 API、DB、メール送信のオーケストレーション

### 3.3 Domain / Utility Layer

- `src/lib/utils.ts`
- `src/lib/fixed-cost-flags.ts`
- `src/lib/components/*` 内の計算ロジック

役割:

- 家計サマリー計算
- 予算差分計算
- 固定費見直し候補抽出
- 徳ポイント算出
- 購入判断支援

### 3.4 Infrastructure Layer

- `src/lib/supabase/admin.ts`
- `src/lib/auth0.ts`
- `src/lib/server/security.ts`
- `src/lib/server/ssrf.ts`

役割:

- Supabase 接続
- Auth0 セッション処理
- same-origin、JSON サイズ制限、rate limit
- SSRF 対策

## 4. ダッシュボード設計

ダッシュボードは複数の表示モードを持つ。

- 一般向けダッシュボード
- こども向けダッシュボード
- シニア向けダッシュボード
- 年次、基準、AI 関連タブ

目標周辺は次の構成:

- `GenerationGoals`: 世代別 UI 切替
- `GoalsAndDebt`: 一般向けの詳細目標管理
- `PurchaseAdvisor`: 価格判断と目標追加

`/dashboard` にはダミーデータで画面確認できるデモ表示がある。

## 5. データ設計

主要テーブル:

- `profiles`
- `transactions`
- `budgets`

補助データ:

- 予算差額
- 予算トレードオフ
- 引き落とし予約

ブラウザローカル保持:

- `kakeibo-debts`
- `kakeibo-sinking-funds`
- `kakeibo-personal-goals`
- `kakeibo-ticket-value`
- `kakeibo-tickets-used`
- `kakeibo-fixed-cost-flags-reviewed`
- `kakeibo-fixed-cost-flags-hidden`

設計意図:

- 高頻度で編集される軽量な目標補助データは、即時操作性を優先して `localStorage` を利用
- 取引や予算など共有前提のデータはサーバー側で管理

## 6. GoalsAndDebt 設計

`src/lib/components/GoalsAndDebt.tsx` は一般向け目標画面の中心コンポーネント。

タブ構成:

- `debt`
- `sinking`
- `goals`
- `fixedCostFlags`
- `virtue`

### 6.1 ローン管理

保持項目:

- `id`
- `name`
- `type`
- `totalAmount`
- `remainingAmount`
- `monthlyPayment`
- `interestRate`
- `memo`

振る舞い:

- 完済予定月を `remainingAmount / monthlyPayment` から算出
- 返済率を進捗バーで表示
- 「返済」操作は残高を月返済額ぶん減算

### 6.2 先取積み立て

保持項目:

- `name`
- `emoji`
- `targetAmount`
- `currentAmount`
- `targetDate`
- `memo`
- `status`
- `createdAt`
- `completedAt`
- `archivedAt`

振る舞い:

- 目標達成後は completed 扱い
- 一定経過後または明示操作で archived へ移行
- restore により active / completed へ戻せる

### 6.3 個人目標

保持項目:

- `name`
- `emoji`
- `targetAmount`
- `currentAmount`
- `memo`
- `status`
- `createdAt`
- `completedAt`
- `archivedAt`

振る舞い:

- 手動加算
- チケット加算
- 購入アドバイザーからの追加
- 達成後の archived 管理

### 6.4 購入アドバイザー連携

- `PurchaseAdvisor` が `kakeibo-personal-goals` に新規目標を保存
- 保存後に `kakeibo-goals-updated` イベントを発火
- `GoalsAndDebt` 側はイベントを listen してローカル状態を再読込する

## 7. 固定費見直し設計

対象:

- `src/lib/fixed-cost-flags.ts`
- `src/lib/components/GoalsAndDebt.tsx`

抽出条件:

- `transaction.type === "expense"`
- `transaction.is_fixed === true`
- またはカテゴリ / メモが固定費らしいキーワードに一致

グルーピング:

- カテゴリ
- 表示タイトル
- 支払い方法

評価要素:

- サブスク系
- 月収比 5% 以上
- 月 1 万円以上
- 同月複数回
- 固定費として登録済み

出力:

- 優先度
- 理由
- 推奨アクション
- 確認済み状態
- 月単位の非表示状態

## 8. 徳ポイント設計

`calcVirtuePoints()` が月単位で取引を集計し、徳ポイントを算出する。

評価要素:

- 貯蓄率 20% 以上: `+10`
- 貯蓄率 10% 以上: `+5`
- 黒字: `+5`
- 固定費率 35% 以下: `+3`
- 変動費率 25% 以下: `+5`
- 貯蓄または投資あり: `+2`

出力:

- `total`
- `byMonth[] = { ym, points, reasons }`

派生値:

- `ticketsEarned = floor(total / 100)`
- `ticketsAvailable = ticketsEarned - ticketsUsed`

## 9. 認証設計

認証方式:

- Auth0 セッション認証
- Google OAuth
- LINE Login
- メール系ログイン

設計ポイント:

- 画面系は Auth0 セッション前提
- API はセッション確認と same-origin を併用
- webhook 系 API は署名検証で保護

## 10. セキュリティ設計

主要制御:

- `requireSameOrigin`
- `rateLimit`
- `readJsonBody`
- `boundedText`
- webhook 署名検証
- SSRF 対策

補足:

- ローカル保存データは同一ブラウザ内の補助状態として扱う
- 機密値は `.env.local` または Vercel 環境変数で管理

## 11. デプロイ設計

環境:

- ローカル開発
- Vercel Preview Deployment
- Vercel Production Deployment

運用:

- Preview Deployment をデモ環境として利用
- Production Alias は `https://kawaii0214.vercel.app`
- `.vercel/project.json` に Vercel project link を保持

## 12. 非機能要件

- TypeScript による型安全
- ESLint による静的検証
- `next build` 通過をリリース条件とする
- light / dark theme の可読性維持

## 13. ブラウザ注意点

- `input[type="month"]` はブラウザによって専用ピッカーの挙動が異なる
- Firefox / Safari では専用 UI が弱い場合があるため、`YYYY-MM` 手入力を許容する前提で運用する
