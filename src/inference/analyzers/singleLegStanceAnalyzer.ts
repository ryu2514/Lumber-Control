// Single Leg Stance Test Analyzer
import { Landmark, TestResult, TestType } from '../../types';
import { calculateDistance, calculateMovementStability } from '../utils/mathUtils';
import { BaseAnalyzer } from './baseAnalyzer';

export class SingleLegStanceAnalyzer extends BaseAnalyzer {
  constructor() {
    super(TestType.SINGLE_LEG_STANCE);
  }

  /**
   * Analyze landmarks for Single Leg Stance test
   * This test assesses lumbar stability during unilateral stance
   */
  analyze(landmarks: Landmark[], landmarkHistory: Landmark[][] = []): TestResult {
    // Extract relevant landmarks
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    
    // Determine which leg is weight-bearing (lower leg is supporting)
    const isLeftLegSupporting = leftAnkle.y > rightAnkle.y;
    const supportLeg = isLeftLegSupporting ? 'left' : 'right';
    
    // Calculate hip drop angle (pelvic obliquity)
    const hipDropAngle = this.calculateHipDropAngle(leftHip, rightHip);
    
    // Calculate postural sway using nose position stability
    const posturalSway = this.calculatePosturalSway(landmarkHistory);
    
    // Calculate lumbar stability during the stance
    const stabilityMetrics = calculateMovementStability(landmarkHistory, [23, 24, 11, 12]); // hips and shoulders
    
    // Calculate stance leg alignment
    const kneeAlignment = this.evaluateKneeAlignment(
      isLeftLegSupporting ? leftHip : rightHip,
      isLeftLegSupporting ? leftKnee : rightKnee,
      isLeftLegSupporting ? leftAnkle : rightAnkle
    );
    
    // Calculate overall score (0-100)
    const hipDropScore = 100 - Math.min(100, Math.abs(hipDropAngle) * 10);
    const overallScore = (
      (hipDropScore * 0.3) + 
      (posturalSway * 0.2) + 
      (stabilityMetrics.steadinessIndex * 0.3) + 
      (kneeAlignment * 0.2)
    );
    
    // Generate feedback
    let feedback = `Analysis based on ${supportLeg} leg support. `;
    
    if (hipDropScore < 60) {
      feedback += 'Significant hip drop detected. Focus on maintaining level pelvis. ';
    }
    
    if (posturalSway < 60) {
      feedback += 'Excessive postural sway observed. Try to maintain a more stable position. ';
    }
    
    if (stabilityMetrics.steadinessIndex < 60) {
      feedback += 'Lumbar stability needs improvement. Focus on core engagement during the stance. ';
    }
    
    if (kneeAlignment < 60) {
      feedback += 'Knee alignment needs improvement. Ensure knee tracks over foot. ';
    }
    
    if (overallScore > 80) {
      feedback = `${supportLeg.charAt(0).toUpperCase() + supportLeg.slice(1)} leg stance shows excellent stability and control.`;
    }

    // singleLegStanceAnalyzer.ts の修正後のコード

// Create and return the test result
return this.createBaseResult(
  overallScore,
  { // ↓↓↓ このオブジェクトから 'supportLeg' を削除しました ↓↓↓
    hipDropAngle: hipDropAngle,
    hipDropScore: hipDropScore,
    posturalSway: posturalSway,
    lumbarStability: stabilityMetrics.steadinessIndex,
    kneeAlignment: kneeAlignment
  },
  feedback
);
  }

  /**
   * Calculate hip drop angle (pelvic obliquity)
   * Positive values indicate left hip is higher, negative means right hip is higher
   */
  private calculateHipDropAngle(leftHip: Landmark, rightHip: Landmark): number {
    // Calculate angle from horizontal
    const dx = rightHip.x - leftHip.x;
    const dy = rightHip.y - leftHip.y;
    
    // Calculate angle in degrees
    const angleRadians = Math.atan2(dy, dx);
    return angleRadians * (180 / Math.PI);
  }

  /**
   * Calculate postural sway based on nose position stability
   * Returns a score from 0-100 where 100 is perfectly stable
   */
  private calculatePosturalSway(landmarkHistory: Landmark[][]): number {
    if (landmarkHistory.length < 10) {
      return 50; // Not enough data
    }
    
    // Track nose position over time
    const nosePositions = landmarkHistory.map(landmarks => landmarks[0]);
    
    // Calculate total displacement of nose position
    let totalDisplacement = 0;
    
    for (let i = 1; i < nosePositions.length; i++) {
      totalDisplacement += calculateDistance(nosePositions[i], nosePositions[i-1]);
    }
    
    // Scale to a score (lower displacement is better)
    const averageDisplacement = totalDisplacement / (nosePositions.length - 1);
    return 100 - Math.min(100, averageDisplacement * 1000);
  }

  /**
   * Evaluate knee alignment relative to hip and ankle
   * Returns a score from 0-100 where 100 is perfect alignment
   */
  private evaluateKneeAlignment(hip: Landmark, knee: Landmark, ankle: Landmark): number {
    // Create vertical line from hip to ankle
    const idealKneeX = ankle.x;
    
    // Calculate deviation of actual knee position from ideal
    const kneeDeviationX = Math.abs(knee.x - idealKneeX);
    
    // Calculate hip to ankle distance for scaling
    const hipToAnkleDistance = calculateDistance(hip, ankle);
    
    // Scale deviation relative to leg length
    const relativeDeviation = kneeDeviationX / hipToAnkleDistance;
    
    // Convert to score (lower deviation is better)
    return 100 - Math.min(100, relativeDeviation * 500);
  }
}
