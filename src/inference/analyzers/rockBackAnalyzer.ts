// src/inference/analyzers/rockBackAnalyzer.ts

import { Landmark, TestResult, TestType } from '../../types';
import { calculateAngleBetweenPoints } from '../utils/mathUtils';
import { BaseAnalyzer } from './baseAnalyzer';

export class RockBackAnalyzer extends BaseAnalyzer {
  constructor() {
    super(TestType.ROCK_BACK);
  }

  analyze(_landmarks: Landmark[], landmarkHistory: Landmark[][] = []): TestResult {
    if (landmarkHistory.length === 0) {
      return this.createBaseResult(0, {}, "解析データが不足しています。");
    }

    try {
      // 四つ這い姿勢での後方移動の解析
      // 最も後方に移動したフレームを特定
      const maxRockBackFrame = this.findMaxRockBackFrame(landmarkHistory);
      
      if (!maxRockBackFrame) {
        return this.createBaseResult(0, {}, "四つ這い姿勢が検出されませんでした。");
      }

      // 必要なランドマークの確認
      const requiredLandmarks = [11, 12, 23, 24, 25, 26, 0, 15, 16]; // 肩、腰、膝、鼻、手首
      const missingLandmarks = requiredLandmarks.filter(index => {
        const landmark = maxRockBackFrame[index];
        return !landmark || typeof landmark.visibility !== 'number' || landmark.visibility < 0.5;
      });

      if (missingLandmarks.length > 0) {
        return this.createBaseResult(
          0, 
          {}, 
          `重要なランドマークが検出されませんでした。四つ這い姿勢で全身がカメラに映るように調整してください。`
        );
      }

      const leftShoulder = maxRockBackFrame[11]!;
      const rightShoulder = maxRockBackFrame[12]!;
      const leftHip = maxRockBackFrame[23]!;
      const rightHip = maxRockBackFrame[24]!;
      const leftKnee = maxRockBackFrame[25]!;
      const rightKnee = maxRockBackFrame[26]!;
      const nose = maxRockBackFrame[0]!;
      const leftWrist = maxRockBackFrame[15]!;
      const rightWrist = maxRockBackFrame[16]!;

      // 中点計算
      const shoulder = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
        z: 0,
        visibility: 1
      };
      const hip = {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2,
        z: 0,
        visibility: 1
      };
      const knee = {
        x: (leftKnee.x + rightKnee.x) / 2,
        y: (leftKnee.y + rightKnee.y) / 2,
        z: 0,
        visibility: 1
      };
      const wrist = {
        x: (leftWrist.x + rightWrist.x) / 2,
        y: (leftWrist.y + rightWrist.y) / 2,
        z: 0,
        visibility: 1
      };

      // 腰椎屈曲・伸展のコントロール評価
      const lumbarFlexionExtensionControl = this.evaluateLumbarControl(shoulder, hip, knee);
      
      // ロックバック動作の完成度
      const rockBackCompleteness = this.evaluateRockBackCompleteness(wrist, shoulder, hip, knee);
      
      // 頭頸部の安定性
      const cervicalStability = this.evaluateCervicalStability(nose, shoulder);
      
      // 上肢支持の安定性
      const upperLimbStability = this.evaluateUpperLimbStability(wrist, shoulder);

      // 動作の滑らかさ（履歴全体を通して）
      const movementSmoothness = this.evaluateMovementSmoothness(landmarkHistory);

      // スコア計算
      let score = 100;
      const penalties = [];

      // 腰椎コントロールの評価（最重要）
      const lumbarPenalty = (100 - lumbarFlexionExtensionControl) * 0.4;
      score -= lumbarPenalty;
      if (lumbarPenalty > 15) {
        penalties.push(`腰椎コントロール: -${lumbarPenalty.toFixed(1)}点`);
      }

      // ロックバック完成度
      const completenessPenalty = (100 - rockBackCompleteness) * 0.25;
      score -= completenessPenalty;
      if (completenessPenalty > 10) {
        penalties.push(`動作完成度: -${completenessPenalty.toFixed(1)}点`);
      }

      // 頭頸部安定性
      const cervicalPenalty = (100 - cervicalStability) * 0.15;
      score -= cervicalPenalty;

      // 上肢安定性
      const upperLimbPenalty = (100 - upperLimbStability) * 0.1;
      score -= upperLimbPenalty;

      // 動作滑らかさ
      const smoothnessPenalty = (100 - movementSmoothness) * 0.1;
      score -= smoothnessPenalty;

      // フィードバック生成
      let feedback = `ロックバック動作の解析結果`;

      if (score >= 85) {
        feedback += "\n\n✅ 優秀な腰椎屈曲・伸展コントロールです。四つ這い位での体重移動が良好に行えています。";
      } else if (score >= 70) {
        feedback += "\n\n⚠️ 概ね良好ですが、改善の余地があります：";
        if (lumbarFlexionExtensionControl < 70) {
          feedback += "\n• 腰椎の屈曲・伸展コントロールに課題があります";
        }
        if (rockBackCompleteness < 70) {
          feedback += "\n• ロックバック動作の可動域が制限されています";
        }
      } else {
        feedback += "\n\n❌ 腰椎屈曲・伸展のコントロールに課題があります：";
        if (lumbarFlexionExtensionControl < 50) {
          feedback += "\n• 腰椎の分節的な動きが制限されています";
        }
        if (rockBackCompleteness < 50) {
          feedback += "\n• 後方への体重移動が不十分です";
        }
        if (cervicalStability < 50) {
          feedback += "\n• 頭頸部の安定性に課題があります";
        }
      }

      // 運動指導
      if (score < 80) {
        feedback += "\n\n💡 推奨アプローチ:";
        if (lumbarFlexionExtensionControl < 70) {
          feedback += "\n• 腰椎分節的可動性訓練";
          feedback += "\n• キャット&カウエクササイズ";
        }
        if (rockBackCompleteness < 70) {
          feedback += "\n• 股関節後方可動域改善";
          feedback += "\n• チャイルドポーズでの体重移動練習";
        }
      }

      return this.createBaseResult(
        Math.max(0, Math.min(100, Math.round(score))),
        {
          '腰椎屈曲伸展コントロール': Math.round(lumbarFlexionExtensionControl * 10) / 10,
          'ロックバック完成度': Math.round(rockBackCompleteness * 10) / 10,
          '頭頸部安定性': Math.round(cervicalStability * 10) / 10,
          '動作滑らかさ': Math.round(movementSmoothness * 10) / 10,
        },
        feedback
      );

    } catch (error) {
      console.error('Error in RockBackAnalyzer:', error);
      return this.createBaseResult(0, {}, "解析中にエラーが発生しました。");
    }
  }

  private findMaxRockBackFrame(landmarkHistory: Landmark[][]): Landmark[] | null {
    // 四つ這い姿勢で最も後方に移動したフレームを特定
    // 肩と腰の相対位置で判定
    let maxRockBackFrame: Landmark[] | null = null;
    let maxRockBackRatio = -1;

    for (const frame of landmarkHistory) {
      const leftShoulder = frame[11];
      const rightShoulder = frame[12];
      const leftHip = frame[23];
      const rightHip = frame[24];

      if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) continue;

      const shoulderX = (leftShoulder.x + rightShoulder.x) / 2;
      const hipX = (leftHip.x + rightHip.x) / 2;
      
      // 腰が肩より後方にある度合い
      const rockBackRatio = hipX - shoulderX;
      
      if (rockBackRatio > maxRockBackRatio) {
        maxRockBackRatio = rockBackRatio;
        maxRockBackFrame = frame;
      }
    }

    return maxRockBackFrame;
  }

  private evaluateLumbarControl(shoulder: Landmark, hip: Landmark, knee: Landmark): number {
    // 腰椎の屈曲度合いを評価
    const hipAngle = calculateAngleBetweenPoints(shoulder, hip, knee);
    
    // 理想的な腰椎屈曲角度は90-120度
    let score = 100;
    if (hipAngle < 80 || hipAngle > 140) {
      score -= Math.abs(hipAngle - 110) * 2;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private evaluateRockBackCompleteness(wrist: Landmark, shoulder: Landmark, hip: Landmark, knee: Landmark): number {
    // 腰-膝の距離と肩-手首の距離の比率で評価
    const hipKneeDistance = Math.sqrt(
      Math.pow(hip.x - knee.x, 2) + Math.pow(hip.y - knee.y, 2)
    );
    const shoulderWristDistance = Math.sqrt(
      Math.pow(shoulder.x - wrist.x, 2) + Math.pow(shoulder.y - wrist.y, 2)
    );
    
    const ratio = hipKneeDistance / (shoulderWristDistance + 0.1);
    
    // 理想的な比率は0.3-0.7
    if (ratio >= 0.3 && ratio <= 0.7) {
      return 100;
    } else if (ratio < 0.3) {
      return Math.max(0, 100 - (0.3 - ratio) * 300);
    } else {
      return Math.max(0, 100 - (ratio - 0.7) * 150);
    }
  }

  private evaluateCervicalStability(nose: Landmark, shoulder: Landmark): number {
    // 頭部の位置安定性を評価
    const headPosition = nose.y - shoulder.y;
    
    // 頭部が肩より上にあるかを確認
    if (headPosition < 0) {
      return Math.max(0, 100 + headPosition * 200);
    }
    
    return 90; // 基本的に安定
  }

  private evaluateUpperLimbStability(wrist: Landmark, shoulder: Landmark): number {
    // 上肢支持の安定性
    const supportDistance = Math.sqrt(
      Math.pow(wrist.x - shoulder.x, 2) + Math.pow(wrist.y - shoulder.y, 2)
    );
    
    // 理想的な支持距離
    if (supportDistance > 0.1 && supportDistance < 0.4) {
      return 100;
    }
    
    return Math.max(0, 100 - Math.abs(supportDistance - 0.25) * 200);
  }

  private evaluateMovementSmoothness(landmarkHistory: Landmark[][]): number {
    if (landmarkHistory.length < 5) return 50;
    
    // 肩の位置変化の滑らかさを評価
    let totalVariation = 0;
    for (let i = 1; i < landmarkHistory.length - 1; i++) {
      const prev = landmarkHistory[i - 1][11];
      const curr = landmarkHistory[i][11];
      const next = landmarkHistory[i + 1][11];
      
      if (!prev || !curr || !next) continue;
      
      const variation = Math.abs((next.x - curr.x) - (curr.x - prev.x));
      totalVariation += variation;
    }
    
    const averageVariation = totalVariation / (landmarkHistory.length - 2);
    return Math.max(0, 100 - averageVariation * 1000);
  }
}
