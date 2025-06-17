// src/inference/analyzers/sittingKneeExtensionAnalyzer.ts

import { Landmark, TestResult, TestType } from '../../types';
import { calculateAngleBetweenPoints } from '../utils/mathUtils';
import { BaseAnalyzer } from './baseAnalyzer';

export class SittingKneeExtensionAnalyzer extends BaseAnalyzer {
  constructor() {
    super(TestType.SITTING_KNEE_EXTENSION);
  }

  analyze(_landmarks: Landmark[], landmarkHistory: Landmark[][] = []): TestResult {
    if (landmarkHistory.length === 0) {
      return this.createBaseResult(0, {}, "解析データが不足しています。");
    }

    try {
      // 座位姿勢での膝関節最大伸展フレームを特定
      const maxKneeExtensionFrame = this.findMaxKneeExtensionFrame(landmarkHistory);
      
      if (!maxKneeExtensionFrame) {
        return this.createBaseResult(0, {}, "座位姿勢での膝関節伸展が検出されませんでした。");
      }

      // 必要なランドマークの確認
      const requiredLandmarks = [11, 12, 23, 24, 25, 26, 27, 28, 0]; // 肩、腰、膝、足首、鼻
      const missingLandmarks = requiredLandmarks.filter(index => {
        const landmark = maxKneeExtensionFrame[index];
        return !landmark || typeof landmark.visibility !== 'number' || landmark.visibility < 0.5;
      });

      if (missingLandmarks.length > 0) {
        return this.createBaseResult(
          0, 
          {}, 
          `重要なランドマークが検出されませんでした。座位姿勢で全身がカメラに映るように調整してください。`
        );
      }

      const leftShoulder = maxKneeExtensionFrame[11]!;
      const rightShoulder = maxKneeExtensionFrame[12]!;
      const leftHip = maxKneeExtensionFrame[23]!;
      const rightHip = maxKneeExtensionFrame[24]!;
      const leftKnee = maxKneeExtensionFrame[25]!;
      const rightKnee = maxKneeExtensionFrame[26]!;
      const leftAnkle = maxKneeExtensionFrame[27]!;
      const rightAnkle = maxKneeExtensionFrame[28]!;
      const nose = maxKneeExtensionFrame[0]!;

      // どちらの脚が伸展しているかを判定
      const leftKneeAngle = calculateAngleBetweenPoints(leftHip, leftKnee, leftAnkle);
      const rightKneeAngle = calculateAngleBetweenPoints(rightHip, rightKnee, rightAnkle);
      
      // より伸展している脚を選択
      const isLeftLegExtended = leftKneeAngle > rightKneeAngle;
      const extendingLeg = isLeftLegExtended ? 'left' : 'right';
      const maxKneeAngle = Math.max(leftKneeAngle, rightKneeAngle);

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

      // 腰椎屈曲のコントロール評価（座位での体幹安定性）
      const lumbarFlexionControl = this.evaluateLumbarFlexionControl(nose, shoulder, hip);
      
      // 膝関節伸展の完成度
      const kneeExtensionCompleteness = this.evaluateKneeExtensionCompleteness(maxKneeAngle);
      
      // 体幹の安定性（座位姿勢維持）
      const trunkStability = this.evaluateTrunkStability(shoulder, hip);
      
      // 骨盤の安定性（座位での骨盤ニュートラル維持）
      const pelvicStability = this.evaluatePelvicStability(leftHip, rightHip, hip);

      // 動作中の代償パターン評価
      const compensationScore = this.evaluateCompensationPatterns(landmarkHistory);

      // スコア計算
      let score = 100;
      const penalties = [];

      // 腰椎屈曲コントロール（最重要 - 40%）
      const lumbarPenalty = (100 - lumbarFlexionControl) * 0.4;
      score -= lumbarPenalty;
      if (lumbarPenalty > 15) {
        penalties.push(`腰椎コントロール: -${lumbarPenalty.toFixed(1)}点`);
      }

      // 膝関節伸展完成度（25%）
      const kneePenalty = (100 - kneeExtensionCompleteness) * 0.25;
      score -= kneePenalty;
      if (kneePenalty > 10) {
        penalties.push(`膝伸展完成度: -${kneePenalty.toFixed(1)}点`);
      }

      // 体幹安定性（20%）
      const trunkPenalty = (100 - trunkStability) * 0.2;
      score -= trunkPenalty;
      if (trunkPenalty > 8) {
        penalties.push(`体幹安定性: -${trunkPenalty.toFixed(1)}点`);
      }

      // 骨盤安定性（10%）
      const pelvicPenalty = (100 - pelvicStability) * 0.1;
      score -= pelvicPenalty;

      // 代償パターン（5%）
      const compensationPenalty = (100 - compensationScore) * 0.05;
      score -= compensationPenalty;

      // フィードバック生成
      let feedback = `座位${extendingLeg === 'left' ? '左' : '右'}膝関節伸展: ${maxKneeAngle.toFixed(1)}°`;

      if (score >= 85) {
        feedback += "\n\n✅ 優秀な腰椎屈曲コントロールです。座位での膝関節伸展時に体幹安定性が良好に保たれています。";
      } else if (score >= 70) {
        feedback += "\n\n⚠️ 概ね良好ですが、改善の余地があります：";
        if (lumbarFlexionControl < 70) {
          feedback += "\n• 膝関節伸展時の腰椎過度屈曲が見られます";
        }
        if (kneeExtensionCompleteness < 70) {
          feedback += "\n• 膝関節伸展の可動域が制限されています";
        }
        if (trunkStability < 70) {
          feedback += "\n• 座位での体幹安定性に課題があります";
        }
      } else {
        feedback += "\n\n❌ 座位での腰椎屈曲コントロールに課題があります：";
        if (lumbarFlexionControl < 50) {
          feedback += "\n• 膝関節伸展時の腰椎過度屈曲が顕著です";
        }
        if (kneeExtensionCompleteness < 50) {
          feedback += "\n• 膝関節伸展の可動域が大幅に制限されています";
        }
        if (trunkStability < 50) {
          feedback += "\n• 座位姿勢の維持が困難です";
        }
        if (pelvicStability < 50) {
          feedback += "\n• 骨盤の安定性に問題があります";
        }
      }

      // 運動指導
      if (score < 80) {
        feedback += "\n\n💡 推奨アプローチ:";
        if (lumbarFlexionControl < 70) {
          feedback += "\n• 座位での腰椎ニュートラル保持練習";
          feedback += "\n• 体幹深層筋強化";
        }
        if (kneeExtensionCompleteness < 70) {
          feedback += "\n• ハムストリングス柔軟性改善";
          feedback += "\n• 段階的膝関節伸展訓練";
        }
        if (trunkStability < 70) {
          feedback += "\n• 座位バランス訓練";
          feedback += "\n• 体幹安定化エクササイズ";
        }
      }

      return this.createBaseResult(
        Math.max(0, Math.min(100, Math.round(score))),
        {
          '膝関節伸展角度': Math.round(maxKneeAngle * 10) / 10,
          '腰椎屈曲コントロール': Math.round(lumbarFlexionControl * 10) / 10,
          '体幹安定性': Math.round(trunkStability * 10) / 10,
          '骨盤安定性': Math.round(pelvicStability * 10) / 10,
        },
        feedback
      );

    } catch (error) {
      console.error('Error in SittingKneeExtensionAnalyzer:', error);
      return this.createBaseResult(0, {}, "解析中にエラーが発生しました。");
    }
  }

  private findMaxKneeExtensionFrame(landmarkHistory: Landmark[][]): Landmark[] | null {
    // 膝関節が最も伸展したフレームを特定
    let maxExtensionFrame: Landmark[] | null = null;
    let maxKneeAngle = 0;

    for (const frame of landmarkHistory) {
      const leftHip = frame[23];
      const rightHip = frame[24];
      const leftKnee = frame[25];
      const rightKnee = frame[26];
      const leftAnkle = frame[27];
      const rightAnkle = frame[28];

      if (!leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle) continue;

      const leftKneeAngle = calculateAngleBetweenPoints(leftHip, leftKnee, leftAnkle);
      const rightKneeAngle = calculateAngleBetweenPoints(rightHip, rightKnee, rightAnkle);
      const maxAngle = Math.max(leftKneeAngle, rightKneeAngle);
      
      if (maxAngle > maxKneeAngle) {
        maxKneeAngle = maxAngle;
        maxExtensionFrame = frame;
      }
    }

    return maxExtensionFrame;
  }

  private evaluateLumbarFlexionControl(nose: Landmark, shoulder: Landmark, hip: Landmark): number {
    // 座位での腰椎過度屈曲を評価
    // 頭部-肩-腰のアライメントから腰椎屈曲度を推定
    const headShoulderAngle = Math.atan2(nose.y - shoulder.y, nose.x - shoulder.x) * (180 / Math.PI);
    const shoulderHipAngle = Math.atan2(hip.y - shoulder.y, hip.x - shoulder.x) * (180 / Math.PI);
    
    const spinalAlignment = Math.abs(headShoulderAngle - shoulderHipAngle);
    
    // 理想的な脊柱アライメントは10-30度
    if (spinalAlignment <= 30) {
      return 100 - spinalAlignment * 0.5;
    } else {
      return Math.max(0, 100 - (spinalAlignment - 30) * 2);
    }
  }

  private evaluateKneeExtensionCompleteness(kneeAngle: number): number {
    // 膝関節伸展の完成度評価
    // 理想的な膝関節伸展は160-180度
    if (kneeAngle >= 160) {
      return 100;
    } else if (kneeAngle >= 140) {
      return 70 + (kneeAngle - 140) * 1.5; // 140-160度で70-100点
    } else if (kneeAngle >= 120) {
      return 40 + (kneeAngle - 120) * 1.5; // 120-140度で40-70点
    } else {
      return Math.max(0, kneeAngle * 0.33); // 120度未満は大幅減点
    }
  }

  private evaluateTrunkStability(shoulder: Landmark, hip: Landmark): number {
    // 座位での体幹安定性評価
    const trunkAngle = Math.atan2(hip.y - shoulder.y, hip.x - shoulder.x) * (180 / Math.PI);
    
    // 体幹が垂直に近いほど安定
    const deviationFromVertical = Math.abs(90 - Math.abs(trunkAngle));
    
    return Math.max(0, 100 - deviationFromVertical * 3);
  }

  private evaluatePelvicStability(leftHip: Landmark, rightHip: Landmark, hipCenter: Landmark): number {
    // 骨盤の水平安定性評価
    const pelvicTilt = Math.atan2(rightHip.y - leftHip.y, rightHip.x - leftHip.x) * (180 / Math.PI);
    const tiltDeviation = Math.abs(pelvicTilt);
    
    // 5度以内の傾きが理想
    if (tiltDeviation <= 5) {
      return 100;
    } else {
      return Math.max(0, 100 - (tiltDeviation - 5) * 5);
    }
  }

  private evaluateCompensationPatterns(landmarkHistory: Landmark[][]): number {
    if (landmarkHistory.length < 5) return 50;
    
    // 動作中の代償パターン（体幹の過度な動揺など）を評価
    let totalCompensation = 0;
    let frameCount = 0;
    
    for (let i = 1; i < landmarkHistory.length; i++) {
      const prevFrame = landmarkHistory[i - 1];
      const currFrame = landmarkHistory[i];
      
      const prevShoulder = prevFrame[11];
      const currShoulder = currFrame[11];
      
      if (!prevShoulder || !currShoulder) continue;
      
      // 肩の位置変化量（代償動作の指標）
      const shoulderMovement = Math.sqrt(
        Math.pow(currShoulder.x - prevShoulder.x, 2) + 
        Math.pow(currShoulder.y - prevShoulder.y, 2)
      );
      
      totalCompensation += shoulderMovement;
      frameCount++;
    }
    
    if (frameCount === 0) return 50;
    
    const averageCompensation = totalCompensation / frameCount;
    
    // 小さな動きほど良い（代償が少ない）
    return Math.max(0, 100 - averageCompensation * 500);
  }
}