// Common types for the application

// Landmark type matching MediaPipe's format
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

// Enum for test types
export enum TestType {
  WAITERS_BOW = 'waitersBow',
  PELVIC_TILT = 'pelvicTilt',
  SINGLE_LEG_STANCE = 'singleLegStance'
}

// Status of test execution
export type TestStatus = 'idle' | 'running' | 'completed' | 'error';

// Analysis results for each test
export interface TestResult {
  testType: TestType;
  score: number;
  metrics: {
    [key: string]: number;
  };
  feedback: string;
  timestamp: number;
}

// Stability metrics
export interface StabilityMetrics {
  deviationScore: number;
  movementRange: number;
  steadinessIndex: number;
}

// App state interface
export interface AppState {
  currentTest: TestType | null;
  testStatus: TestStatus;
  landmarks: Landmark[];
  analysisResults: {
    [key in TestType]?: TestResult;
  };
  
  // Actions
  setCurrentTest: (test: TestType) => void;
  startTest: () => Promise<void>;
  updateLandmarks: (landmarks: Landmark[]) => void;
  completeTest: (result: TestResult) => void;
  resetTest: () => void;
}
