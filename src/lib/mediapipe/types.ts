import { PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision'

export interface MediaPipeConfig {
  baseOptions: {
    modelAssetPath: string
    delegate: 'GPU' | 'CPU'
  }
  runningMode: 'IMAGE' | 'VIDEO'
  numPoses: number
  minPoseDetectionConfidence: number
  minPosePresenceConfidence: number
  minTrackingConfidence: number
  outputSegmentationMasks: boolean
}

export interface PoseAnalysisResult {
  landmarks: PoseLandmarkerResult
  timestamp: number
  confidence: number
}

export interface TestResult {
  testType: TestType
  score: number
  analysis: TestAnalysis
  timestamp: Date
}

export interface TestAnalysis {
  lumbarStability: number
  trunkControl: number
  movementPattern: number
  compensatoryMovement: number
  recommendations: string[]
}

export enum TestType {
  STANDING_HIP_FLEXION = 'standing_hip_flexion',
  ROCK_BACK = 'rock_back',
  SITTING_KNEE_EXTENSION = 'sitting_knee_extension'
}

export enum PoseLandmarkType {
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

export interface MediaPipeService {
  poseLandmarker: PoseLandmarker | null
  initialize(): Promise<void>
  detectPose(imageSource: HTMLVideoElement | HTMLImageElement): Promise<PoseAnalysisResult | null>
  cleanup(): void
}