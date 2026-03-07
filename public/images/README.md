# Image Assets

静的画像はこの `public/images` 配下に配置します。

## Garden 用の基本配置
- 背景 × 季節 × 時間帯: `public/images/garden/backgrounds/<backgroundId>/<seasonId>/<timeSlotId>/background.*`

例:
- `public/images/garden/backgrounds/bamboo-forest/spring/morning/background.webp`
- `public/images/garden/backgrounds/night-pond/winter/night/background.png`
- `public/images/garden/backgrounds/misty-temple/autumn/evening/background.avif`

## 現在の ID
- backgroundId: `bamboo-forest`, `night-pond`, `misty-temple`
- seasonId: `spring`, `summer`, `autumn`, `winter`
- timeSlotId: `morning`, `daytime`, `evening`, `night`

ファイル形式は `png/webp/avif` などを想定。