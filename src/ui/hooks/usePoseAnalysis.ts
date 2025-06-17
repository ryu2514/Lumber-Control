// src/hooks/usePoseAnalysis.ts (最終完成版)

import { useEffect, useState, useCallback, useRef } from 'react';
import { PoseLandmarkerService } from '../../inference/mediapipe/poseLandmarkerService';
import { WaitersBowAnalyzer } from '../../inference/analyzers/waitersBowAnalyzer';
import { PelvicTiltAnalyzer } from '../../inference/analyzers/pelvicTiltAnalyzer';
import { SingleLegStanceAnalyzer } from '../../inference/analyzers/singleLegStanceAnalyzer';
import { BaseAnalyzer } from '../../inference/analyzers/baseAnalyzer';
import { Landmark, TestType } from '../../types';
import { useAppStore } from '../../state/store';

// フックが受け取る引数の型を定義
interface UsePoseAnalysisProps {
  videoElement: HTMLVideoElement | null;
  loop: boolean; // trueならウェブカメラ、falseなら動画ファイル
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

  // Get state and actions from store
  const {
    currentTest,
    updateLandmarks,
    completeTest,
    stopTest,
  } = useAppStore();

  // Initialize pose landmarker service
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
      if (poseLandmarkerService.current) {
        poseLandmarkerService.current.close();
      }
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  // ★★★ 常時解析のためのロジック分離 ★★★
  // MediaPipeからの結果を処理するコールバック関数
  const handleLandmarkResults = useCallback(
    (landmarks: Landmark[], timestamp: number) => {
      // 1. ランドマークの描画は、テスト状態に関わらず常に行う
      updateLandmarks(landmarks, timestamp);
      landmarkHistory.current.push(landmarks);
      if (landmarkHistory.current.length > 300) { // 約10秒分のデータを保持 (30fpsの場合)
        landmarkHistory.current.shift();
      }
      
      // 2. スコア計算は「実行中」の時だけ行う
      // useAppStore.getState() を使うことで、このコールバックがtestStatusの変更で再生成されるのを防ぐ
      if (useAppStore.getState().testStatus === 'running' && currentTest !== null) {
        // ウェブカメラの場合は、一定フレーム溜まったら完了と判断
        if (loop && landmarkHistory.current.length >= 50) { // 約1.5秒でテスト完了
          const analyzer = analyzers.current[currentTest];
          const result = analyzer.analyze(landmarks, landmarkHistory.current);
          completeTest(result);
        }
        // 動画の場合は、ループの終了時に最終解析を行うので、ここでは何もしない
      }
    },
    [currentTest, updateLandmarks, completeTest, loop]
  );

  // ★★★ 常時解析のためのループ制御 ★★★
  // ビデオ要素が変更されたときに、解析ループを開始・停止する
  useEffect(() => {
    // 必要なものが揃っていなければループを開始しない
    if (!isModelReady || !videoElement || !poseLandmarkerService.current) {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
      return;
    }

    poseLandmarkerService.current.setResultCallback(handleLandmarkResults);

    const predictVideoFrame = () => {
      if (videoElement && poseLandmarkerService.current) {
        const isVideoPlaying = !videoElement.paused && !videoElement.ended;

        if (isVideoPlaying || loop) { // ウェブカメラ(loop)か、動画が再生中なら
          if (videoElement.videoWidth > 0) {
            const timestamp = loop ? performance.now() : videoElement.currentTime * 1000;
            poseLandmarkerService.current.processVideoFrame(videoElement, timestamp);
          }
          rafId.current = requestAnimationFrame(predictVideoFrame);
        } else if (!loop && useAppStore.getState().testStatus === 'running') {
          // 動画ファイルが終了し、かつ「実行中」だった場合
          console.log('Video analysis finished.');
          const lastLandmarks = landmarkHistory.current.at(-1);
          if (currentTest && lastLandmarks) {
            const analyzer = analyzers.current[currentTest];
            const result = analyzer.analyze(lastLandmarks, landmarkHistory.current);
            completeTest(result);
          } else {
            // 解析データがなければ、 просто stop
            stopTest();
          }
        }
      }
    };
    
    // ループを開始
    predictVideoFrame();

    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [videoElement, isModelReady, handleLandmarkResults]); // testStatusを依存配列から削除

  // Reset landmark history
  useEffect(() => {
    if (useAppStore.getState().testStatus === 'idle') {
      landmarkHistory.current = [];
    }
  }, [useAppStore.getState().testStatus]);

  return { isModelReady };
};