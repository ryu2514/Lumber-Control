import { OneEuroFilter } from './oneEuroFilter'

// 3D point interface for world landmarks
interface Point3D {
  x: number
  y: number
  z: number
}

// MediaPipe landmark indices for spinal analysis
export const LANDMARK_INDICES = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28
} as const

// Results interface
export interface SpinalAngles {
  lumbarFlexionAngle: number      // 腰椎屈曲角度
  hipFlexionAngleLeft: number     // 左股関節屈曲角度
  hipFlexionAngleRight: number    // 右股関節屈曲角度
  rawLumbarFlexion: number        // 平滑化前の腰椎屈曲角度
  rawHipFlexionLeft: number       // 平滑化前の左股関節屈曲角度
  rawHipFlexionRight: number      // 平滑化前の右股関節屈曲角度
}

export class SpinalAngleCalculator {
  private lumbarFilter: OneEuroFilter
  private hipLeftFilter: OneEuroFilter
  private hipRightFilter: OneEuroFilter

  constructor() {
    // Configure One Euro Filters for different joint types
    this.lumbarFilter = new OneEuroFilter(30, 1.0, 0.01, 1.0) // More stable for trunk
    this.hipLeftFilter = new OneEuroFilter(30, 1.2, 0.015, 1.0) // Moderate smoothing
    this.hipRightFilter = new OneEuroFilter(30, 1.2, 0.015, 1.0) // Moderate smoothing
  }

  /**
   * Calculate angle between three 3D points
   * @param p1 First point
   * @param p2 Vertex point (angle is measured at this point)
   * @param p3 Third point
   * @returns Angle in degrees
   */
  private calculateAngle3D(p1: Point3D, p2: Point3D, p3: Point3D): number {
    // Vectors from vertex to other points
    const v1 = {
      x: p1.x - p2.x,
      y: p1.y - p2.y,
      z: p1.z - p2.z
    }

    const v2 = {
      x: p3.x - p2.x,
      y: p3.y - p2.y,
      z: p3.z - p2.z
    }

    // Dot product
    const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z

    // Magnitudes
    const magnitude1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z)
    const magnitude2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z)

    if (magnitude1 === 0 || magnitude2 === 0) return 0

    // Calculate angle in radians, then convert to degrees
    const cosAngle = dotProduct / (magnitude1 * magnitude2)
    const clampedCosAngle = Math.max(-1, Math.min(1, cosAngle))
    const angleRad = Math.acos(clampedCosAngle)
    
    return angleRad * (180 / Math.PI)
  }

  /**
   * Calculate lumbar flexion angle using shoulder and hip landmarks
   * @param worldLandmarks Array of world landmarks from MediaPipe
   * @returns Lumbar flexion angle in degrees
   */
  private calculateLumbarFlexionAngle(worldLandmarks: Point3D[]): number {
    const leftShoulder = worldLandmarks[LANDMARK_INDICES.LEFT_SHOULDER]
    const rightShoulder = worldLandmarks[LANDMARK_INDICES.RIGHT_SHOULDER]
    const leftHip = worldLandmarks[LANDMARK_INDICES.LEFT_HIP]
    const rightHip = worldLandmarks[LANDMARK_INDICES.RIGHT_HIP]

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
      return 0
    }

    // Calculate midpoints for more stable trunk alignment
    const shoulderMidpoint: Point3D = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
      z: (leftShoulder.z + rightShoulder.z) / 2
    }

    const hipMidpoint: Point3D = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
      z: (leftHip.z + rightHip.z) / 2
    }

    // Reference point for vertical alignment (above shoulder midpoint)
    const verticalRef: Point3D = {
      x: shoulderMidpoint.x,
      y: shoulderMidpoint.y - 0.1, // 10cm above in world coordinates
      z: shoulderMidpoint.z
    }

    // Calculate trunk angle relative to vertical
    const trunkAngle = this.calculateAngle3D(verticalRef, shoulderMidpoint, hipMidpoint)

    // Convert to flexion angle (0° = upright, positive = forward flexion)
    const flexionAngle = Math.max(0, 90 - trunkAngle)

    return flexionAngle
  }

  /**
   * Calculate hip flexion angle
   * @param worldLandmarks Array of world landmarks
   * @param side 'left' or 'right'
   * @returns Hip flexion angle in degrees
   */
  private calculateHipFlexionAngle(worldLandmarks: Point3D[], side: 'left' | 'right'): number {
    const hipIndex = side === 'left' ? LANDMARK_INDICES.LEFT_HIP : LANDMARK_INDICES.RIGHT_HIP
    const kneeIndex = side === 'left' ? LANDMARK_INDICES.LEFT_KNEE : LANDMARK_INDICES.RIGHT_KNEE
    
    // Use opposite shoulder for trunk reference to avoid bias
    const shoulderIndex = side === 'left' ? LANDMARK_INDICES.RIGHT_SHOULDER : LANDMARK_INDICES.LEFT_SHOULDER

    const hip = worldLandmarks[hipIndex]
    const knee = worldLandmarks[kneeIndex]
    const shoulder = worldLandmarks[shoulderIndex]

    if (!hip || !knee || !shoulder) {
      return 0
    }

    // Create vertical reference point below hip
    const verticalRef: Point3D = {
      x: hip.x,
      y: hip.y + 0.1, // 10cm below hip in world coordinates
      z: hip.z
    }

    // Calculate thigh angle relative to vertical
    const thighAngle = this.calculateAngle3D(verticalRef, hip, knee)

    // Calculate trunk reference line using shoulder-hip vector
    const trunkAngle = this.calculateAngle3D(verticalRef, hip, shoulder)

    // Hip flexion is the angle between trunk and thigh
    // Positive values indicate hip flexion
    let hipFlexion = Math.abs(thighAngle - trunkAngle)

    // Ensure reasonable range (0-180 degrees)
    hipFlexion = Math.max(0, Math.min(180, hipFlexion))

    return hipFlexion
  }

  /**
   * Calculate all spinal angles with One Euro Filter smoothing
   * @param worldLandmarks Array of world landmarks from MediaPipe pose detection
   * @param timestamp Optional timestamp for filtering (uses Date.now() if not provided)
   * @returns Object containing raw and filtered spinal angles
   */
  calculateAngles(worldLandmarks: Point3D[], timestamp?: number): SpinalAngles {
    const currentTime = timestamp || Date.now()

    // Calculate raw angles
    const rawLumbarFlexion = this.calculateLumbarFlexionAngle(worldLandmarks)
    const rawHipFlexionLeft = this.calculateHipFlexionAngle(worldLandmarks, 'left')
    const rawHipFlexionRight = this.calculateHipFlexionAngle(worldLandmarks, 'right')

    // Apply One Euro Filter smoothing
    const lumbarFlexionAngle = this.lumbarFilter.filter(rawLumbarFlexion, currentTime)
    const hipFlexionAngleLeft = this.hipLeftFilter.filter(rawHipFlexionLeft, currentTime)
    const hipFlexionAngleRight = this.hipRightFilter.filter(rawHipFlexionRight, currentTime)

    return {
      lumbarFlexionAngle: Math.round(lumbarFlexionAngle * 100) / 100, // Round to 2 decimal places
      hipFlexionAngleLeft: Math.round(hipFlexionAngleLeft * 100) / 100,
      hipFlexionAngleRight: Math.round(hipFlexionAngleRight * 100) / 100,
      rawLumbarFlexion: Math.round(rawLumbarFlexion * 100) / 100,
      rawHipFlexionLeft: Math.round(rawHipFlexionLeft * 100) / 100,
      rawHipFlexionRight: Math.round(rawHipFlexionRight * 100) / 100
    }
  }

  /**
   * Reset all filters (call when starting new analysis session)
   */
  resetFilters(): void {
    this.lumbarFilter.reset()
    this.hipLeftFilter.reset()
    this.hipRightFilter.reset()
  }

  /**
   * Get average hip flexion angle (useful for bilateral movement analysis)
   */
  getAverageHipFlexion(angles: SpinalAngles): number {
    return Math.round(((angles.hipFlexionAngleLeft + angles.hipFlexionAngleRight) / 2) * 100) / 100
  }

  /**
   * Check if pose landmarks are valid for analysis
   */
  isValidPose(worldLandmarks: Point3D[]): boolean {
    const requiredLandmarks = [
      LANDMARK_INDICES.LEFT_SHOULDER,
      LANDMARK_INDICES.RIGHT_SHOULDER,
      LANDMARK_INDICES.LEFT_HIP,
      LANDMARK_INDICES.RIGHT_HIP,
      LANDMARK_INDICES.LEFT_KNEE,
      LANDMARK_INDICES.RIGHT_KNEE
    ]

    return requiredLandmarks.every(index => {
      const landmark = worldLandmarks[index]
      return landmark && 
             typeof landmark.x === 'number' && 
             typeof landmark.y === 'number' && 
             typeof landmark.z === 'number' &&
             !isNaN(landmark.x) && !isNaN(landmark.y) && !isNaN(landmark.z)
    })
  }
}

// Usage example function
export function analyzePosture(worldLandmarks: Point3D[], calculator: SpinalAngleCalculator): SpinalAngles | null {
  if (!calculator.isValidPose(worldLandmarks)) {
    console.warn('Invalid pose landmarks detected')
    return null
  }

  return calculator.calculateAngles(worldLandmarks)
}

// Export convenience function to create calculator
export function createSpinalAngleCalculator(): SpinalAngleCalculator {
  return new SpinalAngleCalculator()
}