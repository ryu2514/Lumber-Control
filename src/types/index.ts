// Common types for the application

// Landmark type matching MediaPipe's format
// src/types.ts (更新版)

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export enum TestType {
  STANDING_HIP_FLEXION = 'standing_hip_flexion',
  ROCK_BACK = 'rock_back',
  SITTING_KNEE_EXTENSION = 'sitting_knee_extension',
}

export interface TestResult {
  score: number;
  metrics: Record<string, number | string>;
  feedback: string;
  timestamp: number;
}

export interface AppState {
  currentTest: TestType | null;
  testStatus: 'idle' | 'running' | 'completed';
  landmarks: Landmark[] | null;
  analysisResults: Record<TestType, TestResult>;
}

export type TestStatus = 'idle' | 'running' | 'completed';