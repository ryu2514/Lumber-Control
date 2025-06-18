import { MediaPipeConfig } from './types'

export const DEFAULT_MEDIAPIPE_CONFIG: MediaPipeConfig = {
  baseOptions: {
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    delegate: 'GPU'
  },
  runningMode: 'VIDEO',
  numPoses: 1,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  outputSegmentationMasks: false
}

export const HIGH_ACCURACY_CONFIG: MediaPipeConfig = {
  baseOptions: {
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
    delegate: 'GPU'
  },
  runningMode: 'VIDEO',
  numPoses: 1,
  minPoseDetectionConfidence: 0.7,
  minPosePresenceConfidence: 0.7,
  minTrackingConfidence: 0.7,
  outputSegmentationMasks: false
}

export const CLINICAL_EVALUATION_CONFIG = {
  VISIBILITY_THRESHOLD: 0.5,
  CONFIDENCE_THRESHOLD: 0.7,
  FRAME_RATE: 30,
  ANALYSIS_DURATION: 10, // seconds
}