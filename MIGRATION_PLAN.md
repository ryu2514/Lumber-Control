# 新アーキテクチャへの移行計画

## 🎯 現在の状況 → 新アーキテクチャへの移行

### 📊 現在のファイル構成
```
src/
├── inference/
│   ├── analyzers/              # → assessment/tests/ に移行
│   ├── mediapipe/              # → core/mediapipe/ に移行
│   └── utils/                  # → utils/math/ に移行
├── ui/
│   ├── components/             # → presentation/components/ に移行
│   ├── hooks/                  # → presentation/hooks/ に移行
│   └── views/                  # → presentation/views/ に移行
├── state/
│   └── store/                  # → presentation/contexts/ に移行
└── types/                      # → types/ (そのまま)
```

---

## 🔄 移行手順

### Step 1: コア機能の移行
```bash
# MediaPipe関連の移行
mkdir -p src/core/mediapipe
mv src/inference/mediapipe/* src/core/mediapipe/
mv src/ui/hooks/usePoseAnalysis.ts src/core/mediapipe/PoseLandmarkerService.ts
mv src/ui/hooks/useVideoAnalysis.ts src/core/mediapipe/VideoAnalysisService.ts
```

### Step 2: ドメインロジックの抽出
```bash
# エンティティとサービスの作成
mkdir -p src/domain/{entities,valueObjects,services}
# 新しいドメインファイルを作成
```

### Step 3: 評価テストの再構成
```bash
# 評価テストの移行
mkdir -p src/assessment/tests/{StandingHipFlexion,RockBack,SittingKneeExtension}
mv src/inference/analyzers/standingHipFlexionAnalyzer.ts src/assessment/tests/StandingHipFlexion/analyzer.ts
mv src/inference/analyzers/rockBackAnalyzer.ts src/assessment/tests/RockBack/analyzer.ts
mv src/inference/analyzers/sittingKneeExtensionAnalyzer.ts src/assessment/tests/SittingKneeExtension/analyzer.ts
```

### Step 4: プレゼンテーション層の整理
```bash
# UI関連の移行
mkdir -p src/presentation/{components,views,hooks,contexts}
mv src/ui/* src/presentation/
```

---

## 📋 優先順位付きタスク

### 🔥 High Priority (Week 1-2)
1. **MediaPipe コアサービスの抽出**
   - `PoseLandmarkerService.ts` の作成
   - `VideoAnalysisService.ts` の作成
   - MediaPipe初期化ロジックの統合

2. **ドメインエンティティの定義**
   - `Patient.ts` - 患者情報管理
   - `Assessment.ts` - 評価セッション
   - `TestResult.ts` - テスト結果

3. **評価テストの構造化**
   - 各テストディレクトリの作成
   - `analyzer.ts`, `criteria.ts`, `feedback.ts` の分離

### 🟡 Medium Priority (Week 3-4)
1. **値オブジェクトの実装**
   - `LumbarAngle.ts` - 腰椎角度計算
   - `StabilityScore.ts` - 安定性評価
   - `MovementQuality.ts` - 動作品質

2. **解析アルゴリズムの整理**
   - `AngleCalculation.ts` - 角度計算の統合
   - `StabilityAnalysis.ts` - 安定性解析
   - `MovementTracking.ts` - 動作追跡

3. **UI コンポーネントの再構成**
   - 共通コンポーネントの抽出
   - 評価専用コンポーネントの作成

### 🟢 Low Priority (Week 5-6)
1. **インフラストラクチャの実装**
   - データ保存機能
   - エクスポート機能
   - レポート生成

2. **高度な機能の追加**
   - 統計分析
   - 経時的変化追跡
   - バッチ処理

---

## 🛠️ リファクタリング例

### Before (現在)
```typescript
// src/ui/hooks/usePoseAnalysis.ts
export const usePoseAnalysis = () => {
  // MediaPipe初期化 + UI状態管理が混在
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const initializeMediaPipe = async () => { /* ... */ };
  const detectPose = async () => { /* ... */ };
  // ...
};
```

### After (新アーキテクチャ)
```typescript
// src/core/mediapipe/PoseLandmarkerService.ts
export class PoseLandmarkerService {
  private detector: PoseLandmarker | null = null;
  
  async initialize(config: MediaPipeConfig): Promise<boolean> { /* ... */ }
  async detectPose(video: HTMLVideoElement): Promise<Landmark[]> { /* ... */ }
  // ピュアな MediaPipe 機能のみ
}

// src/presentation/hooks/usePoseAnalysis.ts
export const usePoseAnalysis = () => {
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const poseService = useMemo(() => new PoseLandmarkerService(), []);
  // UI状態管理のみ
};

// src/domain/services/LumbarControlService.ts
export class LumbarControlService {
  analyze(landmarks: Landmark[], testType: TestType): AssessmentResult {
    // ドメインロジックのみ
  }
}
```

---

## 📁 新しいファイル作成リスト

### Core Files
- [ ] `src/core/mediapipe/PoseLandmarkerService.ts`
- [ ] `src/core/mediapipe/types.ts`
- [ ] `src/core/mediapipe/config.ts`

### Domain Files
- [ ] `src/domain/entities/Patient.ts`
- [ ] `src/domain/entities/Assessment.ts`
- [ ] `src/domain/entities/TestResult.ts`
- [ ] `src/domain/valueObjects/LumbarAngle.ts`
- [ ] `src/domain/valueObjects/StabilityScore.ts`
- [ ] `src/domain/services/LumbarControlService.ts`

### Assessment Files
- [ ] `src/assessment/tests/StandingHipFlexion/criteria.ts`
- [ ] `src/assessment/tests/StandingHipFlexion/feedback.ts`
- [ ] `src/assessment/tests/RockBack/criteria.ts`
- [ ] `src/assessment/tests/RockBack/feedback.ts`
- [ ] `src/assessment/tests/SittingKneeExtension/criteria.ts`
- [ ] `src/assessment/tests/SittingKneeExtension/feedback.ts`

### Analytics Files
- [ ] `src/analytics/algorithms/AngleCalculation.ts`
- [ ] `src/analytics/algorithms/StabilityAnalysis.ts`
- [ ] `src/analytics/metrics/LumbarMetrics.ts`

---

## 🧪 テスト戦略

### Unit Tests
```typescript
// src/core/mediapipe/__tests__/PoseLandmarkerService.test.ts
describe('PoseLandmarkerService', () => {
  test('初期化が正常に完了する', async () => {
    const service = new PoseLandmarkerService();
    const result = await service.initialize(testConfig);
    expect(result).toBe(true);
  });
});
```

### Integration Tests
```typescript
// src/assessment/__tests__/AssessmentWorkflow.test.ts
describe('Assessment Workflow', () => {
  test('完全な評価フローが動作する', async () => {
    const result = await runCompleteAssessment(testData);
    expect(result.score).toBeGreaterThan(0);
  });
});
```

---

## 📈 成功指標

### コード品質
- [ ] TypeScript strict mode 準拠
- [ ] テストカバレッジ 90% 以上
- [ ] ESLint/Prettier ルール準拠

### パフォーマンス
- [ ] MediaPipe 初期化時間 < 3秒
- [ ] リアルタイム解析 30fps 維持
- [ ] メモリ使用量 < 100MB

### 保守性
- [ ] 循環依存なし
- [ ] 単一責任原則の遵守
- [ ] インターフェースベースの設計

---

この移行計画により、現在のプロトタイプから本格的な臨床ツールへとスケールアップできる、堅牢で保守しやすいアーキテクチャを構築できます。