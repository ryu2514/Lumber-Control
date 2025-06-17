// src/inference/analyzers/waitersBowAnalyzer.ts (TypeScript修正版)

import { Landmark, TestResult, TestType } from '../../types';
import { calculateAngleBetweenPoints } from '../utils/mathUtils';
import { BaseAnalyzer } from './baseAnalyzer';

export class WaitersBowAnalyzer extends BaseAnalyzer {
  constructor() {
    super(TestType.WAITERS_BOW);
  }

  analyze(_landmarks: Landmark[], landmarkHistory: Landmark[][] = []): TestResult {
    if (landmarkHistory.length === 0) {
      return this.createBaseResult(0, {}, "解析データが不足しています。");
    }

    try {
      // 履歴の中から最も深くお辞儀したフレーム（肩のY座標が最も大きい）を探す
      const deepestFrame = landmarkHistory.reduce((deepest, current) => {
        // 安全性チェック - ランドマークの存在確認
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
      const requiredLandmarks = [11, 12, 23, 24, 25, 26, 27, 28, 7];
      const missingLandmarks = requiredLandmarks.filter(index => {
        const landmark = deepestFrame[index];
        return !landmark || typeof landmark.visibility !== 'number' || landmark.visibility < 0.5;
      });

      if (missingLandmarks.length > 0) {
        return this.createBaseResult(
          0, 
          {}, 
          `重要なランドマークが検出されませんでした。全身がカメラに映るように調整してください。(不足: ${missingLandmarks.length}個)`
        );
      }

      const leftShoulder = deepestFrame[11]!;
      const rightShoulder = deepestFrame[12]!;
      const leftHip = deepestFrame[23]!;
      const rightHip = deepestFrame[24]!;
      const leftKnee = deepestFrame[25]!;
      const rightKnee = deepestFrame[26]!;
      const leftAnkle = deepestFrame[27]!;
      const rightAnkle = deepestFrame[28]!;
      const leftEar = deepestFrame[7]!;

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

      // 腰椎の代償（頭が体幹より前に出ているか）
      const spineCompensation = Math.abs(leftEar.x - leftShoulder.x);

      // 体幹の傾斜角度（垂直からの角度）
      const trunkAngle = Math.atan2(
        Math.abs(shoulder.x - hip.x), 
        Math.abs(hip.y - shoulder.y)
      ) * (180 / Math.PI);

      // スコア計算（より詳細な評価）
      let score = 100;
      const penalties = [];

      // 股関節屈曲角度の評価（理想: 90度）
      const hipAngleDiff = Math.abs(hipFlexionAngle - 90);
      if (hipAngleDiff > 5) {
        const penalty = Math.min(hipAngleDiff * 1.2, 30);
        score -= penalty;
        penalties.push(`股関節角度偏差: -${penalty.toFixed(1)}点`);
      }

      // 膝関節屈曲の評価（理想: 最小限）
      if (kneeFlexionAngle > 10) {
        const penalty = Math.min(kneeFlexionAngle * 1.5, 25);
        score -= penalty;
        penalties.push(`膝屈曲代償: -${penalty.toFixed(1)}点`);
      }

      // 腰椎代償の評価
      if (spineCompensation > 0.03) {
        const penalty = Math.min(spineCompensation * 400, 20);
        score -= penalty;
        penalties.push(`腰椎代償: -${penalty.toFixed(1)}点`);
      }

      // 体幹傾斜の評価
      if (trunkAngle < 30) {
        const penalty = (30 - trunkAngle) * 0.8;
        score -= penalty;
        penalties.push(`前傾不足: -${penalty.toFixed(1)}点`);
      }

      // フィードバック生成
      let feedback = `最大前傾時の股関節屈曲: ${hipFlexionAngle.toFixed(1)}°、膝関節屈曲: ${kneeFlexionAngle.toFixed(1)}°、体幹傾斜: ${trunkAngle.toFixed(1)}°`;

      if (score >= 85) {
        feedback += "\n\n✅ 優秀なヒップヒンジ動作です。股関節の可動性と体幹の安定性が良好です。";
      } else if (score >= 70) {
        feedback += "\n\n⚠️ 概ね良好ですが、改善の余地があります：";
        if (hipAngleDiff > 15) {
          feedback += "\n• 股関節の可動域制限が見られます";
        }
        if (kneeFlexionAngle > 15) {
          feedback += "\n• 膝を使った代償動作があります";
        }
      } else {
        feedback += "\n\n❌ 改善が必要です：";
        if (hipAngleDiff > 20) {
          feedback += "\n• 股関節の可動域に大きな制限があります";
        }
        if (kneeFlexionAngle > 20) {
          feedback += "\n• 膝屈曲による代償が顕著です";
        }
        if (spineCompensation > 0.05) {
          feedback += "\n• 腰椎を過度に曲げています";
        }
        if (trunkAngle < 20) {
          feedback += "\n• 前傾が不十分です";
        }
      }

      // エクササイズ推奨
      if (score < 80) {
        feedback += "\n\n💡 推奨エクササイズ:";
        if (hipAngleDiff > 15) {
          feedback += "\n• ハムストリングスのストレッチ";
          feedback += "\n• 股関節屈曲可動域訓練";
        }
        if (kneeFlexionAngle > 15) {
          feedback += "\n• ヒップヒンジ動作の練習";
          feedback += "\n• 体幹安定性訓練";
        }
      }

      console.log('Analysis penalties:', penalties);

      return this.createBaseResult(
        Math.max(0, Math.min(100, Math.round(score))),
        {
          '股関節屈曲角度': Math.round(hipFlexionAngle * 10) / 10,
          '膝関節屈曲角度': Math.round(kneeFlexionAngle * 10) / 10,
          '体幹傾斜角度': Math.round(trunkAngle * 10) / 10,
          '腰椎代償値': Math.round(spineCompensation * 1000) / 1000,
        },
        feedback
      );

    } catch (error) {
      console.error('Error in WaitersBowAnalyzer:', error);
      return this.createBaseResult(
        0, 
        {}, 
        "解析中にエラーが発生しました。再度お試しください。"
      );
    }
  }
}