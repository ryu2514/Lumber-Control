// src/state/store/index.ts (完成版)

import { create } from 'zustand';
import { Landmark, TestResult, TestType } from '../../types';

// AppStateの型定義をまず行います
// これにより、create<AppState>が正しく機能します
interface AppState {
  currentTest: TestType | null;
  testStatus: 'idle' | 'running' | 'completed';
  landmarks: Landmark[] | null;
  lastUpdated: number; // タイムスタンプを保持するプロパティを追加
  analysisResults: Partial<Record<TestType, TestResult>>;
  setCurrentTest: (test: TestType) => void;
  startTest: () => void;
  stopTest: () => void; // stopTestの型定義を追加
  resetTest: () => void;
  updateLandmarks: (landmarks: Landmark[], timestamp: number) => void; // timestampを受け取るように変更
  completeTest: (result: TestResult) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // State
  currentTest: null,
  testStatus: 'idle',
  landmarks: null,
  lastUpdated: 0, // lastUpdatedの初期値を追加
  analysisResults: {},

  // Actions
  setCurrentTest: (test: TestType) =>
    set({
      currentTest: test,
      testStatus: 'idle', // テストを変更したらステータスをリセット
      landmarks: null,
      analysisResults: {},
    }),

  startTest: () => {
    const { currentTest } = get();
    if (!currentTest) {
      console.error('Cannot start test: No test selected');
      return;
    }
    set((state) => ({
      testStatus: 'running',
      landmarks: null,
      analysisResults: {
        ...state.analysisResults,
        [currentTest]: undefined,
      },
    }));
  },

  // stopTest関数をここに追加
  stopTest: () => {
    // 実行中でなければ何もしない
    if (get().testStatus !== 'running') return;
    set({ testStatus: 'completed' });
  },

  // updateLandmarksをtimestampを受け取れるように修正
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