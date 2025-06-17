// src/state/store/index.ts (完成版)

import { create } from 'zustand';
import { Landmark, TestResult, TestType } from '../../types';

interface AppState {
  currentTest: TestType | null;
  testStatus: 'idle' | 'running' | 'completed';
  landmarks: Landmark[] | null;
  lastUpdated: number;
  analysisResults: Partial<Record<TestType, TestResult>>;
  setCurrentTest: (test: TestType) => void;
  startTest: () => void;
  stopTest: () => void;
  resetTest: () => void;
  updateLandmarks: (landmarks: Landmark[], timestamp: number) => void;
  completeTest: (result: TestResult) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // State
  currentTest: null,
  testStatus: 'idle',
  landmarks: null,
  lastUpdated: 0,
  analysisResults: {},

  // Actions
  setCurrentTest: (test: TestType) =>
    set({
      currentTest: test,
      testStatus: 'idle',
      landmarks: null,
      analysisResults: {},
    }),

  startTest: () => {
    const { currentTest } = get();
    if (!currentTest) return;

    set((state) => ({
      testStatus: 'running',
      // landmarks: null, // ← この行を削除！ちらつきを防ぎます
      analysisResults: {
        ...state.analysisResults,
        [currentTest]: undefined,
      },
    }));
  },

  stopTest: () => {
    if (get().testStatus !== 'running') return;
    set({ testStatus: 'completed' });
  },

  updateLandmarks: (newLandmarks: Landmark[], timestamp: number) => {
    set({ landmarks: newLandmarks, lastUpdated: timestamp });
  },

  completeTest: (result: TestResult) => {
    set((state) => ({
      testStatus: 'completed',
      analysisResults: {
        ...state.analysisResults,
        [result.testType]: result,
      },
    }));
  },

  resetTest: () => {
    set({ testStatus: 'idle', landmarks: null, analysisResults: {} });
  },
}));