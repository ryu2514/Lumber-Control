import { TestType, TestAnalysis } from '../mediapipe/types'

export interface TestProtocol {
  name: string
  description: string
  instructions: string[]
  duration: number // seconds
  requiredLandmarks: number[]
  evaluationCriteria: EvaluationCriteria
}

export interface EvaluationCriteria {
  lumbarStability: {
    weight: number
    thresholds: {
      excellent: number
      good: number
      fair: number
      poor: number
    }
  }
  trunkControl: {
    weight: number
    thresholds: {
      excellent: number
      good: number
      fair: number
      poor: number
    }
  }
  movementPattern: {
    weight: number
    thresholds: {
      excellent: number
      good: number
      fair: number
      poor: number
    }
  }
  compensatoryMovement: {
    weight: number
    thresholds: {
      excellent: number
      good: number
      fair: number
      poor: number
    }
  }
}

export interface TestSession {
  id: string
  testType: TestType
  startTime: Date
  endTime?: Date
  status: 'preparing' | 'recording' | 'analyzing' | 'completed'
  results?: TestAnalysis
}

export interface LumbarControlMetrics {
  spinalNeutralMaintenance: number // 0-100
  pelvicStability: number // 0-100
  coreActivation: number // 0-100
  movementQuality: number // 0-100
}