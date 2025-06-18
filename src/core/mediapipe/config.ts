/**
 * MediaPipe Configuration
 * MediaPipe Pose Landmarkerの設定定数
 */

import type { MediaPipeConfig, AnalysisOptions } from './types';

// デフォルトMediaPipe設定
export const DEFAULT_MEDIAPIPE_CONFIG: MediaPipeConfig = {
  modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  delegate: 'GPU',
  runningMode: 'VIDEO',
  numPoses: 1,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  outputSegmentationMasks: false
};

// 高精度設定（臨床用）
export const HIGH_ACCURACY_CONFIG: MediaPipeConfig = {
  ...DEFAULT_MEDIAPIPE_CONFIG,
  modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
  minPoseDetectionConfidence: 0.7,
  minPosePresenceConfidence: 0.7,
  minTrackingConfidence: 0.7
};

// 高速設定（リアルタイム用）
export const HIGH_SPEED_CONFIG: MediaPipeConfig = {
  ...DEFAULT_MEDIAPIPE_CONFIG,
  modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  delegate: 'GPU',
  minPoseDetectionConfidence: 0.3,
  minPosePresenceConfidence: 0.3,
  minTrackingConfidence: 0.3
};

// CDN URLs
export const MEDIAPIPE_CDN = {
  VISION_BUNDLE: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js',
  WASM_PATH: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
};

// デフォルト解析オプション
export const DEFAULT_ANALYSIS_OPTIONS: AnalysisOptions = {
  enableRealTime: true,
  frameRate: 30,
  smoothing: true,
  confidenceThreshold: 0.5
};

// 理学療法評価用設定
export const CLINICAL_ANALYSIS_OPTIONS: AnalysisOptions = {
  enableRealTime: false,
  frameRate: 60,
  smoothing: false,  // 正確な測定のためスムージング無効
  confidenceThreshold: 0.7
};

// パフォーマンス設定
export const PERFORMANCE_THRESHOLDS = {
  MAX_DETECTION_TIME: 100,      // ms
  TARGET_FRAME_RATE: 30,        // fps
  MAX_MEMORY_USAGE: 100,        // MB
  INITIALIZATION_TIMEOUT: 10000 // ms
};

// 可視性閾値設定
export const VISIBILITY_THRESHOLDS = {
  MINIMUM: 0.1,     // 最低可視性
  LOW: 0.3,         // 低可視性
  MEDIUM: 0.5,      // 中可視性
  HIGH: 0.7,        // 高可視性
  EXCELLENT: 0.9    // 最高可視性
};

// ランドマーク品質設定
export const LANDMARK_QUALITY = {
  REQUIRED_POINTS: [
    // 腰椎モーターコントロール評価に必要な主要ポイント
    'LEFT_SHOULDER', 'RIGHT_SHOULDER',  // 肩
    'LEFT_HIP', 'RIGHT_HIP',            // 腰
    'LEFT_KNEE', 'RIGHT_KNEE',          // 膝
    'LEFT_ANKLE', 'RIGHT_ANKLE',        // 足首
    'NOSE'                              // 頭部参照点
  ],
  MINIMUM_VISIBLE_POINTS: 7,  // 評価に必要な最小ポイント数
  REQUIRED_CONFIDENCE: 0.5    // 必要信頼度
};

// エラー設定
export const ERROR_CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,           // ms
  NETWORK_TIMEOUT: 30000,      // ms
  INITIALIZATION_RETRIES: 2
};

// デバッグ設定
export const DEBUG_CONFIG = {
  ENABLE_PERFORMANCE_LOGGING: true,
  LOG_DETECTION_TIME: true,
  LOG_LANDMARK_COUNT: true,
  ENABLE_VISUAL_DEBUG: false
};