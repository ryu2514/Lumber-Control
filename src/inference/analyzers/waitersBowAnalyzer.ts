// src/inference/analyzers/waitersBowAnalyzer.ts (新機能追加版)

import { Landmark, TestResult, TestType } from '../../types';
import { calculateAngleBetweenPoints, calculateMovementSmoothness } from '../utils/mathUtils';
import { BaseAnalyzer } from './baseAnalyzer';

export class WaitersBowAnalyzer extends BaseAnalyzer {
  constructor() {
    super(TestType.WAITERS_BOW);
  }

  analyze(landmarks: Landmark[], landmarkHistory: Landmark[][] = []): TestResult {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];

    // 左右の平均値を使って、より安定した値を計算
    const shoulder = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2, z: 0, visibility: 1 };
    const hip = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2, z: 0, visibility: 1 };
    const knee = { x: (leftKnee.x + rightKnee.x) / 2, y: (leftKnee.y + rightKnee.y) / 2, z: 0, visibility: 1 };
    const ankle = { x: (leftAnkle.x + rightAnkle.x) / 2, y: (leftAnkle.y + rightAnkle.y) / 2, z: 0, visibility: 1 };

    // ★★★ 新機能：股関節と膝関節の屈曲角度を計算 ★★★
    const hipFlexionAngle = 180 - calculateAngleBetweenPoints(shoulder, hip, knee);
    const kneeFlexionAngle = 180 - calculateAngleBetweenPoints(hip, knee, ankle);

    // 腰椎の動き（肩と腰の垂直距離の変化）を評価
    const spineMovementHistory = landmarkHistory.map(frame => Math.abs(frame[11].y - frame[23].y));
    const spineMovementSmoothness = calculateMovementSmoothness(spineMovementHistory);

    // スコア計算ロジック（例）
    const idealHipAngle = 90;
    const hipScore = 100 - Math.min(100, Math.abs(hipFlexionAngle - idealHipAngle));
    const kneeScore = 100 - Math.min(100, kneeFlexionAngle * 2); // 膝はあまり曲げない方が高スコア
    const spineScore = spineMovementSmoothness;
    const overallScore = (hipScore * 0.5) + (kneeScore * 0.3) + (spineScore * 0.2);

    // フィードバック
    let feedback = `股関節の屈曲角度: ${hipFlexionAngle.toFixed(1)}°, 膝の屈曲角度: ${kneeFlexionAngle.toFixed(1)}°。`;
    if (hipFlexionAngle < 70) feedback += "股関節の屈曲が不足しています。";
    if (kneeFlexionAngle > 30) feedback += "膝が過度に曲がっています。";
    if (spineScore < 70) feedback += "腰椎の動きが不安定です。";

    return this.createBaseResult(
      overallScore,
      {
        '股関節屈曲角度': hipFlexionAngle, // ★★★ 結果に追加 ★★★
        '膝関節屈曲角度': kneeFlexionAngle, // ★★★ 結果に追加 ★★★
        '腰椎の安定性': spineScore,
      },
      feedback
    );
  }
}
