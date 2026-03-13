# Garden BGM Assets

庭ステージのBGMは、`public/audio/garden/manifest.json` を正として読み込みます。

## 推奨構成（堅牢運用）

1. `manifest.json` にトラック定義とシーン別マッピングを書く
2. 実ファイルを `public/audio/garden` 配下へ置く
3. 収益化ロジック（広告表示など）はBGM選択と分離して別レイヤーで実装する

この構成にすると、運用中にファイル名規則へ依存せず、
「どのシーンでどの曲を鳴らすか」を明示できます。

## Manifest 仕様

- `version`: 現在は `1`
- `defaultTrackId`: フォールバック用トラックID
- `tracks`: トラック辞書
- `scenes`: シーン別トラックIDマップ

`tracks` の主な項目:

- `src`: `"/audio/garden/..."` 形式のパス
- `volumeMultiplier`: そのトラックだけの音量係数（任意、既定 `1`）

`scenes` の評価優先順:

1. `byBackgroundSeasonTime` (`background:season:time`)
2. `byBackgroundSeason` (`background:season`)
3. `byBackgroundTime` (`background:time`)
4. `byBackground` (`background`)
5. `bySeasonTime` (`season:time`)
6. `bySeason` (`season`)
7. `byTimeSlot` (`time`)
8. `defaultTrackId`

## 最小の本番例

`manifest.json`:

```json
{
  "version": 1,
  "defaultTrackId": "default",
  "tracks": {
    "default": {
      "src": "/audio/garden/bgm.mp3",
      "volumeMultiplier": 1
    }
  },
  "scenes": {
    "byBackgroundSeasonTime": {},
    "byBackgroundSeason": {},
    "byBackgroundTime": {},
    "byBackground": {},
    "bySeasonTime": {},
    "bySeason": {},
    "byTimeSlot": {}
  }
}
```

この場合は `bgm.mp3` を差し替えるだけで全シーンに反映されます。

## 広告型マネタイズ方針

BGMトラックは課金解放を前提にせず、全ユーザーで同一ロジックで解決します。
広告表示や広告再生報酬などの収益化は、BGM解決ロジックと切り離して実装するのを推奨します。

## 対応拡張子

- `mp3`
- `ogg`
- `m4a`
- `wav`
- `webm`

## 互換フォールバック（manifest 未配置時）

`manifest.json` が読めない場合のみ、以下のファイル名探索にフォールバックします。

1. `<backgroundId>-<seasonId>-<timeSlotId>.<ext>`
2. `<backgroundId>-<seasonId>.<ext>`
3. `<backgroundId>-<timeSlotId>.<ext>`
4. `<backgroundId>.<ext>`
5. `<seasonId>-<timeSlotId>.<ext>`
6. `<seasonId>.<ext>`
7. `<timeSlotId>.<ext>`
8. `default.<ext>`
9. `bgm.<ext>`

例:

- `night-pond-winter-night.mp3`
- `bamboo-forest.mp3`
- `default.ogg`
- `bgm.mp3`

## 現在のID

- `backgroundId`: `bamboo-forest`, `night-pond`, `misty-temple`
- `seasonId`: `spring`, `summer`, `autumn`, `winter`
- `timeSlotId`: `morning`, `daytime`, `evening`, `night`

最小構成なら `manifest.json` + `bgm.mp3` の2ファイルで全シーン再生できます。
