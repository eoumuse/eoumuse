# グラニュラーシンセサイザー 仕様書
**プロジェクト名:** GrainWeaver  
**参考:** Soniclabs Polynodes  
**作成日:** 2026-05-22

---

## 1. 概要

Web Audio API を使用したブラウザ上で動作するグラニュラーシンセサイザー。  
音声ファイルをグレイン（粒）に分解し、位置・サイズ・ピッチ・密度などをリアルタイムで操作することで独特のテクスチャーサウンドを生成する。

---

## 2. コア機能

### 2.1 オーディオソース

| 機能 | 詳細 |
|------|------|
| ファイル読み込み | WAV / MP3 / OGG / FLAC 対応、ドラッグ&ドロップ |
| マイク入力 | リアルタイムマイク入力からグレイン生成 |
| プリセットサンプル | バンドル済みサンプル数種 |

### 2.2 グレインエンジン（コアパラメータ）

```
Position   — 読み取り開始位置（0〜100%）
Size       — グレインの長さ（10ms〜2000ms）
Density    — 毎秒のグレイン数（1〜200 grains/sec）
Pitch      — ピッチシフト（-24〜+24 semitones）
Scatter    — 位置のランダム幅（0〜100%）
Pan Spread — ステレオ広がり（0〜1）
```

### 2.3 グレインエンベロープ

- Attack / Decay / ウィンドウ形状（Hanning・Gaussian・Rectangular・Tukey）
- 各グレインに独立適用

### 2.4 再生モード

| モード | 説明 |
|--------|------|
| Forward | 通常前進再生 |
| Backward | 逆再生 |
| Pingpong | 往復再生 |
| Random | ランダム位置から発音 |
| Loop | 指定範囲をループ |

### 2.5 LFO（モジュレーション）

- LFO × 2 系統
- ターゲット: Position / Size / Pitch / Density / Pan
- 波形: Sine / Triangle / Square / Sawtooth / Random (S&H)
- Rate: 0.01〜20 Hz  
- Amount: 0〜100%

### 2.6 エフェクト（ポストプロセッシング）

```
Reverb   — Web Audio ConvolverNode、Room Size / Wet
Delay    — フィードバックディレイ、Time / Feedback / Wet
Filter   — LP/HP/BP BiquadFilter、Cutoff / Resonance
Compress — DynamicsCompressor（マスター）
```

---

## 3. UI / UX 設計

### 3.1 レイアウト構成

```
┌─────────────────────────────────────────────────────┐
│  HEADER: プロジェクト名 / ファイルロード / プリセット  │
├──────────────────────┬──────────────────────────────┤
│                      │                              │
│   WAVEFORM DISPLAY   │      GRAIN CLOUD VIEW        │
│   (波形 + スクラブ)  │   (グレイン散布ビジュアル)   │
│                      │                              │
├──────────────────────┴──────────────────────────────┤
│           GRAIN PARAMETERS PANEL                    │
│  Position | Size | Density | Pitch | Scatter | Pan  │
├─────────────────────┬───────────────────────────────┤
│   ENVELOPE / WINDOW │   LFO × 2                    │
├─────────────────────┴───────────────────────────────┤
│              EFFECTS RACK                           │
│   Reverb | Delay | Filter | Compressor              │
├─────────────────────────────────────────────────────┤
│   TRANSPORT: Play / Stop / Record | Master Volume   │
└─────────────────────────────────────────────────────┘
```

### 3.2 ビジュアライゼーション

**Waveform Display**
- 読み込んだ音声の波形全体表示
- 現在のPosition（スクラブヘッド）を表示
- Scatter範囲をシェーディングで表示
- マウスドラッグでPositionをスクラブ

**Grain Cloud View**
- 発音中のグレインを粒子として2Dキャンバスに描画
- X軸: 音声内の位置、Y軸: ピッチシフト量
- 粒のサイズ: グレインSize、色: Pan位置
- リアルタイムアニメーション（requestAnimationFrame）

### 3.3 コントロールUI

- ノブ（Knob）: マウスドラッグ / スクロールで操作、ダブルクリックでリセット
- スライダー: 微細調整向け（Scatter, Pan Spread）
- セレクター: 再生モード、LFO波形などはボタングループ

---

## 4. 技術スタック

| レイヤー | 技術 |
|----------|------|
| フレームワーク | React 18 + TypeScript |
| ビルド | Vite |
| オーディオ | Web Audio API（ネイティブ） |
| スタイル | Tailwind CSS + CSS Variables（ダークテーマ） |
| キャンバス | Canvas 2D API |
| 状態管理 | Zustand |
| テスト | Vitest |

---

## 5. オーディオグラフ

```
AudioBuffer
    │
    ▼
GrainScheduler (ScriptProcessor / AudioWorklet)
    │  ┌─ GrainNode × N (BufferSourceNode)
    │  │    └─ GainNode (envelope)
    │  │    └─ StereoPannerNode
    │  └─ ...
    ▼
GainNode (Master Gain)
    ├──▶ ConvolverNode (Reverb)  ──┐
    ├──▶ DelayNode (Delay)       ──┼──▶ GainNode (Wet Mix) ──▶ MasterGain
    ├──▶ BiquadFilterNode        ──┘
    └──▶ DynamicsCompressorNode
    ▼
AudioContext.destination
```

### 5.1 グレインスケジューラーのロジック

```typescript
// 疑似コード
const scheduleGrain = (currentTime: number) => {
  const interval = 1 / density;
  while (nextGrainTime < currentTime + LOOKAHEAD) {
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    
    const grainPosition = position + (Math.random() - 0.5) * scatter;
    const offset = clamp(grainPosition * buffer.duration, 0, buffer.duration);
    
    source.playbackRate.value = semitoneToRate(pitch);
    source.start(nextGrainTime, offset, grainSize);
    
    // エンベロープ適用
    const env = ctx.createGain();
    applyWindowEnvelope(env, nextGrainTime, grainSize, windowType);
    
    source.connect(env).connect(panner).connect(masterGain);
    nextGrainTime += interval + jitter();
  }
};
```

---

## 6. プリセット

| 名前 | 説明 |
|------|------|
| Frozen Texture | 位置固定・高密度・大きなScatter |
| Time Stretch | 低密度・フォワード・Pitchゼロ |
| Cloud Pad | 中密度・LFO on Position |
| Reverse Shimmer | Backwardモード・ピッチ+12 |
| Glitch Storm | ランダムモード・最高密度 |

---

## 7. 実装フェーズ

### Phase 1 — コアエンジン（MVP）
- [ ] プロジェクトセットアップ（Vite + React + TS）
- [ ] AudioContext初期化
- [ ] 音声ファイル読み込み・デコード
- [ ] グレインスケジューラー基本実装
- [ ] Position / Size / Density / Pitch パラメータ接続

### Phase 2 — UI基盤
- [ ] 波形表示（Canvas）
- [ ] Knobコンポーネント
- [ ] グレインクラウドビジュアライゼーション
- [ ] パラメータパネルレイアウト

### Phase 3 — 拡張機能
- [ ] Scatter / Pan Spread / 再生モード
- [ ] グレインウィンドウ形状
- [ ] LFO × 2 実装

### Phase 4 — エフェクト
- [ ] Reverb（IR畳み込み）
- [ ] フィードバックディレイ
- [ ] フィルター
- [ ] マスターコンプレッサー

### Phase 5 — 仕上げ
- [ ] プリセット管理（保存・読み込み）
- [ ] マイク入力
- [ ] 録音・エクスポート（MediaRecorder）
- [ ] レスポンシブ対応・モバイル検討

---

## 8. 非機能要件

| 項目 | 目標 |
|------|------|
| レイテンシー | < 30ms（128サンプルバッファー目安） |
| 最大同時グレイン数 | 〜200粒 |
| ブラウザサポート | Chrome 最新 / Firefox 最新 / Safari 17+ |
| AudioWorklet | Phase 1 は ScriptProcessor でプロトタイプ、後にWorkletへ移行 |

---

## 9. デザインガイドライン

- **配色:** ダークテーマ（背景 `#0d0d0f`、アクセント `#7c5cfc` 紫系）
- **フォント:** Inter / JetBrains Mono（数値表示）
- **ノブ:** SVGベース、回転アニメーション付き
- **グレインクラウド:** 半透明パーティクル、残光エフェクト（fading trail）

---

## 10. ディレクトリ構成（予定）

```
src/
├── audio/
│   ├── GrainEngine.ts      # グレインスケジューラー
│   ├── GrainNode.ts        # 個別グレイン管理
│   ├── LFO.ts
│   └── effects/
│       ├── Reverb.ts
│       ├── Delay.ts
│       └── Filter.ts
├── components/
│   ├── WaveformDisplay.tsx
│   ├── GrainCloud.tsx
│   ├── Knob.tsx
│   ├── ParameterPanel.tsx
│   └── EffectsRack.tsx
├── store/
│   └── synthStore.ts       # Zustand store
├── presets/
│   └── index.ts
└── App.tsx
```
