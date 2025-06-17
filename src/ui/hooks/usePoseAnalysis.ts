// src/hooks/usePoseAnalysis.ts (最終完成版)

import { useEffect, useState, useCallback, useRef } from 'react';
import { PoseLandmarkerService } from '../../inference/mediapipe/poseLandmarkerService';
import { WaitersBowAnalyzer } from '../../inference/analyzers/waitersBowAnalyzer';
import { PelvicTiltAnalyzer } from '../../inference/analyzers/pelvicTiltAnalyzer';
import { SingleLegStanceAnalyzer } from '../../inference/analyzers/singleLegStanceAnalyzer';
import { BaseAnalyzer } from '../../inference/analyzers/baseAnalyzer';
import { Landmark, TestType } from '../../types';
import { useAppStore } from '../../state/store';

interface UsePoseAnalysisProps {
  videoElement: HTMLVideoElement | null;
  loop: boolean;
}

export const usePoseAnalysis = ({ videoElement, loop }: UsePoseAnalysisProps) => {
  const [isModelReady, setIsModelReady] = useState(false);
  const poseLandmarkerService = useRef<PoseLandmarkerService | null>(null);
  const rafId = useRef<number | null>(null);
  const landmarkHistory = useRef<Landmark[][]>([]);
  const analyzers = useRef<Record<TestType, BaseAnalyzer>>({
    [TestType.WAITERS_BOW]: new WaitersBowAnalyzer(),
    [TestType.PELVIC_TILT]: new PelvicTiltAnalyzer(),
    [TestType.SINGLE_LEG_STANCE]: new SingleLegStanceAnalyzer(),
  });

  // ストアから取得するのは、再生成されない「関数」のみにする
  const { updateLandmarks, completeTest, stopTest } = useAppStore();

  // ★★★ 無限ループ解消の最重要ポイント ★★★
  // MediaPipeからの結果を処理するコールバック
  const handleLandmarkResults = useCallback((landmarks: Landmark[], timestamp: number) => {
    // 1. 骨格の描画はいつでも行う
    updateLandmarks(landmarks, timestamp);
    landmarkHistory.current.push(landmarks);
    if (landmarkHistory.current.length > 300) {
      landmarkHistory.current.shift();
    }
    
    // 2. スコア計算は「実行中」の時だけ行う
    // getState()を使うことで、この関数がストアの状態に依存するのを防ぐ
    const state = useAppStore.getState();
    if (state.testStatus === 'running' && state.currentTest !== null) {
      if (loop && landmarkHistory.current.length >= 50) {
        const analyzer = analyzers.current[state.currentTest];
        const result = analyzer.analyze(landmarks, landmarkHistory.current);
        completeTest(result);
      }
    }
  }, [updateLandmarks, completeTest, loop]); // 依存配列を最小限に

  // モデルの初期化 (変更なし)
  useEffect(() => {
    const initialize = async () => {
      try {
        poseLandmarkerService.current = new PoseLandmarkerService();
        await poseLandmarkerService.current.initialize();
        setIsModelReady(true);
        console.log('Pose Landmarker initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Pose Landmarker:', error);
      }
    };
    initialize();
    return () => {
      if (poseLandmarkerService.current) poseLandmarkerService.current.close();
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // 解析ループの制御 (より安定したロジックに)
  useEffect(() => {
    if (!isModelReady || !videoElement) {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      return;
    }

    poseLandmarkerService.current?.setResultCallback(handleLandmarkResults);

    const predictVideoFrame = () => {
      // ループを続けるかどうかのフラグ
      let continueLoop = true;

      if (videoElement && poseLandmarkerService.current) {
        const isVideoPlaying = !videoElement.paused && !videoElement.ended;

        if (isVideoPlaying || loop) {
          if (videoElement.videoWidth > 0) {
            const timestamp = loop ? performance.now() : videoElement.currentTime * 1000;
            poseLandmarkerService.current.processVideoFrame(videoElement, timestamp);
          }
        } else if (!loop) {
          // 動画が終了した場合
          continueLoop = false;
          const state = useAppStore.getState();
          if (state.testStatus === 'running') {
            console.log('Video analysis finished.');
            const lastLandmarks = landmarkHistory.current.at(-1);
            if (state.currentTest && lastLandmarks) {
              const analyzer = analyzers.current[state.currentTest];
              const result = analyzer.analyze(lastLandmarks, landmarkHistory.current);
              completeTest(result);
            } else {
              stopTest();
            }
          }
        }
      } else {
        continueLoop = false;
      }

      if (continueLoop) {
        rafId.current = requestAnimationFrame(predictVideoFrame);
      }
    };
    
    predictVideoFrame();

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [videoElement, isModelReady, handleLandmarkResults, loop, completeTest, stopTest]);

  // リセット処理
  useEffect(() => {
    // testStatusが変更されたことを検知して履歴をクリア
    const unsubscribe = useAppStore.subscribe(
      (state, prevState) => {
        if (state.testStatus === 'idle' && prevState.testStatus !== 'idle') {
          landmarkHistory.current = [];
        }
      }
    );
    return unsubscribe;
  }, []);

  return { isModelReady };
};