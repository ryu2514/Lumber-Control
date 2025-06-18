interface Point3D {
  x: number
  y: number
  z: number
}

export function calculateAngle(point1: Point3D, point2: Point3D, point3: Point3D): number {
  const vector1 = {
    x: point1.x - point2.x,
    y: point1.y - point2.y,
    z: point1.z - point2.z
  }

  const vector2 = {
    x: point3.x - point2.x,
    y: point3.y - point2.y,
    z: point3.z - point2.z
  }

  const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y + vector1.z * vector2.z
  
  const magnitude1 = Math.sqrt(vector1.x ** 2 + vector1.y ** 2 + vector1.z ** 2)
  const magnitude2 = Math.sqrt(vector2.x ** 2 + vector2.y ** 2 + vector2.z ** 2)

  if (magnitude1 === 0 || magnitude2 === 0) return 0

  const cosAngle = dotProduct / (magnitude1 * magnitude2)
  const clampedCosAngle = Math.max(-1, Math.min(1, cosAngle))
  
  return Math.acos(clampedCosAngle) * (180 / Math.PI)
}

export function calculateDistance(point1: Point3D, point2: Point3D): number {
  return Math.sqrt(
    Math.pow(point2.x - point1.x, 2) +
    Math.pow(point2.y - point1.y, 2) +
    Math.pow(point2.z - point1.z, 2)
  )
}

export function getNormalizedLandmark(landmarks: any[], index: number): Point3D {
  if (index >= landmarks.length) {
    return { x: 0, y: 0, z: 0 }
  }
  
  const landmark = landmarks[index]
  return {
    x: landmark.x || 0,
    y: landmark.y || 0,
    z: landmark.z || 0
  }
}

export function calculateMovementStability(landmarks: Point3D[]): number {
  if (landmarks.length < 2) return 0

  let totalVariation = 0
  for (let i = 1; i < landmarks.length; i++) {
    totalVariation += calculateDistance(landmarks[i - 1], landmarks[i])
  }

  return Math.max(0, 100 - (totalVariation * 1000))
}

export function detectCompensatoryMovement(
  primaryJoint: Point3D[],
  compensatoryJoints: Point3D[][]
): number {
  if (primaryJoint.length < 2) return 0

  const primaryMovement = calculateMovementStability(primaryJoint)
  
  let compensatoryMovement = 0
  for (const joint of compensatoryJoints) {
    if (joint.length >= 2) {
      compensatoryMovement += calculateMovementStability(joint)
    }
  }

  const avgCompensatory = compensatoryMovement / compensatoryJoints.length
  
  return Math.max(0, primaryMovement - avgCompensatory)
}