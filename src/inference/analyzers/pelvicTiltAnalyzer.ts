// Pelvic Tilt Test Analyzer
import { Landmark, TestResult, TestType } from '../../types';
import { calculateAngleBetweenPoints, calculateMovementStability } from '../utils/mathUtils';
import { BaseAnalyzer } from './baseAnalyzer';

export class PelvicTiltAnalyzer extends BaseAnalyzer {
  constructor() {
    super(TestType.PELVIC_TILT);
  }

  /**
   * Analyze landmarks for Pelvic Tilt test
   * This test assesses the ability to control anterior and posterior pelvic tilt
   */
  analyze(landmarks: Landmark[], landmarkHistory: Landmark[][] = []): TestResult {
    // Extract relevant landmarks for pelvic tilt analysis
    const leftHip = landmarks[23];
    const rightHip = landmarks[24]; 
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    
    // Calculate pelvic tilt angle (relative to vertical axis)
    const pelvicAngle = this.calculatePelvicTiltAngle(leftHip, rightHip, leftShoulder, rightShoulder);
    
    // Calculate the lumbar stability during the movement
    const stabilityMetrics = calculateMovementStability(landmarkHistory, [23, 24, 11, 12]); // hips and shoulders
    
    // Evaluate range of pelvic tilt motion
    const tiltRangeQuality = this.evaluateTiltRange(landmarkHistory);
    const controlQuality = this.evaluateControlQuality(pelvicAngle, stabilityMetrics.steadinessIndex);
    
    // Calculate overall score (0-100)
    const score = (tiltRangeQuality * 0.5) + (controlQuality * 0.5);
    
    // Generate feedback
    let feedback = '';
    if (tiltRangeQuality < 60) {
      feedback += 'Limited range of pelvic tilt motion. Practice increasing your anterior and posterior tilt control. ';
    }
    
    if (controlQuality < 60) {
      feedback += 'Pelvic tilt control needs improvement. Focus on smoother transitions between anterior and posterior tilt.';
    }
    
    if (score > 80) {
      feedback = 'Excellent pelvic tilt control with good range of motion.';
    }

    // Create and return the test result
    return this.createBaseResult(
      score,
      {
        pelvicAngle,
        tiltRangeQuality,
        controlQuality,
        movementSmoothness: stabilityMetrics.steadinessIndex
      },
      feedback
    );
  }

  /**
   * Calculate the pelvic tilt angle
   */
  private calculatePelvicTiltAngle(
    leftHip: Landmark, 
    rightHip: Landmark, 
    leftShoulder: Landmark, 
    rightShoulder: Landmark
  ): number {
    // Calculate midpoints
    const hipMidpoint = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
      z: (leftHip.z + rightHip.z) / 2
    };
    
    const shoulderMidpoint = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
      z: (leftShoulder.z + rightShoulder.z) / 2
    };
    
    // Create a vertical reference point
    const verticalReference = {
      x: hipMidpoint.x,
      y: hipMidpoint.y - 1, // Vertical down from hip midpoint
      z: hipMidpoint.z
    };
    
    // Calculate angle between vertical and hip-shoulder line
    return calculateAngleBetweenPoints(verticalReference, hipMidpoint, shoulderMidpoint);
  }

  /**
   * Evaluate the range of pelvic tilt motion
   */
  private evaluateTiltRange(landmarkHistory: Landmark[][]): number {
    if (landmarkHistory.length < 5) {
      return 50; // Not enough data for range assessment
    }
    
    // Calculate pelvic angle for each frame in history
    const pelvicAngles = landmarkHistory.map(landmarks => {
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      
      return this.calculatePelvicTiltAngle(leftHip, rightHip, leftShoulder, rightShoulder);
    });
    
    // Find min and max angles to determine range
    const minAngle = Math.min(...pelvicAngles);
    const maxAngle = Math.max(...pelvicAngles);
    const range = maxAngle - minAngle;
    
    // Evaluate the range quality (ideally should be 15-30 degrees)
    if (range < 5) {
      return 30; // Insufficient movement range
    } else if (range > 40) {
      return 70; // Excessive range, but still capable
    } else if (range >= 15 && range <= 30) {
      return 100; // Optimal range
    } else {
      // Linear interpolation for values between ranges
      return range < 15 
        ? 30 + (range - 5) * (70 / 10) // 5-15 range
        : 100 - (range - 30) * (30 / 10); // 30-40 range
    }
  }

  /**
   * Evaluate the quality of control
   */
  private evaluateControlQuality(currentAngle: number, steadinessIndex: number): number {
    // Combine current posture alignment with steadiness during movement
    const postureScore = currentAngle > 80 || currentAngle < 10 ? 50 : 90;
    return (postureScore * 0.4) + (steadinessIndex * 0.6);
  }
}
