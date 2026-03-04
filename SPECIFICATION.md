# Project Specification: Kazenagare (風流)

## 1. Project Overview
* **Project Name:** Kazenagare (風流)
* **Concept:** A web-based interactive art/entertainment application where user's voice becomes a part of a "Japanese traditional scene" (Yorishiro). The voice is transformed into sounds of traditional objects and animated visually.
* **Core Value:** Providing an emotional and aesthetic experience by blending voice input with traditional Japanese motifs (Wabi-Sabi) and allowing users to visit each other's "Gardens".

## 2. Tech Stack
* **Framework:** Next.js 15+ (App Router), React 19
* **Language:** TypeScript
* **Styling:** Tailwind CSS (Custom Japanese color palette configured)
* **Audio Engine:** Tone.js (Web Audio API extension for analyzing volume/pitch and applying effects like reverb/pitch-shift)
* **Visual Engine:** p5.js (via `react-p5` for generative Japanese art/animations)
* **Backend / BaaS:** Supabase (PostgreSQL, Auth, Storage for audio files)
* **CI/CD:** GitHub Actions (Lint & Build checks)

## 3. Core Features
1. **Audio Input & Analysis:**
   * Capture user's microphone input using `Tone.UserMedia`.
   * Analyze real-time volume and frequency data.
2. **Voice Transformation & Object Interaction:**
   * **Shishi-odoshi (Deer scarer):** Voice is synthesized with the reverberation of bamboo hitting stone. Visually, voice volume accumulates water, triggering the bamboo animation.
   * **Furin (Wind chime):** Voice pitch is shifted up with a shimmer reverb. Visually, the wind chime sways, and the voice waveform appears on the paper slip.
3. **Garden (My Space & Social Discovery):**
   * Users can select a background (e.g., Bamboo forest, Night pond) to create their "Garden".
   * Save recorded transformed voices and background settings to Supabase.
   * **Dynamic Routing:** Visit other users' gardens via `/garden/[userId]`.
   * **Random Visit:** A button to randomly redirect to another user's garden.

## 4. Directory Structure (Architecture)
```text
src/
├── app/                 # ルーティング（各ページの入り口）
├── components/
│   ├── ui/              # 共通UIパーツ（ボタン、ナビゲーション等）
│   ├── visual/          # p5.jsを用いた描画特化のコンポーネント
│   └── garden/          # 庭ページの構成要素
├── hooks/               # 状態管理・ライフサイクルのカスタムフック
│   ├── useAudio.ts      # Tone.jsの制御ロジック
│   └── useGarden.ts     # 庭の状態管理
├── lib/
│   ├── supabase/        # データベース接続クライアント
│   └── utils/           # 数値計算やフォーマットなどの共通関数
└── types/               # TypeScriptの型定義ファイル（Supabaseスキーマ等）

5. Database Schema (Supabase)
Table: user_profiles

id (UUID, PK)

username (String)

selected_background_id (String)

Table: voices

id (UUID, PK)

user_id (UUID, FK -> user_profiles.id)

object_type (String - e.g., 'furin', 'shishi-odoshi')

voice_url (String - Supabase Storage URL)

parameters (JSONB - pitch, reverb settings, etc.)

created_at (Timestamp)

6. AI Assistant Instructions
When generating code or providing solutions for this project, please adhere to the following rules:

Strictly use Next.js App Router (app directory) conventions.

Prioritize Low Latency: For Tone.js and p5.js integrations, ensure real-time audio-visual feedback is optimized and free of noticeable lag.

Aesthetic Consistency: Use the predefined custom Tailwind colors (e.g., bg-wa-white, text-wa-black) and maintain a minimalistic, traditional Japanese aesthetic.

Client/Server Components: Ensure 'use client' is explicitly declared at the top of files using React hooks, Tone.js, or p5.js.