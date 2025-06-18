import { PoseAnalysisResult, TestAnalysis, TestType } from '../mediapipe/types'
import { TEST_PROTOCOLS } from '../tests/protocols'
import { LumbarControlMetrics } from '../tests/types'
import { calculateAngle, calculateDistance, getNormalizedLandmark } from './utils'

export class LumbarControlEvaluator {
  private analysisData: PoseAnalysisResult[] = []
  private testType: TestType

  constructor(testType: TestType) {
    this.testType = testType
  }

  addAnalysisData(data: PoseAnalysisResult): void {
    this.analysisData.push(data)
  }

  evaluateTest(): TestAnalysis {
    const protocol = TEST_PROTOCOLS[this.testType]
    const metrics = this.calculateLumbarControlMetrics()
    
    const lumbarStability = this.evaluateMetric(metrics.spinalNeutralMaintenance, protocol.evaluationCriteria.lumbarStability)
    const trunkControl = this.evaluateMetric(metrics.coreActivation, protocol.evaluationCriteria.trunkControl)
    const movementPattern = this.evaluateMetric(metrics.movementQuality, protocol.evaluationCriteria.movementPattern)
    const compensatoryMovement = this.evaluateMetric(metrics.pelvicStability, protocol.evaluationCriteria.compensatoryMovement)

    const recommendations = this.generateRecommendations(metrics)

    return {
      lumbarStability,
      trunkControl,
      movementPattern,
      compensatoryMovement,
      recommendations
    }
  }

  private calculateLumbarControlMetrics(): LumbarControlMetrics {
    if (this.analysisData.length === 0) {
      return {
        spinalNeutralMaintenance: 0,
        pelvicStability: 0,
        coreActivation: 0,
        movementQuality: 0
      }
    }

    switch (this.testType) {
      case TestType.STANDING_HIP_FLEXION:
        return this.evaluateStandingHipFlexion()
      case TestType.ROCK_BACK:
        return this.evaluateRockBack()
      case TestType.SITTING_KNEE_EXTENSION:
        return this.evaluateSittingKneeExtension()
      default:
        throw new Error(`未対応のテストタイプ: ${this.testType}`)
    }
  }

  private evaluateStandingHipFlexion(): LumbarControlMetrics {
    let spinalNeutralSum = 0
    let pelvicStabilitySum = 0
    let coreActivationSum = 0
    let movementQualitySum = 0

    for (const data of this.analysisData) {
      const landmarks = data.landmarks.landmarks[0]
      
      const leftShoulder = getNormalizedLandmark(landmarks, 11)
      const rightShoulder = getNormalizedLandmark(landmarks, 12)
      const leftHip = getNormalizedLandmark(landmarks, 23)
      const rightHip = getNormalizedLandmark(landmarks, 24)
      const leftKnee = getNormalizedLandmark(landmarks, 25)
      const rightKnee = getNormalizedLandmark(landmarks, 26)

      const shoulderLevel = Math.abs(leftShoulder.y - rightShoulder.y)
      const hipLevel = Math.abs(leftHip.y - rightHip.y)
      const kneeFlexionAngle = calculateAngle(leftHip, leftKnee, { x: leftKnee.x, y: leftKnee.y + 0.1, z: leftKnee.z })

      spinalNeutralSum += Math.max(0, 100 - (shoulderLevel * 1000))
      pelvicStabilitySum += Math.max(0, 100 - (hipLevel * 1000))
      coreActivationSum += Math.min(100, Math.max(0, kneeFlexionAngle - 60) * 2)
      movementQualitySum += data.confidence * 100
    }

    const count = this.analysisData.length
    return {
      spinalNeutralMaintenance: spinalNeutralSum / count,
      pelvicStability: pelvicStabilitySum / count,
      coreActivation: coreActivationSum / count,
      movementQuality: movementQualitySum / count
    }
  }

  private evaluateRockBack(): LumbarControlMetrics {
    let spinalNeutralSum = 0
    let pelvicStabilitySum = 0
    let coreActivationSum = 0
    let movementQualitySum = 0

    for (const data of this.analysisData) {
      const landmarks = data.landmarks.landmarks[0]
      
      const leftShoulder = getNormalizedLandmark(landmarks, 11)
      const rightShoulder = getNormalizedLandmark(landmarks, 12)
      const leftHip = getNormalizedLandmark(landmarks, 23)
      const rightHip = getNormalizedLandmark(landmarks, 24)

      const shoulderHipDistance = calculateDistance(
        { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2, z: 0 },
        { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2, z: 0 }
      )

      const shoulderLevel = Math.abs(leftShoulder.y - rightShoulder.y)
      const hipLevel = Math.abs(leftHip.y - rightHip.y)

      spinalNeutralSum += Math.max(0, 100 - Math.abs(shoulderHipDistance - 0.3) * 500)
      pelvicStabilitySum += Math.max(0, 100 - (hipLevel * 1000))
      coreActivationSum += Math.max(0, 100 - (shoulderLevel * 1000))
      movementQualitySum += data.confidence * 100
    }

    const count = this.analysisData.length
    return {
      spinalNeutralMaintenance: spinalNeutralSum / count,
      pelvicStability: pelvicStabilitySum / count,
      coreActivation: coreActivationSum / count,
      movementQuality: movementQualitySum / count
    }
  }

  private evaluateSittingKneeExtension(): LumbarControlMetrics {
    let spinalNeutralSum = 0
    let pelvicStabilitySum = 0
    let coreActivationSum = 0
    let movementQualitySum = 0

    for (const data of this.analysisData) {
      const landmarks = data.landmarks.landmarks[0]
      
      const leftShoulder = getNormalizedLandmark(landmarks, 11)
      const rightShoulder = getNormalizedLandmark(landmarks, 12)
      const leftHip = getNormalizedLandmark(landmarks, 23)
      const rightHip = getNormalizedLandmark(landmarks, 24)
      const leftKnee = getNormalizedLandmark(landmarks, 25)
      const rightKnee = getNormalizedLandmark(landmarks, 26)

      const trunkAngle = calculateAngle(
        { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2, z: 0 },
        { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2, z: 0 },
        { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 + 0.1, z: 0 }
      )

      const shoulderLevel = Math.abs(leftShoulder.y - rightShoulder.y)
      const hipLevel = Math.abs(leftHip.y - rightHip.y)
      const kneeExtensionAngle = calculateAngle(leftHip, leftKnee, { x: leftKnee.x, y: leftKnee.y - 0.1, z: leftKnee.z })

      spinalNeutralSum += Math.max(0, 100 - Math.abs(trunkAngle - 90) * 2)
      pelvicStabilitySum += Math.max(0, 100 - (hipLevel * 1000))
      coreActivationSum += Math.min(100, kneeExtensionAngle * 0.6)
      movementQualitySum += data.confidence * 100
    }

    const count = this.analysisData.length
    return {
      spinalNeutralMaintenance: spinalNeutralSum / count,
      pelvicStability: pelvicStabilitySum / count,
      coreActivation: coreActivationSum / count,
      movementQuality: movementQualitySum / count
    }
  }

  private evaluateMetric(value: number, criteria: any): number {
    if (value >= criteria.thresholds.excellent) return 4
    if (value >= criteria.thresholds.good) return 3
    if (value >= criteria.thresholds.fair) return 2
    return 1
  }

  private generateRecommendations(metrics: LumbarControlMetrics): string[] {
    const recommendations: string[] = []

    if (metrics.spinalNeutralMaintenance < 70) {
      recommendations.push('脊椎中間位の維持練習を重点的に行ってください')
    }
    if (metrics.pelvicStability < 70) {
      recommendations.push('骨盤安定性向上のためのコアトレーニングが必要です')
    }
    if (metrics.coreActivation < 70) {
      recommendations.push('体幹筋群の協調性向上練習を実施してください')
    }
    if (metrics.movementQuality < 70) {
      recommendations.push('動作の質向上のため、ゆっくりとした反復練習を行ってください')
    }

    if (recommendations.length === 0) {
      recommendations.push('良好な腰椎モーターコントロールを維持できています。現在の運動レベルを継続してください。')
    }

    return recommendations
  }

  reset(): void {
    this.analysisData = []
  }
}