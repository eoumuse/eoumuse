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

### 2.6 キー検出 & ハーモナイザー

#### キー検出

| 項目 | 詳細 |
|------|------|
| アルゴリズム | Krumhansl-Schmuckler（クロマベクトル相関法） |
| 入力 | AudioBuffer 全体を FFT 解析 → 12次元クロマベクトル生成 |
| 出力 | 検出キー（例: `C Major` / `A minor`）＋ 信頼度スコア（0〜1） |
| 手動オーバーライド | 検出結果が違う場合に手動でキー・スケールを選択可能 |
| 再検出 | ファイル読み込み時に自動実行、ボタンで任意に再実行 |

**対応スケール（ハーモナイズの基準）**

```
Major / Natural Minor / Harmonic Minor / Melodic Minor
Dorian / Phrygian / Lydian / Mixolydian / Locrian
Major Pentatonic / Minor Pentatonic
Chromatic（スケール外音も許可）
```

#### ハーモナイザー

グレインエンジンに追加ボイスを生やし、検出キー上の音程で同時発音させる。  
各ボイスは独立した GrainScheduler を持ち、ピッチオフセットのみ異なる。

| パラメータ | 範囲 | 説明 |
|-----------|------|------|
| Voices | 1〜6 | ハーモニーの声部数（1 = 原音のみ） |
| Intervals | スケール音度 | 追加する音度を個別に選択（3rd / 5th / 7th / 9th など） |
| Spread | 0〜2 オクターブ | ボイスを何オクターブ分散させるか |
| Detune | 0〜50 cent | 各ボイスにわずかなデチューンを加えてコーラス感を出す |
| Voice Mix | 0〜1 per voice | 各ボイスの音量バランス |
| Lock to Scale | ON/OFF | Pitch ノブをスケール音度にスナップさせる |

**コードモード（プリセット的なインターバル組み合わせ）**

| モード | インターバル |
|--------|------------|
| Unison | 原音のみ |
| 3rd | +3度 |
| 5th | +5度 |
| Octave | +8度 |
| Triad | +3度 + +5度 |
| 7th Chord | +3度 + +5度 + +7度 |
| Power | +5度 + +8度 |
| Custom | 任意選択 |

#### キー検出アルゴリズム（疑似コード）

```typescript
// Krumhansl-Schmuckler プロファイル
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const detectKey = (audioBuffer: AudioBuffer): KeyResult => {
  const chroma = extractChroma(audioBuffer); // FFT → 12次元クロマベクトル
  
  let best = { key: 0, mode: 'major', score: -Infinity };
  for (let root = 0; root < 12; root++) {
    const majorScore = pearsonCorrelation(chroma, rotate(MAJOR_PROFILE, root));
    const minorScore = pearsonCorrelation(chroma, rotate(MINOR_PROFILE, root));
    if (majorScore > best.score) best = { key: root, mode: 'major', score: majorScore };
    if (minorScore > best.score) best = { key: root, mode: 'minor', score: minorScore };
  }
  return best; // e.g. { key: 0, mode: 'major', score: 0.87 } → "C Major"
};
```

#### ハーモナイザーのグレイン発音ロジック

```typescript
// 検出キーから各ボイスのセミトーンオフセットを計算
const getVoicePitches = (rootNote: number, scale: Scale, intervals: number[]): number[] => {
  return intervals.map(degree => scaleDegreeToCents(scale, degree));
};

// グレインスケジューラーをボイス分生成
voices.forEach((voiceOffset, i) => {
  scheduleGrain({
    ...baseParams,
    pitch: basePitch + voiceOffset,
    gain: voiceMix[i],
    detune: (Math.random() - 0.5) * detuneAmount,
  });
});
```

### 2.7 エフェクト（ポストプロセッシング）

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
┌──────────────────────────────────────────────────────────┐
│   HEADER: プロジェクト名 / ファイルロード / プリセット    │
├───────────────────────┬──────────────────────────────────┤
│                       │                                  │
│   WAVEFORM DISPLAY    │       GRAIN CLOUD VIEW           │
│   (波形 + スクラブ)   │   (グレイン散布ビジュアル)       │
│                       │                                  │
├───────────────────────┴──────────────────────────────────┤
│              GRAIN PARAMETERS PANEL                      │
│   Position | Size | Density | Pitch | Scatter | Pan      │
├──────────────────────┬───────────────────────────────────┤
│   ENVELOPE / WINDOW  │   LFO × 2                        │
├──────────────────────┴───────────────────────────────────┤
│              KEY DETECT & HARMONIZER                     │
│  [Key: C Major ▼] [Scale ▼] [Re-detect]  Confidence: 87%│
│  Voices: 3  |  Intervals: [3rd][5th]  |  Spread  Detune  │
├──────────────────────────────────────────────────────────┤
│              EFFECTS RACK                                │
│   Reverb | Delay | Filter | Compressor                   │
├──────────────────────────────────────────────────────────┤
│   TRANSPORT: Play / Stop / Record  |  Master Volume      │
└──────────────────────────────────────────────────────────┘
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
AudioBuffer ──▶ KeyDetector (offline FFT → chroma → K-S algorithm)
                    │ detectedKey, scale
                    ▼
              HarmonizerConfig (intervals, spread, detune)
                    │ voicePitches[]
                    │
AudioBuffer ──┬──▶ GrainScheduler[0] (dry / base pitch)  ──┐
              ├──▶ GrainScheduler[1] (+voice 1 semitones) ──┤
              ├──▶ GrainScheduler[2] (+voice 2 semitones) ──┤
              └──▶ GrainScheduler[N] ...                  ──┘
                    │  各 Scheduler 内部:                    │
                    │  GrainNode × N (BufferSourceNode)      │
                    │    └─ GainNode (envelope)              │
                    │    └─ StereoPannerNode                 │
                    ▼                                        │
              GainNode (Voice Mix) ◀──────────────────────  ┘
                    │
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

### Phase 3.5 — キー検出 & ハーモナイザー
- [ ] OfflineAudioContext + AnalyserNode でクロマベクトル抽出
- [ ] Krumhansl-Schmuckler アルゴリズム実装（KeyDetector.ts）
- [ ] 12キー × Major/Minor プロファイル相関計算
- [ ] スケールテーブル定義（Major / Minor / モード / ペンタトニック）
- [ ] HarmonizerEngine: ボイス別 GrainScheduler 管理
- [ ] Voice Mix / Detune / Spread パラメータ接続
- [ ] KeyDetect UI（検出結果表示・手動オーバーライド・スケール選択）
- [ ] Harmonizer UI（ボイス数・インターバルボタン・Chord Mode セレクター）
- [ ] Lock to Scale（Pitch ノブをスケール音度にスナップ）

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
│   ├── GrainEngine.ts        # グレインスケジューラー（マルチボイス対応）
│   ├── GrainNode.ts          # 個別グレイン管理
│   ├── LFO.ts
│   ├── key/
│   │   ├── KeyDetector.ts    # クロマ抽出 + K-S アルゴリズム
│   │   ├── scales.ts         # スケールテーブル定義
│   │   └── harmonizer.ts     # ボイス別ピッチオフセット計算
│   └── effects/
│       ├── Reverb.ts
│       ├── Delay.ts
│       └── Filter.ts
├── components/
│   ├── WaveformDisplay.tsx
│   ├── GrainCloud.tsx
│   ├── Knob.tsx
│   ├── ParameterPanel.tsx
│   ├── KeyDetectPanel.tsx    # キー表示・手動選択・信頼度バッジ
│   ├── HarmonizerPanel.tsx   # ボイス数・インターバル・Chord Mode
│   └── EffectsRack.tsx
├── store/
│   └── synthStore.ts         # Zustand store（harmonizer state 含む）
├── presets/
│   └── index.ts
└── App.tsx
```
