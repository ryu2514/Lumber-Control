import { PoseAnalysisResult, TestAnalysis, TestType } from './types'

export class LumbarControlEvaluator {
  private analysisData: PoseAnalysisResult[] = []
  
  constructor(_testType: TestType) {
    // テストタイプを受け取るが、現在は使用しない
  }

  addAnalysisData(data: PoseAnalysisResult): void {
    this.analysisData.push(data)
  }

  evaluateTest(): TestAnalysis {
    if (this.analysisData.length === 0) {
      return {
        lumbarStability: 1,
        trunkControl: 1,
        movementPattern: 1,
        compensatoryMovement: 1,
        recommendations: ['データが不足しています。テストを再実行してください。']
      }
    }

    const metrics = this.calculateMetrics()
    return {
      lumbarStability: this.scoreMetric(metrics.stability),
      trunkControl: this.scoreMetric(metrics.control),
      movementPattern: this.scoreMetric(metrics.pattern),
      compensatoryMovement: this.scoreMetric(metrics.compensation),
      recommendations: this.generateRecommendations(metrics)
    }
  }

  private calculateMetrics() {
    let stabilitySum = 0
    let controlSum = 0
    let patternSum = 0
    let compensationSum = 0

    for (const data of this.analysisData) {
      const landmarks = data.landmarks.landmarks[0]
      if (!landmarks) continue

      // 簡易評価アルゴリズム
      const leftShoulder = landmarks[11]
      const rightShoulder = landmarks[12]
      const leftHip = landmarks[23]
      const rightHip = landmarks[24]

      if (leftShoulder && rightShoulder && leftHip && rightHip) {
        const shoulderLevel = Math.abs(leftShoulder.y - rightShoulder.y)
        const hipLevel = Math.abs(leftHip.y - rightHip.y)
        
        stabilitySum += Math.max(0, 100 - shoulderLevel * 1000)
        controlSum += Math.max(0, 100 - hipLevel * 1000)
        patternSum += data.confidence * 100
        compensationSum += Math.max(0, 100 - (shoulderLevel + hipLevel) * 500)
      }
    }

    const count = this.analysisData.length
    return {
      stability: stabilitySum / count,
      control: controlSum / count,
      pattern: patternSum / count,
      compensation: compensationSum / count
    }
  }

  private scoreMetric(value: number): number {
    if (value >= 85) return 4 // 優秀
    if (value >= 70) return 3 // 良好
    if (value >= 55) return 2 // 要改善
    return 1 // 要注意
  }

  private generateRecommendations(metrics: any): string[] {
    const recommendations: string[] = []
    
    if (metrics.stability < 70) {
      recommendations.push('脊椎中間位の維持練習を重点的に行ってください')
    }
    if (metrics.control < 70) {
      recommendations.push('体幹筋群の協調性向上練習を実施してください')
    }
    if (metrics.pattern < 70) {
      recommendations.push('動作の質向上のため、ゆっくりとした反復練習を行ってください')
    }
    
    if (recommendations.length === 0) {
      recommendations.push('良好な腰椎モーターコントロールを維持できています')
    }

    return recommendations
  }

  reset(): void {
    this.analysisData = []
  }
}