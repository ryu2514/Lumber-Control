// Waiter's Bow Test Analyzer
import { Landmark, TestResult, TestType } from '../../types';
import { calculateAngleBetweenPoints, calculateMovementStability } from '../utils/mathUtils';
import { BaseAnalyzer } from './baseAnalyzer';

export class WaitersBowAnalyzer extends BaseAnalyzer {
  constructor() {
    super(TestType.WAITERS_BOW);
  }

  /**
   * Analyze landmarks for Waiter's Bow test
   * This test assesses lumbar lordosis control during hip flexion
   */
  analyze(landmarks: Landmark[], landmarkHistory: Landmark[][] = []): TestResult {
    // Extract relevant landmarks for lumbar spine and hip analysis
    // Note: Indexes based on MediaPipe Pose landmarks
    const hip = landmarks[23]; // Right hip
    const shoulder = landmarks[11]; // Right shoulder
    const knee = landmarks[25]; // Right knee

    // Calculate the hip flexion angle
    const hipFlexionAngle = calculateAngleBetweenPoints(shoulder, hip, knee);
    
    // Calculate the lumbar stability during the movement
    const stabilityMetrics = calculateMovementStability(landmarkHistory, [11, 23, 24]); // shoulders and hips
    
    // Evaluate performance metrics
    const hipFlexionQuality = this.evaluateHipFlexionQuality(hipFlexionAngle);
    const lumbarStabilityScore = stabilityMetrics.steadinessIndex;
    
    // Calculate overall score (0-100)
    const score = (hipFlexionQuality * 0.6) + (lumbarStabilityScore * 0.4);
    
    // Generate feedback
    let feedback = '';
    if (hipFlexionQuality < 60) {
      feedback += 'Hip flexion needs improvement. Focus on bending from the hip joint while keeping your back stable. ';
    }
    
    if (lumbarStabilityScore < 60) {
      feedback += 'Lumbar stability needs improvement. Try to maintain a neutral spine position during the movement.';
    }
    
    if (score > 80) {
      feedback = 'Excellent lumbar control during hip flexion.';
    }

    // Create and return the test result
    return this.createBaseResult(
      score,
      {
        hipFlexionAngle,
        hipFlexionQuality,
        lumbarStability: lumbarStabilityScore,
        movementRange: stabilityMetrics.movementRange,
        deviationScore: stabilityMetrics.deviationScore
      },
      feedback
    );
  }

  /**
   * Evaluate the quality of hip flexion
   */
  private evaluateHipFlexionQuality(hipFlexionAngle: number): number {
    // Hip flexion angle should ideally be in the range of 50-70 degrees
    // This is a simplified evaluation logic - in a real app this would be more sophisticated
    if (hipFlexionAngle < 30) {
      return 40; // Insufficient flexion
    } else if (hipFlexionAngle > 90) {
      return 60; // Excessive flexion
    } else if (hipFlexionAngle >= 50 && hipFlexionAngle <= 70) {
      return 100; // Optimal range
    } else {
      // Linear interpolation for values between ranges
      return hipFlexionAngle < 50 
        ? 60 + (hipFlexionAngle - 30) * (40 / 20) // 30-50 range
        : 100 - (hipFlexionAngle - 70) * (40 / 20); // 70-90 range
    }
  }
}
