/**
 * Standing Hip Flexion Test Criteria
 * 立位股関節屈曲テストの評価基準
 */

import type { Landmark } from '../../../core/mediapipe/types';

// 評価項目の重み
export const EVALUATION_WEIGHTS = {
  lumbarControl: 0.4,      // 腰椎コントロール
  hipFlexionRange: 0.3,    // 股関節屈曲可動域
  kneeStability: 0.2,      // 膝関節安定性
  trunkIntegrity: 0.1      // 体幹一体性
} as const;

// 理想的な測定値
export const IDEAL_MEASUREMENTS = {
  hipFlexionAngle: {
    minimum: 80,           // 度
    optimal: 90,           // 度
    maximum: 100           // 度
  },
  lumbarFlexion: {
    maximum: 10            // 度（これ以下に制限）
  },
  kneeDeviation: {
    maximum: 5             // 度（左右偏差）
  },
  trunkAlignment: {
    maximum: 5             // 度（前後傾斜）
  }
} as const;

// スコアリング関数
export const SCORING_FUNCTIONS = {
  /**
   * 腰椎コントロールスコア計算
   * 腰椎屈曲が少ないほど高スコア
   */
  lumbarControl: (lumbarFlexionAngle: number): number => {
    const maxAllowed = IDEAL_MEASUREMENTS.lumbarFlexion.maximum;
    
    if (lumbarFlexionAngle <= maxAllowed) {
      return 100;
    } else if (lumbarFlexionAngle <= maxAllowed * 2) {
      // 線形減少
      return 100 - ((lumbarFlexionAngle - maxAllowed) / maxAllowed) * 50;
    } else {
      return Math.max(0, 50 - (lumbarFlexionAngle - maxAllowed * 2) * 2);
    }
  },

  /**
   * 股関節屈曲可動域スコア計算
   * 理想範囲内で最高スコア
   */
  hipFlexionRange: (hipFlexionAngle: number): number => {
    const { minimum, optimal, maximum } = IDEAL_MEASUREMENTS.hipFlexionAngle;
    
    if (hipFlexionAngle >= minimum && hipFlexionAngle <= maximum) {
      // 理想範囲内：オプティマル値に近いほど高スコア
      const deviation = Math.abs(hipFlexionAngle - optimal);
      const maxDeviation = Math.max(optimal - minimum, maximum - optimal);
      return 100 - (deviation / maxDeviation) * 20; // 80-100点
    } else if (hipFlexionAngle < minimum) {
      // 可動域不足
      const deficit = minimum - hipFlexionAngle;
      return Math.max(0, 80 - deficit * 2);
    } else {
      // 過可動
      const excess = hipFlexionAngle - maximum;
      return Math.max(0, 80 - excess * 1.5);
    }
  },

  /**
   * 膝関節安定性スコア計算
   * 左右の膝の位置偏差が少ないほど高スコア
   */
  kneeStability: (leftKneePos: Landmark, rightKneePos: Landmark): number => {
    const lateralDeviation = Math.abs(leftKneePos.x - rightKneePos.x);
    const verticalDeviation = Math.abs(leftKneePos.y - rightKneePos.y);
    
    // 正規化座標での偏差を角度に変換（近似）
    const totalDeviation = (lateralDeviation + verticalDeviation) * 90;
    const maxAllowed = IDEAL_MEASUREMENTS.kneeDeviation.maximum;
    
    if (totalDeviation <= maxAllowed) {
      return 100;
    } else {
      return Math.max(0, 100 - (totalDeviation - maxAllowed) * 10);
    }
  },

  /**
   * 体幹一体性スコア計算
   * 肩と腰のアライメントが良いほど高スコア
   */
  trunkIntegrity: (shoulderCenter: Landmark, hipCenter: Landmark): number => {
    // 肩と腰の水平位置の差
    const horizontalDeviation = Math.abs(shoulderCenter.x - hipCenter.x);
    
    // 正規化座標での偏差を角度に変換（近似）
    const deviationAngle = horizontalDeviation * 90;
    const maxAllowed = IDEAL_MEASUREMENTS.trunkAlignment.maximum;
    
    if (deviationAngle <= maxAllowed) {
      return 100;
    } else {
      return Math.max(0, 100 - (deviationAngle - maxAllowed) * 8);
    }
  }
} as const;

// 代償パターンの検出
export const COMPENSATION_PATTERNS = {
  /**
   * 膝関節屈曲代償
   * 股関節屈曲不足を膝屈曲で補う
   */
  kneeFlexionCompensation: (hipAngle: number, kneeAngle: number): boolean => {
    return hipAngle < IDEAL_MEASUREMENTS.hipFlexionAngle.minimum && kneeAngle > 10;
  },

  /**
   * 腰椎過屈曲代償
   * 股関節可動域不足を腰椎屈曲で補う
   */
  lumbarHyperflexion: (hipAngle: number, lumbarAngle: number): boolean => {
    return (
      hipAngle < IDEAL_MEASUREMENTS.hipFlexionAngle.minimum &&
      lumbarAngle > IDEAL_MEASUREMENTS.lumbarFlexion.maximum
    );
  },

  /**
   * 体重移動代償
   * バランス不良による重心移動
   */
  weightShift: (leftHip: Landmark, rightHip: Landmark): boolean => {
    const hipCenterX = (leftHip.x + rightHip.x) / 2;
    return Math.abs(hipCenterX - 0.5) > 0.1; // 中心から10%以上の偏移
  }
} as const;

// 臨床的解釈
export const CLINICAL_INTERPRETATION = {
  /**
   * スコアレベルの判定
   */
  getScoreLevel: (score: number): 'excellent' | 'good' | 'fair' | 'poor' => {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 55) return 'fair';
    return 'poor';
  },

  /**
   * 臨床的推奨事項の生成
   */
  generateRecommendations: (scores: {
    lumbarControl: number;
    hipFlexionRange: number;
    kneeStability: number;
    trunkIntegrity: number;
  }): string[] => {
    const recommendations: string[] = [];

    if (scores.lumbarControl < 70) {
      recommendations.push(
        '腰椎安定化エクササイズ（プランク、デッドバグ等）の実施',
        '腹横筋の活性化トレーニング'
      );
    }

    if (scores.hipFlexionRange < 70) {
      recommendations.push(
        '股関節屈筋群のストレッチング',
        '股関節可動域改善エクササイズ'
      );
    }

    if (scores.kneeStability < 70) {
      recommendations.push(
        '片脚立位バランストレーニング',
        '膝関節周囲筋の強化'
      );
    }

    if (scores.trunkIntegrity < 70) {
      recommendations.push(
        '体幹安定化エクササイズ',
        '姿勢矯正トレーニング'
      );
    }

    return recommendations;
  },

  /**
   * リスクファクターの特定
   */
  identifyRiskFactors: (scores: {
    lumbarControl: number;
    hipFlexionRange: number;
    kneeStability: number;
    trunkIntegrity: number;
  }): string[] => {
    const riskFactors: string[] = [];

    if (scores.lumbarControl < 50) {
      riskFactors.push('腰痛発症リスク');
    }

    if (scores.hipFlexionRange < 50) {
      riskFactors.push('機能的動作制限');
    }

    if (scores.kneeStability < 50) {
      riskFactors.push('膝関節傷害リスク');
    }

    if (scores.trunkIntegrity < 50) {
      riskFactors.push('姿勢関連障害リスク');
    }

    return riskFactors;
  }
} as const;

// エビデンスベースの基準値
export const EVIDENCE_BASED_NORMS = {
  // 健常成人の正常値（文献値）
  healthyAdults: {
    hipFlexionAngle: { mean: 85, sd: 8 },
    lumbarFlexion: { mean: 5, sd: 3 },
    asymmetryIndex: { mean: 2, sd: 1.5 }
  },
  
  // 腰痛患者の典型値
  lowBackPainPatients: {
    hipFlexionAngle: { mean: 65, sd: 12 },
    lumbarFlexion: { mean: 15, sd: 8 },
    asymmetryIndex: { mean: 8, sd: 4 }
  }
} as const;