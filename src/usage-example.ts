// Usage example for spinal angle calculation with One Euro Filter

import { SpinalAngleCalculator, SpinalAngles, analyzePosture, createSpinalAngleCalculator } from './spinalAngles'

// Example: How to integrate with MediaPipe pose detection
export function exampleUsage() {
  // Create calculator instance
  const angleCalculator = createSpinalAngleCalculator()

  // Simulate MediaPipe pose detection results (worldLandmarks)
  const mockWorldLandmarks = [
    // ... 33 landmarks (only showing relevant ones for this example)
    { x: 0, y: 0, z: 0 }, // 0: NOSE
    ...Array(10).fill({ x: 0, y: 0, z: 0 }), // 1-10: Other landmarks
    { x: -0.15, y: -0.2, z: -0.05 }, // 11: LEFT_SHOULDER
    { x: 0.15, y: -0.2, z: -0.05 },  // 12: RIGHT_SHOULDER
    ...Array(10).fill({ x: 0, y: 0, z: 0 }), // 13-22: Other landmarks
    { x: -0.1, y: 0.1, z: -0.02 },   // 23: LEFT_HIP
    { x: 0.1, y: 0.1, z: -0.02 },    // 24: RIGHT_HIP
    { x: -0.1, y: 0.5, z: 0.05 },    // 25: LEFT_KNEE
    { x: 0.1, y: 0.5, z: 0.05 },     // 26: RIGHT_KNEE
    { x: -0.1, y: 0.9, z: 0.02 },    // 27: LEFT_ANKLE
    { x: 0.1, y: 0.9, z: 0.02 },     // 28: RIGHT_ANKLE
    ...Array(4).fill({ x: 0, y: 0, z: 0 }), // 29-32: Other landmarks
  ]

  // Analyze pose and get angles
  const angles = analyzePosture(mockWorldLandmarks, angleCalculator)
  
  if (angles) {
    console.log('Spinal Angles:', angles)
    
    // Use angles for clinical assessment
    assessMovement(angles)
  }

  // For continuous analysis (e.g., during video processing)
  // Call analyzePosture() for each frame with timestamp
  const timestamp = Date.now()
  const anglesWithTime = angleCalculator.calculateAngles(mockWorldLandmarks, timestamp)
  
  return anglesWithTime
}

// Clinical assessment function
function assessMovement(angles: SpinalAngles): void {
  console.log(`腰椎屈曲角度: ${angles.lumbarFlexionAngle}°`)
  console.log(`左股関節屈曲角度: ${angles.hipFlexionAngleLeft}°`)
  console.log(`右股関節屈曲角度: ${angles.hipFlexionAngleRight}°`)
  
  // Clinical thresholds
  if (angles.lumbarFlexionAngle > 30) {
    console.log('⚠️ 腰椎過屈曲を検出')
  }
  
  const hipAsymmetry = Math.abs(angles.hipFlexionAngleLeft - angles.hipFlexionAngleRight)
  if (hipAsymmetry > 15) {
    console.log('⚠️ 股関節屈曲の左右差を検出')
  }
}

// Integration with MediaPipe in React component
export class RealtimePoseAnalyzer {
  private angleCalculator: SpinalAngleCalculator
  private analysisCallback?: (angles: SpinalAngles) => void

  constructor(callback?: (angles: SpinalAngles) => void) {
    this.angleCalculator = createSpinalAngleCalculator()
    this.analysisCallback = callback
  }

  // Call this method for each pose detection result
  analyzePoseFrame(poseResult: any): SpinalAngles | null {
    if (!poseResult?.worldLandmarks?.[0]) {
      return null
    }

    const worldLandmarks = poseResult.worldLandmarks[0]
    const angles = analyzePosture(worldLandmarks, this.angleCalculator)

    if (angles && this.analysisCallback) {
      this.analysisCallback(angles)
    }

    return angles
  }

  resetAnalysis(): void {
    this.angleCalculator.resetFilters()
  }
}

// Export example for easy testing
export { exampleUsage }