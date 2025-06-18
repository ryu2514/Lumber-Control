/**
 * MediaPipe Core Types
 * MediaPipe Pose Landmarkerの型定義
 */

// MediaPipe Landmark型
export interface MediaPipeLandmark {
  x: number;        // 正規化座標 (0-1)
  y: number;        // 正規化座標 (0-1)
  z: number;        // 深度情報
  visibility?: number; // 可視性 (0-1)
}

// MediaPipe結果型
export interface MediaPipeResult {
  landmarks?: MediaPipeLandmark[][];
  worldLandmarks?: MediaPipeLandmark[][];
  segmentationMasks?: any[];
}

// MediaPipe設定型
export interface MediaPipeConfig {
  modelAssetPath: string;
  delegate: 'CPU' | 'GPU';
  runningMode: 'IMAGE' | 'VIDEO';
  numPoses: number;
  minPoseDetectionConfidence: number;
  minPosePresenceConfidence: number;
  minTrackingConfidence: number;
  outputSegmentationMasks: boolean;
}

// 内部Landmark型（アプリケーション用）
export interface Landmark {
  x: number;        // 正規化座標
  y: number;        // 正規化座標
  z: number;        // 深度
  visibility: number; // 可視性
}

// Pose Landmarker インスタンス型
export interface PoseLandmarkerInstance {
  detectForVideo(video: HTMLVideoElement, timestamp: number): Promise<MediaPipeResult>;
  close(): void;
}

// MediaPipe初期化結果
export interface InitializationResult {
  success: boolean;
  error?: string;
  detector?: PoseLandmarkerInstance;
}

// 解析オプション
export interface AnalysisOptions {
  enableRealTime: boolean;
  frameRate: number;
  smoothing: boolean;
  confidenceThreshold: number;
}

// ランドマーク点定義 (MediaPipe Pose 33点)
export enum PoseLandmarkType {
  // 顔
  NOSE = 0,
  LEFT_EYE_INNER = 1,
  LEFT_EYE = 2,
  LEFT_EYE_OUTER = 3,
  RIGHT_EYE_INNER = 4,
  RIGHT_EYE = 5,
  RIGHT_EYE_OUTER = 6,
  LEFT_EAR = 7,
  RIGHT_EAR = 8,
  MOUTH_LEFT = 9,
  MOUTH_RIGHT = 10,
  
  // 上半身
  LEFT_SHOULDER = 11,
  RIGHT_SHOULDER = 12,
  LEFT_ELBOW = 13,
  RIGHT_ELBOW = 14,
  LEFT_WRIST = 15,
  RIGHT_WRIST = 16,
  LEFT_PINKY = 17,
  RIGHT_PINKY = 18,
  LEFT_INDEX = 19,
  RIGHT_INDEX = 20,
  LEFT_THUMB = 21,
  RIGHT_THUMB = 22,
  
  // 下半身
  LEFT_HIP = 23,
  RIGHT_HIP = 24,
  LEFT_KNEE = 25,
  RIGHT_KNEE = 26,
  LEFT_ANKLE = 27,
  RIGHT_ANKLE = 28,
  LEFT_HEEL = 29,
  RIGHT_HEEL = 30,
  LEFT_FOOT_INDEX = 31,
  RIGHT_FOOT_INDEX = 32
}

// MediaPipe エラー型
export interface MediaPipeError {
  code: 'INITIALIZATION_FAILED' | 'DETECTION_FAILED' | 'INVALID_INPUT' | 'NETWORK_ERROR';
  message: string;
  details?: any;
}

// デバッグ情報型
export interface MediaPipeDebugInfo {
  isInitialized: boolean;
  modelLoaded: boolean;
  lastDetectionTime: number;
  performanceStats: {
    averageDetectionTime: number;
    frameRate: number;
    memoryUsage: number;
  };
}

// Global MediaPipe Vision type
declare global {
  interface Window {
    MediaPipeTasksVision?: {
      FilesetResolver: {
        forVisionTasks(wasmLoaderPath: string): Promise<any>;
      };
      PoseLandmarker: {
        createFromOptions(filesetResolver: any, options: any): Promise<PoseLandmarkerInstance>;
      };
    };
  }
}