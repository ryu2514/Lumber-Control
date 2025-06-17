// src/inference/analyzers/waitersBowAnalyzer.ts (新機能追加版)

import { Landmark, TestResult, TestType } from '../../types';
import { calculateAngleBetweenPoints } from '../utils/mathUtils';
import { BaseAnalyzer } from './baseAnalyzer';

export class WaitersBowAnalyzer extends BaseAnalyzer {
  constructor() {
    super(TestType.WAITERS_BOW);
  }

  analyze(landmarkHistory: Landmark[][] = []): TestResult {
    if (landmarkHistory.length === 0) {
      // データがない場合はデフォルト値を返す
      return this.createBaseResult(0, {}, "解析データが不足しています。");
    }

    // 履歴の中から最も深くお辞儀したフレーム（肩のY座標が最も大きい）を探す
    const deepestFrame = landmarkHistory.reduce((deepest, current) => {
      // 左右の肩のY座標の平均値で比較
      const deepestShoulderY = (deepest[11].y + deepest[12].y) / 2;
      const currentShoulderY = (current[11].y + current[12].y) / 2;
      return currentShoulderY > deepestShoulderY ? current : deepest;
    }, landmarkHistory[0]);

    const leftShoulder = deepestFrame[11];
    const rightShoulder = deepestFrame[12];
    const leftHip = deepestFrame[23];
    const rightHip = deepestFrame[24];
    const leftKnee = deepestFrame[25];
    const rightKnee = deepestFrame[26];
    const leftAnkle = deepestFrame[27];
    const rightAnkle = deepestFrame[28];
    const leftEar = deepestFrame[7];

    const shoulder = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2, z: 0, visibility: 1 };
    const hip = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2, z: 0, visibility: 1 };
    const knee = { x: (leftKnee.x + rightKnee.x) / 2, y: (leftKnee.y + rightKnee.y) / 2, z: 0, visibility: 1 };
    const ankle = { x: (leftAnkle.x + rightAnkle.x) / 2, y: (leftAnkle.y + rightAnkle.y) / 2, z: 0, visibility: 1 };

    // ★★★ 新機能：股関節と膝関節の屈曲角度を計算 ★★★
    const hipFlexionAngle = 180 - calculateAngleBetweenPoints(shoulder, hip, knee);
    const kneeFlexionAngle = 180 - calculateAngleBetweenPoints(hip, knee, ankle);

    // 腰椎の代償（頭が体幹より前に出ているか）
    const spineCompensation = Math.abs(leftEar.x - leftShoulder.x);

    // スコア計算
    let score = 100;
    // 理想の股関節屈曲角度90度からの差で減点
    score -= Math.abs(hipFlexionAngle - 90) * 1.2;
    // 膝の屈曲が大きいほど減点
    score -= kneeFlexionAngle * 1.5;
    // 腰椎の代償が大きいほど減点
    score -= spineCompensation * 500;
    
    // フィードバック
    let feedback = `最大到達時の股関節屈曲は ${hipFlexionAngle.toFixed(1)}°、膝関節屈曲は ${kneeFlexionAngle.toFixed(1)}° です。`;
    if (score < 70) {
      if (Math.abs(hipFlexionAngle - 90) > 20) {
        feedback += " 股関節の可動域に課題がある可能性があります。";
      }
      if (kneeFlexionAngle > 20) {
        feedback += " 膝の屈曲で代償する傾向があります。";
      }
      if (spineCompensation > 0.05) {
        feedback += " 腰椎を過度に屈曲させています。体幹を一直線に保つ意識を持ちましょう。";
      }
    } else {
      feedback += " 良好なヒップヒンジ動作です。";
    }

    return this.createBaseResult(
      Math.max(0, Math.min(100, score)), // スコアを0-100の範囲に収める
      {
        '股関節屈曲角度': hipFlexionAngle,
        '膝関節屈曲角度': kneeFlexionAngle,
      },
      feedback
    );
  }
}