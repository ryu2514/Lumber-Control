// Base analyzer class defining the common interface for all test analyzers
import { Landmark, TestResult, TestType } from '../../types';

export abstract class BaseAnalyzer {
  protected readonly testType: TestType;
  
  constructor(testType: TestType) {
    this.testType = testType;
  }

  /**
   * Process a set of landmarks and return a test result
   */
  abstract analyze(landmarks: Landmark[], landmarkHistory?: Landmark[][]): TestResult;
  
  /**
   * Create basic test result structure
   */
  protected createBaseResult(score: number, metrics: Record<string, number>, feedback: string): TestResult {
    return {
      testType: this.testType,
      score,
      metrics,
      feedback,
      timestamp: Date.now()
    };
  }
}
