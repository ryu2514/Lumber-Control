// MediaPipe Types
export interface PoseAnalysisResult {
  landmarks: any
  timestamp: number
  confidence: number
}

export enum TestType {
  STANDING_HIP_FLEXION = 'standing_hip_flexion',
  ROCK_BACK = 'rock_back',
  SITTING_KNEE_EXTENSION = 'sitting_knee_extension'
}

export interface TestAnalysis {
  lumbarStability: number
  trunkControl: number
  movementPattern: number
  compensatoryMovement: number
  recommendations: string[]
}