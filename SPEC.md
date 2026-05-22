# グラニュラーシンセサイザー 仕様書
**プロジェクト名:** GrainWeaver  
**参考:** sonicLAB PolyNodes  
**作成日:** 2026-05-22  
**改訂日:** 2026-05-22（PolyNodes仕様精査に基づき全面改訂）

---

## 1. コンセプト

音声ファイルを**3次元の幾何学的構造**へマッピングし、複数の**サウンドエージェント**（プレイヘッド）がその構造上をナビゲートすることで音を生成する、空間音響彫刻ツール。

PolyNodesの核心は「位置ノブを動かす」ではなく、**音の重要な瞬間（オンセット）を3D空間のノードとして配置し、エージェントがその空間を旅する**こと。音響パラメータは空間座標から自然に導出される。

### 3層アーキテクチャ（Macro / Meso / Micro）

```
Macro  ── 楽曲全体の大きな構造（セクション・フレーズ単位）
Meso   ── 中間的な音響イベント（音符・打鍵単位）
Micro  ── 最小粒度の変化（グレイン・トランジェント単位）
```

各レベルで独立してオンセット検出・ジオメトリ生成・エージェント配置を行い、多層的な音響ナビゲーションを実現する。

---

## 2. コア機能

### 2.1 オーディオソース

| 機能 | 詳細 |
|------|------|
| ファイル読み込み | WAV / MP3 / OGG / FLAC、ドラッグ&ドロップ |
| プリセットサンプル | バンドル済みサンプル数種 |
| マイク入力 | リアルタイム入力（Phase 5） |

---

### 2.2 マルチスケール・オンセット解析エンジン

音声を読み込むと **3つのスケール**でオンセット（音の重要な瞬間）を自動検出し、それぞれノードの集合として記録する。

| スケール | 検出対象 | 使用アルゴリズム | 典型ノード数 |
|---------|---------|----------------|------------|
| Macro | 大きなエネルギー変化・セクション境界 | RMS エネルギー包絡の勾配 | 3〜20 |
| Meso | 音符・打鍵・中程度のトランジェント | スペクトルフラックス | 20〜200 |
| Micro | グレインレベルの微細変化 | 高分解能スペクトル差分 | 200〜数千 |

```typescript
// 疑似コード
type Node = {
  id: string;
  time: number;       // 音声内のオフセット（秒）
  energy: number;     // そのノードのスペクトルエネルギー
  spectralCentroid: number;  // 音色の明るさ
  scale: 'macro' | 'meso' | 'micro';
};
```

---

### 2.3 3Dジオメトリ生成

検出されたノードを3次元空間にマッピングし、**測地線上の三角形分割ネットワーク（Triangulated Mesh）** を生成する。

#### 座標マッピング

```
X軸 ── 時間的位置（音声内のオフセット）
Y軸 ── スペクトル重心（音色の明るさ）
Z軸 ── エネルギー振幅
```

#### ジオメトリ処理

1. ノード座標を正規化（各軸 0〜1）
2. Delaunay三角形分割でエッジ接続
3. 各スケール（Macro/Meso/Micro）ごとに独立したメッシュレイヤーを生成
4. 10秒の波形から数千のノード接続が生まれうる

#### インタラクション

- マウスドラッグで3D空間を任意の角度から回転・ズーム
- ノードをホバーで対応する音声位置・スペクトル情報を表示
- スケールレイヤーの表示切替

---

### 2.4 サウンドエージェント

**エージェント**は3Dジオメトリ上を移動するプレイヘッド。エージェントの現在位置からグレインを発音する。最大6エージェントを同時配置できる。

#### エージェントパラメータ

| パラメータ | 範囲 | 説明 |
|-----------|------|------|
| Scale | Macro / Meso / Micro | どのメッシュレイヤーを移動するか |
| Speed | 0.01〜10× | ジオメトリ上の移動速度 |
| Grain Size | 10ms〜2000ms | 発音するグレインの長さ |
| Density | 1〜200 grains/sec | 毎秒グレイン数 |
| Pitch | −24〜+24 semitones | ピッチシフト |
| Gain | 0〜1 | 音量 |
| Pan | −1〜+1 | ステレオ定位 |

#### ナビゲーション戦略

| 戦略 | 説明 |
|------|------|
| Random Walk | 隣接ノードをランダムに渡り歩く |
| Grid Traverse | メッシュを規則的に横断（X/Y/Z軸方向） |
| Target Seek | 指定したノードへ向かって最短経路を移動 |
| Geodesic Orbit | メッシュ表面の測地線上を周回 |
| Energy Follow | エネルギー勾配に沿って最大値方向へ移動 |
| Freeze | 現在位置に留まってグレインを放出 |

#### グレイン発音ロジック

エージェントの現在ノード情報からグレインパラメータを決定する：

```typescript
const emitGrain = (agent: Agent, node: Node) => {
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.playbackRate.value = semitoneToRate(agent.pitch);

  // ノードの time プロパティが読み取り開始位置
  source.start(scheduledTime, node.time, agent.grainSize);

  const env = ctx.createGain();
  applyWindowEnvelope(env, scheduledTime, agent.grainSize, 'hanning');

  const panner = ctx.createStereoPanner();
  panner.pan.value = agent.pan + (Math.random() - 0.5) * agent.panSpread;

  source.connect(env).connect(panner).connect(agentGain);
};
```

---

### 2.5 CuboidFX（DSPインタラクティブ）

3D空間に配置できる**直方体型のエフェクトゾーン**。サウンドエージェントとの**近接距離**に応じてエフェクト強度が変化する。

最大8個のCuboidFXを3D空間に自由配置できる。

#### 利用可能なエフェクトタイプ

| タイプ | 制御パラメータ | 近接効果 |
|--------|-------------|---------|
| Reverb | Room Size / Wet | 近いほど残響が深くなる |
| Delay | Time / Feedback / Wet | 近いほどディレイが強くかかる |
| Filter LP | Cutoff / Resonance | 近いほどカットオフが下がる（篭もる） |
| Filter HP | Cutoff / Resonance | 近いほどカットオフが上がる（細くなる） |
| Pitch Shift | Semitones | 近いほどピッチが変化する |
| Grain Scatter | Scatter Amount | 近いほどグレイン位置が散乱する |
| Distortion | Drive / Mix | 近いほど歪みが増す |
| Freeze | − | ゾーン内でエージェントが停止してドローンを生成 |

#### 近接計算

```typescript
const getInfluence = (agent: Agent, cuboid: CuboidFX): number => {
  const dist = vec3Distance(agent.position, cuboid.center);
  const radius = cuboid.influenceRadius;
  // 距離が0なら influence=1、radius 以上なら 0
  return Math.max(0, 1 - dist / radius);
};
```

---

### 2.6 アイソモーフ（Isomorph）

同じ音声素材から**異なるパラメータで生成した複数のジオメトリ状態**を保存し、状態間をモーフィングできる機能。

- 最大4つの状態（State A/B/C/D）を保存
- 状態間のモーフ位置（0〜1）をノブ・LFO・MIDIでコントロール
- モーフィング中はノードの座標・エネルギー値が補間され、それがリアルタイムでシンセシスパラメータに反映される
- 用途例：「密なメッシュ」と「疎なメッシュ」の間をゆっくり変化させてテクスチャを変える

```typescript
const morphGeometry = (stateA: Geometry, stateB: Geometry, t: number): Geometry => {
  return {
    nodes: stateA.nodes.map((n, i) => ({
      ...n,
      position: lerpVec3(n.position, stateB.nodes[i].position, t),
      energy: lerp(n.energy, stateB.nodes[i].energy, t),
    })),
  };
};
```

---

### 2.7 キー検出 & ハーモナイザー

#### キー検出

| 項目 | 詳細 |
|------|------|
| アルゴリズム | Krumhansl-Schmuckler（クロマベクトル相関法） |
| 入力 | AudioBuffer 全体を FFT 解析 → 12次元クロマベクトル生成 |
| 出力 | 検出キー（例: `C Major` / `A minor`）＋ 信頼度スコア（0〜1） |
| 手動オーバーライド | 検出結果が違う場合に手動でキー・スケールを選択可能 |
| 再検出 | ファイル読み込み時に自動実行、ボタンで任意に再実行 |

**対応スケール**

```
Major / Natural Minor / Harmonic Minor / Melodic Minor
Dorian / Phrygian / Lydian / Mixolydian / Locrian
Major Pentatonic / Minor Pentatonic / Chromatic
```

#### ハーモナイザー

各エージェントに対してハーモニーボイスを追加発音する。ボイスごとにピッチオフセットのみ異なる独立したグレインを発音。

| パラメータ | 範囲 | 説明 |
|-----------|------|------|
| Voices | 1〜6 | ハーモニーの声部数 |
| Intervals | スケール音度選択 | 追加する音度を個別に選択（3rd/5th/7th/9th）|
| Spread | 0〜2 oct | ボイスを何オクターブ分散させるか |
| Detune | 0〜50 cent | 各ボイスにデチューンを加えてコーラス感 |
| Voice Mix | 0〜1 per voice | 各ボイスの音量バランス |
| Lock to Scale | ON/OFF | Pitch ノブをスケール音度にスナップ |

**コードモード（インターバルプリセット）**

| モード | インターバル |
|--------|------------|
| Unison | 原音のみ |
| 3rd | +3度 |
| 5th | +5度 |
| Octave | +8度 |
| Triad | +3度 +5度 |
| 7th Chord | +3度 +5度 +7度 |
| Power | +5度 +8度 |
| Custom | 任意選択 |

#### キー検出アルゴリズム（疑似コード）

```typescript
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const detectKey = (audioBuffer: AudioBuffer): KeyResult => {
  const chroma = extractChroma(audioBuffer);
  let best = { key: 0, mode: 'major', score: -Infinity };
  for (let root = 0; root < 12; root++) {
    const majorScore = pearsonCorrelation(chroma, rotate(MAJOR_PROFILE, root));
    const minorScore = pearsonCorrelation(chroma, rotate(MINOR_PROFILE, root));
    if (majorScore > best.score) best = { key: root, mode: 'major', score: majorScore };
    if (minorScore > best.score) best = { key: root, mode: 'minor', score: minorScore };
  }
  return best;
};
```

---

### 2.8 確率的モジュレーター

| タイプ | 説明 | モジュレーション先 |
|--------|------|----------------|
| LFO | 周期的変調（Sine/Tri/Saw/Square/S&H）Rate: 0.01〜20Hz | エージェントSpeed / Pitch / Gain |
| Stochastic | 確率分布に基づくランダム値（Gaussian / Uniform / Cauchy） | ナビゲーション戦略切替 / CuboidFX配置 |
| Envelope Follower | 音声振幅をモジュレーション信号として使用 | エージェントSpeed / Grain Size |
| Step Sequencer | 最大16ステップのシーケンス値 | Pitch / Speed |

---

## 3. UI / UX 設計

### 3.1 レイアウト構成

```
┌──────────────────────────────────────────────────────────────┐
│   HEADER: プロジェクト名 / ファイルロード / プリセット / 保存  │
├───────────────────────────────────────────┬──────────────────┤
│                                           │  AGENT LIST      │
│         3D GEOMETRY VIEW                  │  ┌────────────┐  │
│         (WebGL / Canvas 3D)               │  │ Agent 1 ●  │  │
│                                           │  │ Agent 2 ●  │  │
│   ノード・エッジ・エージェントをリアルタイム │  │ Agent 3 ●  │  │
│   描画。マウスで回転・ズーム。             │  └────────────┘  │
│   CuboidFXを直接ドラッグ配置。            │  SCALE LAYERS    │
│                                           │  [Macro][Meso]   │
│                                           │  [Micro]         │
├───────────────────────────────────────────┴──────────────────┤
│   AGENT PARAMETERS（選択中エージェントの詳細）                │
│   Strategy | Speed | Grain Size | Density | Pitch | Pan      │
├─────────────────────────────┬────────────────────────────────┤
│   ISOMORPH                  │   KEY DETECT & HARMONIZER      │
│   [A][B][C][D]  Morph: ──○  │   Key: C Major  Conf: 87%      │
│                             │   Voices: 3  [Triad]  Detune   │
├─────────────────────────────┴────────────────────────────────┤
│   MODULATION                                                 │
│   LFO1 | LFO2 | Stochastic | Env Follow | Step Seq          │
├──────────────────────────────────────────────────────────────┤
│   TRANSPORT: Play / Stop / Record  |  Master Volume          │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 3Dビジュアライゼーション（コアビュー）

**3D Geometry View**
- WebGL（Three.js）でノード・エッジ・メッシュをリアルタイム描画
- Macro/Meso/Micro の3レイヤーを色分け表示、個別に表示切替
- エージェントは発光する球体として表示、移動軌跡を残光で描画
- CuboidFXは半透明の直方体として表示、影響範囲を可視化
- アイソモーフのモーフィング時はノード座標がアニメーション

**Wave Preview**（サブビュー）
- 音声波形の横断表示（参照用）
- 各エージェントの現在時間位置をカラー縦線で表示

### 3.3 コントロールUI

- **ノブ**: SVGベース、マウスドラッグ / スクロール操作、ダブルクリックでリセット
- **エージェントカード**: 選択するとパラメータパネルに詳細表示
- **CuboidFX配置**: 3Dビュー上でドラッグ&ドロップ
- **アイソモーフ**: A/B/C/Dボタンで状態保存、Morphスライダーで補間

---

## 4. 技術スタック

| レイヤー | 技術 | 理由 |
|----------|------|------|
| フレームワーク | React 18 + TypeScript | コンポーネント管理 |
| ビルド | Vite | 高速HMR |
| 3Dレンダリング | Three.js | WebGLラッパー、ノード・メッシュ描画 |
| オーディオ | Web Audio API（ネイティブ） | グレインエンジン |
| スタイル | Tailwind CSS + CSS Variables | ダークテーマ |
| 状態管理 | Zustand | エージェント・ジオメトリ・モジュレーション状態 |
| DSP計算 | Web Workers | オンセット解析・クロマ抽出をメインスレッドから分離 |
| テスト | Vitest | ユニットテスト |

---

## 5. オーディオ & データグラフ

```
AudioBuffer
    │
    ├──▶ [Web Worker] OnsetAnalyzer
    │         ├── MacroDetector (RMS gradient)
    │         ├── MesoDetector  (Spectral Flux)
    │         └── MicroDetector (High-res Spectral Diff)
    │                   │ Node[]  (time, energy, centroid, scale)
    │                   ▼
    │           GeometryBuilder
    │                   │ Delaunay Triangulation
    │                   ▼
    │           Mesh3D { nodes, edges, triangles } × 3 scales
    │
    ├──▶ [Web Worker] KeyDetector (FFT → chroma → K-S)
    │                   │ detectedKey, scale
    │                   ▼
    │           HarmonizerConfig (voicePitches[])
    │
    └──▶ AudioContext
              │
    ┌─────────┴──────────────────────────────────┐
    │  SoundAgent × N (各エージェントの発音系)    │
    │                                            │
    │  GeometryNavigator                         │
    │    └─▶ currentNode (time offset)           │
    │           └─▶ GrainScheduler               │
    │                 ├─ GrainNode (BufferSource) │
    │                 │    ├─ GainNode (envelope) │
    │                 │    └─ StereoPanner        │
    │                 └─ HarmonyVoices × M       │
    │                       └─ GrainNode(+pitch) │
    └─────────┬──────────────────────────────────┘
              │
    AgentMixer (各エージェントのGain合算)
              │
    ┌─────────┴──────────────────────────────┐
    │  CuboidFX Chain (近接距離で強度変化)   │
    │  ConvolverNode (Reverb)  ─────────────┐│
    │  DelayNode     (Delay)   ────────────┐││
    │  BiquadFilter  (Filter)  ───────────┐│││
    └─────────────────────────────────────┘┘┘┘
              │
    DynamicsCompressorNode (Master)
              │
    AudioContext.destination
```

---

## 6. プリセット

| 名前 | 説明 |
|------|------|
| Frozen Crystal | Micro Freeze エージェント + Reverb CuboidFX |
| Drifting Meso | Meso Random Walk + LFO on Speed |
| Harmonic Cloud | Macro Geodesic Orbit + Triad Harmonizer |
| Glitch Fracture | Micro Random Walk 高速 + Distortion CuboidFX |
| Isomorph Morph | 4つのアイソモーフ状態をゆっくり遷移 |
| Deep Space | 全エージェント低速 + 大型 Reverb CuboidFX |

---

## 7. 実装フェーズ

### Phase 1 — コアエンジン（MVP）
- [ ] プロジェクトセットアップ（Vite + React + TS）
- [ ] AudioContext 初期化 + 音声ファイル読み込み・デコード
- [ ] スペクトルフラックスによる Meso オンセット検出（Web Worker）
- [ ] ノード座標の 3D マッピング（X=time, Y=centroid, Z=energy）
- [ ] Delaunay 三角形分割（2D → 3D展開）
- [ ] 単一エージェント（Random Walk）によるグレイン発音

### Phase 2 — 3Dビジュアライゼーション
- [ ] Three.js 導入、ノード・エッジ描画
- [ ] エージェントを発光球体で表示、移動軌跡
- [ ] マウスによる3D回転・ズーム（OrbitControls）
- [ ] Macro / Micro オンセット検出追加、レイヤー表示切替

### Phase 3 — マルチエージェント & ナビゲーション
- [ ] エージェント最大6体、独立パラメータ管理
- [ ] 全ナビゲーション戦略実装（Random Walk / Grid / Target Seek / Geodesic / Energy Follow / Freeze）
- [ ] エージェントカードUI、パラメータパネル

### Phase 4 — CuboidFX
- [ ] CuboidFX データ構造・3D配置UI（ドラッグ&ドロップ）
- [ ] 近接距離計算 → エフェクト強度マッピング
- [ ] 全FXタイプ実装（Reverb / Delay / Filter / Pitch / Scatter / Distortion / Freeze）
- [ ] 影響範囲の可視化

### Phase 5 — キー検出 & ハーモナイザー
- [ ] クロマベクトル抽出（FFT解析）
- [ ] Krumhansl-Schmuckler アルゴリズム実装
- [ ] スケールテーブル定義
- [ ] ハーモナイザーエンジン（ボイス別グレインスケジューラー）
- [ ] KeyDetect / Harmonizer UI

### Phase 6 — アイソモーフ & モジュレーター
- [ ] アイソモーフ状態保存・ロード
- [ ] ジオメトリ間モーフィング（ノード座標補間）
- [ ] LFO × 2、Stochastic、Envelope Follower、Step Sequencer

### Phase 7 — 仕上げ
- [ ] プリセット管理（保存・読み込み）
- [ ] マイク入力
- [ ] 録音・エクスポート（MediaRecorder）
- [ ] パフォーマンス最適化（AudioWorklet移行）

---

## 8. 非機能要件

| 項目 | 目標 |
|------|------|
| レイテンシー | < 30ms（128サンプルバッファー） |
| 最大同時グレイン数 | エージェント6 × 最大50粒 = 最大300粒 |
| オンセット解析時間 | 10秒音声で < 2秒（Web Worker） |
| 3D描画 | 60fps（Three.js、ノード数〜2000まで） |
| ブラウザサポート | Chrome 最新 / Firefox 最新 / Safari 17+ |

---

## 9. デザインガイドライン

- **配色:** ダークテーマ（背景 `#0a0a0c`、Macro `#7c5cfc`紫 / Meso `#3cb4e5`青 / Micro `#e55c8a`ピンク）
- **エージェント:** スケールに対応した色の発光球体
- **CuboidFX:** 半透明の直方体 + 影響圏ワイヤーフレーム表示
- **フォント:** Inter（UI）/ JetBrains Mono（数値）
- **ノブ:** SVGベース、回転アニメーション付き

---

## 10. ディレクトリ構成（予定）

```
src/
├── audio/
│   ├── GrainScheduler.ts        # グレイン発音スケジューラー
│   ├── GrainNode.ts             # 個別グレイン管理
│   ├── AgentManager.ts          # マルチエージェント管理
│   ├── navigation/
│   │   ├── RandomWalk.ts
│   │   ├── GridTraverse.ts
│   │   ├── TargetSeek.ts
│   │   └── GeodesicOrbit.ts
│   ├── analysis/
│   │   ├── OnsetDetector.ts     # Macro/Meso/Micro オンセット検出
│   │   ├── GeometryBuilder.ts   # Delaunay三角形分割 → Mesh3D生成
│   │   └── KeyDetector.ts       # クロマ抽出 + K-Sアルゴリズム
│   ├── harmony/
│   │   ├── scales.ts            # スケールテーブル
│   │   └── Harmonizer.ts        # ボイス別ピッチオフセット計算
│   ├── cuboidfx/
│   │   ├── CuboidFXManager.ts   # 近接計算・FX強度マッピング
│   │   └── effects/
│   │       ├── Reverb.ts
│   │       ├── Delay.ts
│   │       ├── Filter.ts
│   │       └── Distortion.ts
│   └── modulation/
│       ├── LFO.ts
│       ├── Stochastic.ts
│       ├── EnvelopeFollower.ts
│       └── StepSequencer.ts
├── components/
│   ├── GeometryView3D.tsx       # Three.js メインビュー
│   ├── WavePreview.tsx          # 波形サブビュー
│   ├── AgentCard.tsx            # エージェント一覧・選択
│   ├── AgentParamPanel.tsx      # 選択エージェントのパラメータ
│   ├── CuboidFXPanel.tsx        # CuboidFX リスト・配置
│   ├── IsomorphPanel.tsx        # 状態保存・モーフスライダー
│   ├── KeyDetectPanel.tsx       # キー表示・手動選択
│   ├── HarmonizerPanel.tsx      # ボイス・インターバル選択
│   ├── ModulationPanel.tsx      # LFO/Stochastic/Seq
│   └── Knob.tsx
├── store/
│   └── synthStore.ts            # Zustand（全状態管理）
├── workers/
│   └── analysisWorker.ts        # オンセット解析・キー検出（Web Worker）
├── three/
│   ├── NodeMesh.ts              # Three.js ノード描画
│   ├── AgentSphere.ts           # エージェント発光球体
│   └── CuboidFXObject.ts        # CuboidFX 3Dオブジェクト
├── presets/
│   └── index.ts
└── App.tsx
```
