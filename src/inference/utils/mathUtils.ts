// Math utility functions for pose analysis
import { Landmark, StabilityMetrics } from '../../types';

/**
 * Calculate angle between three points in 3D space
 * Returns angle in degrees
 */
export function calculateAngleBetweenPoints(
  point1: Landmark, 
  point2: Landmark, 
  point3: Landmark
): number {
  // Calculate vectors from point2 to point1 and point3
  const vector1 = {
    x: point1.x - point2.x,
    y: point1.y - point2.y,
    z: point1.z - point2.z
  };
  
  const vector2 = {
    x: point3.x - point2.x,
    y: point3.y - point2.y,
    z: point3.z - point2.z
  };
  
  // Calculate dot product
  const dotProduct = (vector1.x * vector2.x) + (vector1.y * vector2.y) + (vector1.z * vector2.z);
  
  // Calculate magnitudes
  const magnitude1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y + vector1.z * vector1.z);
  const magnitude2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y + vector2.z * vector2.z);
  
  // Calculate angle in radians and convert to degrees
  const angleRadians = Math.acos(dotProduct / (magnitude1 * magnitude2));
  return angleRadians * (180 / Math.PI);
}

/**
 * Calculate distance between two landmarks
 */
export function calculateDistance(point1: Landmark, point2: Landmark): number {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  const dz = point1.z - point2.z;
  
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate stability metrics based on landmark history
 */
export function calculateMovementStability(
  landmarkHistory: Landmark[][], 
  landmarkIndices: number[]
): StabilityMetrics {
  // If there's not enough history data, return default values
  if (landmarkHistory.length < 2) {
    return {
      deviationScore: 100, 
      movementRange: 0, 
      steadinessIndex: 100
    };
  }

  const positions: number[][] = [];
  
  // Extract positions of specified landmarks across frames
  landmarkHistory.forEach(landmarks => {
    const framePositions = landmarkIndices.flatMap(index => {
      const landmark = landmarks[index];
      return [landmark.x, landmark.y, landmark.z];
    });
    positions.push(framePositions);
  });
  
  // Calculate standard deviation for each dimension
  const deviations = calculateStandardDeviations(positions);
  
  // Calculate total movement range
  const movementRange = calculateTotalRange(positions);
  
  // Calculate average deviation
  const avgDeviation = deviations.reduce((sum, val) => sum + val, 0) / deviations.length;
  
  // Scale deviation to a 0-100 score (lower deviation is better)
  const deviationScore = 100 - Math.min(100, avgDeviation * 1000);
  
  // Calculate steadiness index (combination of deviation and range)
  const steadinessIndex = (deviationScore * 0.7) + (100 - Math.min(100, movementRange * 300)) * 0.3;
  
  return {
    deviationScore,
    movementRange,
    steadinessIndex
  };
}

/**
 * Calculate standard deviations for each dimension across frames
 */
function calculateStandardDeviations(positions: number[][]): number[] {
  const dimensions = positions[0].length;
  const deviations: number[] = [];
  
  for (let dim = 0; dim < dimensions; dim++) {
    const values = positions.map(pos => pos[dim]);
    deviations.push(standardDeviation(values));
  }
  
  return deviations;
}

/**
 * Calculate standard deviation of an array of numbers
 */
function standardDeviation(values: number[]): number {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate total movement range across all frames
 */
function calculateTotalRange(positions: number[][]): number {
  const dimensions = positions[0].length;
  let totalRange = 0;
  
  for (let dim = 0; dim < dimensions; dim++) {
    const values = positions.map(pos => pos[dim]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    totalRange += (max - min);
  }
  
  return totalRange / dimensions;
}
// src/inference/utils/mathUtils.ts の一番下に追加

/**
 * Calculates the smoothness of a series of movements.
 * A higher score (closer to 100) indicates smoother movement.
 * @param data - An array of numbers representing a changing value over time.
 * @returns A smoothness score from 0 to 100.
 */
export const calculateMovementSmoothness = (data: number[]): number => {
  if (data.length < 3) {
    return 50; // Not enough data for analysis
  }

  // Calculate the second derivative (jerk) of the movement
  const jerks = [];
  for (let i = 1; i < data.length - 1; i++) {
    const jerk = (data[i + 1] - 2 * data[i] + data[i - 1]);
    jerks.push(jerk);
  }

  // Calculate the average magnitude of the jerk
  const averageJerk = jerks.reduce((sum, val) => sum + Math.abs(val), 0) / jerks.length;
  
  // Normalize and scale to a 0-100 score.
  // The scaling factor (e.g., 1000) might need tuning based on expected data range.
  const score = 100 - Math.min(100, averageJerk * 1000);
  
  return score;
};