// src/state/store/index.ts (最終修正版)

import { create } from 'zustand';
import { Landmark, TestResult, TestType, AppState, TestStatus } from '../../types';

interface AppActions {
  setCurrentTest: (test: TestType) => void;
  startTest: () => void;
  stopTest: () => void;
  resetTest: () => void;
  updateLandmarks: (landmarks: Landmark[], timestamp: number) => void;
  completeTest: (result: TestResult) => void;
}

type AppStore = AppState & AppActions;

export const useAppStore = create<AppStore>((set, get) => ({
  // State
  currentTest: null,
  testStatus: 'idle' as TestStatus,
  landmarks: null,
  analysisResults: {} as Record<TestType, TestResult>,

  // Actions
  setCurrentTest: (test: TestType) => {
    set({ currentTest: test });
  },

  startTest: () => {
    const { currentTest } = get();
    if (currentTest) {
      set({ 
        testStatus: 'running',
        landmarks: null 
      });
    }
  },

  stopTest: () => {
    set({ testStatus: 'idle' });
  },

  resetTest: () => {
    set({ 
      testStatus: 'idle',
      landmarks: null 
    });
  },

  updateLandmarks: (landmarks: Landmark[], _timestamp: number) => {
    set({ landmarks });
  },

  completeTest: (result: TestResult) => {
    const { currentTest, analysisResults } = get();
    if (currentTest) {
      set({
        testStatus: 'completed',
        analysisResults: {
          ...analysisResults,
          [currentTest]: result
        }
      });
    }
  },
}));
