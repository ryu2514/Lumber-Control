// src/inference/analyzers/baseAnalyzer.ts (修正版)

import { Landmark, TestResult, TestType } from '../../types';

export abstract class BaseAnalyzer {
  protected testType: TestType;

  constructor(testType: TestType) {
    this.testType = testType;
  }

  abstract analyze(landmarks: Landmark[], landmarkHistory?: Landmark[][]): TestResult;

  protected createBaseResult(
    score: number,
    metrics: Record<string, number | string>,
    feedback: string
  ): TestResult {
    return {
      score: Math.max(0, Math.min(100, score)),
      metrics,
      feedback,
      timestamp: Date.now(),
    };
  }

  protected calculateDistance(point1: Landmark, point2: Landmark): number {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) +
      Math.pow(point2.y - point1.y, 2) +
      Math.pow(point2.z - point1.z, 2)
    );
  }

  protected validateLandmarks(landmarks: Landmark[], requiredIndices: number[]): boolean {
    return requiredIndices.every(index => {
      const landmark = landmarks[index];
      return landmark && typeof landmark.visibility === 'number' && landmark.visibility > 0.5;
    });
  }
}
