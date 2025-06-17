// src/inference/utils/mathUtils.ts (更新版)

import { Landmark, StabilityMetrics } from '../../types';

export function calculateAngleBetweenPoints(
  point1: Landmark,
  vertex: Landmark,
  point2: Landmark
): number {
  const vector1 = {
    x: point1.x - vertex.x,
    y: point1.y - vertex.y,
    z: point1.z - vertex.z
  };
  
  const vector2 = {
    x: point2.x - vertex.x,
    y: point2.y - vertex.y,
    z: point2.z - vertex.z
  };
  
  const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y + vector1.z * vector2.z;
  const magnitude1 = Math.sqrt(vector1.x ** 2 + vector1.y ** 2 + vector1.z ** 2);
  const magnitude2 = Math.sqrt(vector2.x ** 2 + vector2.y ** 2 + vector2.z ** 2);
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  const cosineAngle = dotProduct / (magnitude1 * magnitude2);
  const clampedCosine = Math.max(-1, Math.min(1, cosineAngle));
  
  return Math.acos(clampedCosine) * (180 / Math.PI);
}

export function calculateDistance(point1: Landmark, point2: Landmark): number {
  return Math.sqrt(
    Math.pow(point2.x - point1.x, 2) +
    Math.pow(point2.y - point1.y, 2) +
    Math.pow(point2.z - point1.z, 2)
  );
}

export function calculateMovementStability(
  landmarkHistory: Landmark[][],
  landmarkIndices: number[]
): StabilityMetrics {
  if (landmarkHistory.length < 2) {
    return {
      steadinessIndex: 50,
      averageMovement: 0,
      maxDeviation: 0
    };
  }

  let totalMovement = 0;
  let maxDeviation = 0;
  let validFrameCount = 0;

  // 各フレーム間での指定されたランドマークの移動量を計算
  for (let i = 1; i < landmarkHistory.length; i++) {
    const prevFrame = landmarkHistory[i - 1];
    const currFrame = landmarkHistory[i];
    
    let frameMovement = 0;
    let validLandmarkCount = 0;

    for (const landmarkIndex of landmarkIndices) {
      const prevLandmark = prevFrame[landmarkIndex];
      const currLandmark = currFrame[landmarkIndex];

      if (prevLandmark && currLandmark && 
          prevLandmark.visibility > 0.5 && currLandmark.visibility > 0.5) {
        const movement = calculateDistance(prevLandmark, currLandmark);
        frameMovement += movement;
        validLandmarkCount++;
        
        if (movement > maxDeviation) {
          maxDeviation = movement;
        }
      }
    }

    if (validLandmarkCount > 0) {
      totalMovement += frameMovement / validLandmarkCount;
      validFrameCount++;
    }
  }

  const averageMovement = validFrameCount > 0 ? totalMovement / validFrameCount : 0;
  
  // 安定性指数の計算（移動量が少ないほど高い値）
  const steadinessIndex = Math.max(0, 100 - (averageMovement * 1000));

  return {
    steadinessIndex,
    averageMovement,
    maxDeviation
  };
}

export function normalizeAngle(angle: number): number {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
