# 腰椎モーターコントロール評価ツール - アーキテクチャ設計

## 🏗️ プロジェクト概要

**MediaPipe Pose Landmarker（runtime = mediapipe）**を使用した理学療法士・柔道整復師向けの腰椎モーターコントロール評価システム

### 🎯 目的
- 動画解析による客観的な腰椎モーターコントロール評価
- 理学療法・柔道整復師の臨床評価の標準化
- リアルタイム・動画ファイル両対応の解析システム

---

## 📁 ディレクトリ構成

```
src/
├── 📦 core/                     # コアライブラリ
│   ├── mediapipe/              # MediaPipe統合
│   │   ├── PoseLandmarker.ts   # Pose Landmarker基底クラス
│   │   ├── types.ts            # MediaPipe型定義
│   │   └── utils.ts            # MediaPipe共通ユーティリティ
│   ├── analytics/              # 解析エンジン
│   │   ├── LumbarAnalyzer.ts   # 腰椎解析基底クラス
│   │   └── MotorControlEvaluator.ts # モーターコントロール評価
│   └── validation/             # データ検証
│       ├── LandmarkValidator.ts # ランドマーク検証
│       └── PostureValidator.ts  # 姿勢検証
│
├── 🧠 domain/                   # ドメインロジック
│   ├── entities/               # エンティティ
│   │   ├── Patient.ts          # 患者情報
│   │   ├── Assessment.ts       # 評価記録
│   │   ├── TestResult.ts       # テスト結果
│   │   └── Pose.ts            # 姿勢データ
│   ├── valueObjects/           # 値オブジェクト
│   │   ├── LumbarAngle.ts     # 腰椎角度
│   │   ├── StabilityScore.ts   # 安定性スコア
│   │   └── MovementQuality.ts  # 動作品質
│   └── services/               # ドメインサービス
│       ├── LumbarControlService.ts # 腰椎コントロール評価
│       └── ClinicalScoreService.ts # 臨床スコア算出
│
├── 🔬 assessment/               # 評価テストモジュール
│   ├── tests/                  # 各種テスト
│   │   ├── StandingHipFlexion/ # 立位股関節屈曲テスト
│   │   │   ├── analyzer.ts     # 解析ロジック
│   │   │   ├── criteria.ts     # 評価基準
│   │   │   └── feedback.ts     # フィードバック生成
│   │   ├── RockBack/          # ロックバックテスト
│   │   │   ├── analyzer.ts
│   │   │   ├── criteria.ts
│   │   │   └── feedback.ts
│   │   ├── SittingKneeExtension/ # 座位膝関節伸展テスト
│   │   │   ├── analyzer.ts
│   │   │   ├── criteria.ts
│   │   │   └── feedback.ts
│   │   └── ProneInstability/   # 腹臥位不安定性テスト
│   │       ├── analyzer.ts
│   │       ├── criteria.ts
│   │       └── feedback.ts
│   ├── protocols/              # 評価プロトコル
│   │   ├── StandardProtocol.ts # 標準評価プロトコル
│   │   └── CustomProtocol.ts   # カスタム評価プロトコル
│   └── scoring/                # スコアリングシステム
│       ├── WeightedScoring.ts  # 重み付きスコア
│       └── NormalizedScoring.ts # 正規化スコア
│
├── 📊 analytics/                # 解析処理
│   ├── realtime/               # リアルタイム解析
│   │   ├── StreamAnalyzer.ts   # ストリーム解析
│   │   └── LiveFeedback.ts     # ライブフィードバック
│   ├── batch/                  # バッチ解析
│   │   ├── VideoAnalyzer.ts    # 動画解析
│   │   └── ReportGenerator.ts  # レポート生成
│   ├── algorithms/             # 解析アルゴリズム
│   │   ├── AngleCalculation.ts # 角度計算
│   │   ├── StabilityAnalysis.ts # 安定性解析
│   │   └── MovementTracking.ts  # 動作追跡
│   └── metrics/                # 評価指標
│       ├── LumbarMetrics.ts    # 腰椎指標
│       └── ControlMetrics.ts   # コントロール指標
│
├── 🎨 presentation/             # プレゼンテーション層
│   ├── components/             # UIコンポーネント
│   │   ├── common/             # 共通コンポーネント
│   │   │   ├── VideoPlayer.tsx
│   │   │   ├── PoseOverlay.tsx
│   │   │   └── ProgressBar.tsx
│   │   ├── assessment/         # 評価関連
│   │   │   ├── TestSelector.tsx
│   │   │   ├── AssessmentPanel.tsx
│   │   │   └── ResultDisplay.tsx
│   │   └── reports/            # レポート関連
│   │       ├── ScoreChart.tsx
│   │       ├── FeedbackPanel.tsx
│   │       └── ExportButton.tsx
│   ├── views/                  # ページコンポーネント
│   │   ├── AssessmentView.tsx  # 評価画面
│   │   ├── ReportView.tsx      # レポート画面
│   │   └── SettingsView.tsx    # 設定画面
│   ├── hooks/                  # カスタムフック
│   │   ├── useMediaPipe.ts     # MediaPipe統合
│   │   ├── useAssessment.ts    # 評価処理
│   │   └── useReports.ts       # レポート処理
│   └── contexts/               # React Context
│       ├── AssessmentContext.tsx
│       └── MediaPipeContext.tsx
│
├── 💾 infrastructure/           # インフラストラクチャ層
│   ├── storage/                # データ保存
│   │   ├── LocalStorage.ts     # ローカルストレージ
│   │   └── IndexedDB.ts        # IndexedDB
│   ├── export/                 # エクスポート機能
│   │   ├── PDFExporter.ts      # PDF出力
│   │   ├── CSVExporter.ts      # CSV出力
│   │   └── JSONExporter.ts     # JSON出力
│   └── media/                  # メディア処理
│       ├── VideoProcessor.ts   # 動画処理
│       └── ImageProcessor.ts   # 画像処理
│
├── 🔧 utils/                    # ユーティリティ
│   ├── math/                   # 数学関数
│   │   ├── geometry.ts         # 幾何計算
│   │   ├── statistics.ts       # 統計計算
│   │   └── interpolation.ts    # 補間処理
│   ├── validation/             # バリデーション
│   │   ├── dataValidation.ts   # データ検証
│   │   └── typeGuards.ts       # 型ガード
│   └── formatters/             # フォーマッター
│       ├── numberFormatter.ts  # 数値フォーマット
│       └── dateFormatter.ts    # 日付フォーマット
│
├── 📝 types/                    # 型定義
│   ├── mediapipe.ts            # MediaPipe型
│   ├── assessment.ts           # 評価型
│   ├── clinical.ts             # 臨床型
│   └── ui.ts                   # UI型
│
└── 🎛️ config/                   # 設定
    ├── mediapipe.ts            # MediaPipe設定
    ├── assessment.ts           # 評価設定
    └── clinical.ts             # 臨床設定
```

---

## 🔧 主要技術スタック

### MediaPipe Runtime
```typescript
// MediaPipe Pose Landmarker設定
const config = {
  runtime: 'mediapipe',
  modelPath: 'pose_landmarker_lite.task',
  delegate: 'GPU',
  numPoses: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
};
```

### 解析エンジン
- **リアルタイム解析**: WebRTC + MediaPipe
- **動画解析**: File API + MediaPipe
- **数学処理**: 3D幾何学計算
- **統計解析**: 動作安定性評価

### UI/UX
- **React 18** + TypeScript
- **Tailwind CSS** + shadcn/ui
- **Zustand** (状態管理)
- **React Hook Form** (フォーム管理)

---

## 🏥 臨床評価プロトコル

### 1. 立位股関節屈曲テスト
```typescript
interface StandingHipFlexionCriteria {
  lumbarControl: {
    weight: 0.4;
    ideal: "腰椎中間位維持";
    measurement: "腰椎屈曲角度";
  };
  hipFlexionRange: {
    weight: 0.3;
    ideal: "80-100度";
    measurement: "股関節屈曲角度";
  };
  kneeStability: {
    weight: 0.2;
    ideal: "膝関節中間位";
    measurement: "膝関節動揺";
  };
  trunkIntegrity: {
    weight: 0.1;
    ideal: "体幹一体性";
    measurement: "肩-腰椎アライメント";
  };
}
```

### 2. ロックバックテスト
```typescript
interface RockBackCriteria {
  lumbarFlexion: {
    weight: 0.4;
    ideal: "制御された腰椎屈曲";
    measurement: "腰椎屈曲速度・範囲";
  };
  movementCompletion: {
    weight: 0.25;
    ideal: "完全な後方移動";
    measurement: "踵-臀部距離";
  };
  headNeckStability: {
    weight: 0.2;
    ideal: "頭頸部中間位";
    measurement: "頭部動揺";
  };
  upperLimbStability: {
    weight: 0.15;
    ideal: "上肢支持安定";
    measurement: "肩関節安定性";
  };
}
```

### 3. 座位膝関節伸展テスト
```typescript
interface SittingKneeExtensionCriteria {
  lumbarControl: {
    weight: 0.4;
    ideal: "腰椎中間位維持";
    measurement: "腰椎屈曲制限";
  };
  kneeExtension: {
    weight: 0.3;
    ideal: "完全膝関節伸展";
    measurement: "膝関節伸展角度";
  };
  trunkStability: {
    weight: 0.2;
    ideal: "体幹安定";
    measurement: "体幹動揺";
  };
  pelvisStability: {
    weight: 0.1;
    ideal: "骨盤安定";
    measurement: "骨盤傾斜";
  };
}
```

---

## 📊 スコアリングシステム

### 総合評価スコア
```typescript
interface ClinicalScore {
  overall: number;          // 総合スコア (0-100)
  lumbarControl: number;    // 腰椎コントロール (0-100)
  movementQuality: number;  // 動作品質 (0-100)
  stability: number;        // 安定性 (0-100)
  compensation: number;     // 代償パターン (0-100)
}
```

### 臨床的解釈
```typescript
interface ClinicalInterpretation {
  level: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
  riskFactors: string[];
  followUp: string;
}
```

---

## 🚀 実装フェーズ

### Phase 1: コア機能 (完了)
- [x] MediaPipe Pose Landmarker統合
- [x] 基本的な3テスト実装
- [x] リアルタイム・動画解析

### Phase 2: 臨床機能強化
- [ ] 腹臥位不安定性テスト追加
- [ ] 詳細な臨床スコアリング
- [ ] 患者データ管理

### Phase 3: レポート・エクスポート
- [ ] PDF/CSV エクスポート
- [ ] 経時的変化追跡
- [ ] 統計分析機能

### Phase 4: 高度な機能
- [ ] AI によるパターン認識
- [ ] クラウド同期
- [ ] 多施設研究対応

---

## 📋 開発ガイドライン

### コーディング規約
```typescript
// 命名規則
interface AssessmentResult {    // PascalCase for interfaces
  testType: TestType;          // camelCase for properties
  CLINICAL_THRESHOLD: number;  // UPPER_CASE for constants
}

// ファイル命名
LumbarControlAnalyzer.ts       // PascalCase for classes
useAssessmentHook.ts          // camelCase for hooks
clinical-constants.ts         // kebab-case for utilities
```

### テスト戦略
```typescript
// 単体テスト
describe('LumbarAngleCalculator', () => {
  test('calculates lumbar flexion angle correctly', () => {
    // テストコード
  });
});

// 統合テスト
describe('Assessment Integration', () => {
  test('complete assessment workflow', () => {
    // ワークフローテスト
  });
});
```

---

この設計により、臨床現場で実用的な腰椎モーターコントロール評価ツールを構築できます。MediaPipe の高精度な姿勢推定と、理学療法の専門知識を組み合わせた、エビデンスベースの評価システムです。