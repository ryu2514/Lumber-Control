// src/inference/analyzers/standingHipFlexionAnalyzer.ts

import { Landmark, TestResult, TestType } from '../../types';
import { calculateAngleBetweenPoints } from '../utils/mathUtils';
import { BaseAnalyzer } from './baseAnalyzer';

export class StandingHipFlexionAnalyzer extends BaseAnalyzer {
  constructor() {
    super(TestType.STANDING_HIP_FLEXION);
  }

  analyze(_landmarks: Landmark[], landmarkHistory: Landmark[][] = []): TestResult {
    if (landmarkHistory.length === 0) {
      return this.createBaseResult(0, {}, "解析データが不足しています。");
    }

    try {
      // 履歴の中から最も深く前屈したフレームを探す
      const maxFlexionFrame = landmarkHistory.reduce((deepest, current) => {
        const deepestLeft = deepest[11];
        const deepestRight = deepest[12];
        const currentLeft = current[11];
        const currentRight = current[12];
        
        if (!deepestLeft || !deepestRight || !currentLeft || !currentRight) {
          return deepest;
        }
        
        const deepestShoulderY = (deepestLeft.y + deepestRight.y) / 2;
        const currentShoulderY = (currentLeft.y + currentRight.y) / 2;
        return currentShoulderY > deepestShoulderY ? current : deepest;
      }, landmarkHistory[0]);

      // 必要なランドマークの存在確認
      const requiredLandmarks = [11, 12, 23, 24, 25, 26, 27, 28, 0]; // 鼻も追加
      const missingLandmarks = requiredLandmarks.filter(index => {
        const landmark = maxFlexionFrame[index];
        return !landmark || typeof landmark.visibility !== 'number' || landmark.visibility < 0.5;
      });

      if (missingLandmarks.length > 0) {
        return this.createBaseResult(
          0, 
          {}, 
          `重要なランドマークが検出されませんでした。全身がカメラに映るように調整してください。(不足: ${missingLandmarks.length}個)`
        );
      }

      const leftShoulder = maxFlexionFrame[11]!;
      const rightShoulder = maxFlexionFrame[12]!;
      const leftHip = maxFlexionFrame[23]!;
      const rightHip = maxFlexionFrame[24]!;
      const leftKnee = maxFlexionFrame[25]!;
      const rightKnee = maxFlexionFrame[26]!;
      const leftAnkle = maxFlexionFrame[27]!;
      const rightAnkle = maxFlexionFrame[28]!;
      const nose = maxFlexionFrame[0]!;

      // 中点の計算
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
      const ankle = { 
        x: (leftAnkle.x + rightAnkle.x) / 2, 
        y: (leftAnkle.y + rightAnkle.y) / 2, 
        z: 0, 
        visibility: 1 
      };

      // 角度計算
      const hipFlexionAngle = 180 - calculateAngleBetweenPoints(shoulder, hip, knee);
      const kneeFlexionAngle = 180 - calculateAngleBetweenPoints(hip, knee, ankle);

      // 腰椎屈曲のコントロール評価（頭部-肩の位置関係）
      const lumbarFlexionControl = this.evaluateLumbarFlexionControl(nose, shoulder, hip);

      // 体幹の一体性評価（肩-腰の直線性）
      const trunkIntegrity = this.evaluateTrunkIntegrity(shoulder, hip);

      // 膝関節の安定性（立位での膝屈曲最小化）
      const kneeStability = Math.max(0, 100 - kneeFlexionAngle * 2);

      // スコア計算
      let score = 100;
      const penalties = [];

      // 股関節屈曲角度の評価（理想: 80-100度）
      const hipAngleDiff = hipFlexionAngle < 60 ? (60 - hipFlexionAngle) : 
                          hipFlexionAngle > 120 ? (hipFlexionAngle - 120) : 0;
      if (hipAngleDiff > 0) {
        const penalty = Math.min(hipAngleDiff * 1.5, 40);
        score -= penalty;
        penalties.push(`股関節可動域: -${penalty.toFixed(1)}点`);
      }

      // 腰椎屈曲コントロール
      const lumbarPenalty = (100 - lumbarFlexionControl) * 0.3;
      score -= lumbarPenalty;
      if (lumbarPenalty > 10) {
        penalties.push(`腰椎コントロール: -${lumbarPenalty.toFixed(1)}点`);
      }

      // 膝関節安定性
      const kneePenalty = (100 - kneeStability) * 0.2;
      score -= kneePenalty;
      if (kneePenalty > 10) {
        penalties.push(`膝関節安定性: -${kneePenalty.toFixed(1)}点`);
      }

      // 体幹一体性
      const trunkPenalty = (100 - trunkIntegrity) * 0.2;
      score -= trunkPenalty;
      if (trunkPenalty > 10) {
        penalties.push(`体幹一体性: -${trunkPenalty.toFixed(1)}点`);
      }

      // フィードバック生成
      let feedback = `立位股関節屈曲: ${hipFlexionAngle.toFixed(1)}°、膝関節屈曲: ${kneeFlexionAngle.toFixed(1)}°`;

      if (score >= 85) {
        feedback += "\n\n✅ 優秀な腰椎屈曲コントロールです。股関節主体の動作が良好に行えています。";
      } else if (score >= 70) {
        feedback += "\n\n⚠️ 概ね良好ですが、改善の余地があります：";
        if (lumbarFlexionControl < 70) {
          feedback += "\n• 腰椎の過度な屈曲が見られます";
        }
        if (kneeStability < 70) {
          feedback += "\n• 膝関節で代償しています";
        }
      } else {
        feedback += "\n\n❌ 腰椎屈曲のコントロールに課題があります：";
        if (lumbarFlexionControl < 50) {
          feedback += "\n• 腰椎屈曲が過度です - 体幹を一直線に保つ意識を";
        }
        if (hipFlexionAngle < 60) {
          feedback += "\n• 股関節の可動域が制限されています";
        }
        if (kneeStability < 50) {
          feedback += "\n• 膝屈曲による代償が顕著です";
        }
      }

      // 運動指導
      if (score < 80) {
        feedback += "\n\n💡 推奨アプローチ:";
        if (lumbarFlexionControl < 70) {
          feedback += "\n• 腰椎ニュートラル保持の練習";
          feedback += "\n• 体幹安定化エクササイズ";
        }
        if (hipFlexionAngle < 70) {
          feedback += "\n• ハムストリングス・臀筋の柔軟性改善";
          feedback += "\n• 股関節可動域訓練";
        }
      }

      return this.createBaseResult(
        Math.max(0, Math.min(100, Math.round(score))),
        {
          '股関節屈曲角度': Math.round(hipFlexionAngle * 10) / 10,
          '膝関節屈曲角度': Math.round(kneeFlexionAngle * 10) / 10,
          '腰椎屈曲コントロール': Math.round(lumbarFlexionControl * 10) / 10,
          '体幹一体性': Math.round(trunkIntegrity * 10) / 10,
        },
        feedback
      );

    } catch (error) {
      console.error('Error in StandingHipFlexionAnalyzer:', error);
      return this.createBaseResult(
        0, 
        {}, 
        "解析中にエラーが発生しました。再度お試しください。"
      );
    }
  }

  private evaluateLumbarFlexionControl(nose: Landmark, shoulder: Landmark, hip: Landmark): number {
    // 頭部が肩より前に出すぎていないかを評価
    const headForwardPosition = nose.x - shoulder.x;
    const shoulderHipDistance = Math.abs(shoulder.x - hip.x);
    
    // 相対的な頭部前方位置
    const relativeHeadPosition = Math.abs(headForwardPosition) / (shoulderHipDistance + 0.1);
    
    // スコア化（0.1以下が理想）
    return Math.max(0, 100 - relativeHeadPosition * 500);
  }

  private evaluateTrunkIntegrity(shoulder: Landmark, hip: Landmark): number {
    // 肩と腰の水平方向のアライメント評価
    const horizontalDeviation = Math.abs(shoulder.x - hip.x);
    
    // 体幹の長さに対する相対的な偏位
    const trunkLength = Math.abs(shoulder.y - hip.y);
    const relativeDeviation = horizontalDeviation / (trunkLength + 0.1);
    
    // スコア化（0.1以下が理想）
    return Math.max(0, 100 - relativeDeviation * 300);
  }
}