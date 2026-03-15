# Kazenagare (風流)

声を和の情景へ溶け込ませる、音声入力ベースのインタラクティブWebアプリです。

現在は Next.js App Router 上で、庭ステージ探索、オブジェクト配置、録音連動、QR共有、認証導線の土台が動作しています。

## 現在の実装スコープ

- 庭ステージ（移動、カメラ追従、オブジェクト配置、録音再生、コイン報酬）
- Voice Zoo（図鑑、コイン消費で購入、3秒録音、再生報酬）
- 認証UI（匿名、メール、Google、X）
- QR共有（/garden/[userId]/qr）
- BGMの manifest ベース解決と音量設定

## 主要ルート

| Route | Purpose | 現状 |
| --- | --- | --- |
| `/` | ホーム。音量メーター、認証UI、庭導線 | 実装済み |
| `/garden` | 庭一覧（自分 + サンプルユーザー） | 実装済み |
| `/garden/setup` | 背景/季節/時間帯の選択フォーム | 実装済み |
| `/garden/empty` | 設定反映ステージ（query: background/season/time/place） | 実装済み |
| `/garden/[userId]` | 他ユーザー閲覧 + `me` の場合は配置モード | 実装済み |
| `/garden/[userId]/qr` | 共有用QR生成 | 実装済み |
| `/voice-zoo` | 図鑑・購入・録音・報酬の専用ページ | 実装済み |
| `/test-ui` | p5 + joystick の開発検証ページ | 実装済み（検証用） |

補足:

- `/garden/me` は `/garden/[userId]` の `userId=me` として動作します。
- `/garden/setup` からは `/garden/empty` に遷移し、選択値を query で反映します。
- `/garden/me` は現状、背景/季節/時間帯を固定値で表示します（`place` query のみ反映）。

## 技術スタック

- Next.js 16.1.6 (App Router)
- React 19.2.3
- TypeScript 5
- Tailwind CSS 4
- Supabase JS 2
- idb-keyval 6
- p5 2 / react-p5 1
- qrcode 1

## 開発環境セットアップ

### 1. Install

```bash
npm install
```

### 2. Environment Variables

`.env.local` を作成して、必要に応じて設定してください。

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# Optional: QR URL生成で優先利用
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

補足:

- Supabase の環境変数が未設定でも、一部機能は `local_guest` としてローカル動作します。
- 認証操作（ログイン/登録）には Supabase 設定が必要です。

### 3. Run

```bash
npm run dev
```

デフォルトで `0.0.0.0` バインドです。LAN内確認に使えます。

## npm scripts

- `npm run dev`: Turbopack で起動 (`next dev --turbopack --hostname 0.0.0.0`)
- `npm run dev:webpack`: Webpack で起動
- `npm run build`: 本番ビルド
- `npm run start`: 本番サーバー起動
- `npm run lint`: ESLint 実行 (`eslint .`)

## データ保存の実態

サーバーDBへの永続化より先に、ローカル保存を中心に実装されています。

### localStorage

- `kazenagare_garden_<userId>`: 庭設定（背景 index など）
- `kazenagare_audio_settings`: BGM音量/キャラ音声音量
- `kazenagare_wallet_me`: Voice Zoo の所持コイン/購入状態
- `kazenagare_audio_catalog_<ownerId>`: 録音メタ情報
- `kazenagare_objects_me`: 配置オブジェクト
- `kazenagare.oauthRedirectPending`: OAuth リダイレクト中フラグ

### IndexedDB (idb-keyval)

- `kazenagare_audio_<userId>`: ホーム画面の録音データ
- `kazenagare_audio_blob_<ownerId>_<recordingId>`: Voice Zoo 録音Blob
- `kazenagare_audio_<ownerId>_<objectType>`: 旧キー（移行対象）

## BGM/画像アセット

### BGM

- 正式な解決元: `public/audio/garden/manifest.json`
- 現在は `bgm.mp3` をデフォルトとして再生
- manifest 読み込み失敗時はファイル名規則でフォールバック探索

詳細は `public/audio/garden/README.md` を参照してください。

### 背景画像

- 想定パス: `public/images/garden/backgrounds/<backgroundId>/<seasonId>/<timeSlotId>/background.*`
- 現在は多くがプレースホルダ (`.gitkeep`) で、装飾は CSS/SVG 側で補完

詳細は `public/images/README.md` を参照してください。

## 実装上の注意点

- Voice Zoo の価格はゲーム内コインで、実課金は未実装です。
- `shishi-odoshi` は図鑑登録済みですがステータスは `planned` です。
- 当たり判定ゾーン定義は土台のみで、実ゾーンは未設定です。
- Supabase は現状、主に認証用途。庭/録音のDB保存は未接続です。
- `layout.tsx` で `noindex, nofollow` を設定しているため、検索エンジン向け公開運用前に見直しが必要です。

## ディレクトリ要点

- `src/app`: App Router ルート
- `src/components/garden/empty`: 現在の庭ステージ実装の中心
- `src/components/garden/garden-options-menu.tsx`: オプション + 図鑑 + 録音導線
- `src/app/voice-zoo/page.tsx`: 図鑑の専用ページ
- `src/lib/audio`: BGM/音量設定ユーティリティ
- `src/lib/voice-zoo`: 図鑑・録音・財布ロジック

## 参考資料

- `SPECIFICATION.md`: 企画仕様（理想像と構成方針）
- `public/audio/garden/README.md`: BGM運用ルール
- `public/images/README.md`: 背景画像ルール
