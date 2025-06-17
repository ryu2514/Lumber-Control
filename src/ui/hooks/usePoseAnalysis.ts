// src/hooks/usePoseAnalysis.ts (最終安定版)

import { useEffect, useState, useCallback, useRef } from 'react';
import { PoseLandmarkerService } from '../../inference/mediapipe/poseLandmarkerService';
import { WaitersBowAnalyzer } from '../../inference/analyzers/waitersBowAnalyzer';
import { PelvicTiltAnalyzer } from '../../inference/analyzers/pelvicTiltAnalyzer';
import { SingleLegStanceAnalyzer } from '../../inference/analyzers/singleLegStanceAnalyzer';
import { BaseAnalyzer } from '../../inference/analyzers/baseAnalyzer';
import { Landmark, TestType } from '../../types';
import { useAppStore } from '../../state/store';

export const usePoseAnalysis = (videoElement: HTMLVideoElement | null) => {
  const [isModelReady, setIsModelReady] = useState(false);
  const poseLandmarkerService = useRef<PoseLandmarkerService | null>(null);
  const rafId = useRef<number | null>(null);
  const landmarkHistory = useRef<Landmark[][]>([]);
  const analyzers = useRef<Record<TestType, BaseAnalyzer>>({
    [TestType.WAITERS_BOW]: new WaitersBowAnalyzer(),
    [TestType.PELVIC_TILT]: new PelvicTiltAnalyzer(),
    [TestType.SINGLE_LEG_STANCE]: new SingleLegStanceAnalyzer(),
  });

  const { 
  currentTest, 
  testStatus, 
  updateLandmarks, 
  completeTest, 
  stopTest 
} = useAppStore();

  const handleLandmarkResults = useCallback((landmarks: Landmark[], timestamp: number) => {
    // 常にランドマークのデータは更新するが、UIへの反映はストアに任せる
    updateLandmarks(landmarks, timestamp);
    landmarkHistory.current.push(landmarks);
    if (landmarkHistory.current.length > 300) {
      landmarkHistory.current.shift();
    }
  }, [updateLandmarks]);

  useEffect(() => {
    const initialize = async () => {
      try {
        poseLandmarkerService.current = new PoseLandmarkerService();
        await poseLandmarkerService.current.initialize();
        setIsModelReady(true);
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

  // ★★★「白飛び」を解決する、最も重要な修正箇所 ★★★
  useEffect(() => {
    // 実行中でない、または準備ができていない場合は、ループを完全に停止する
    if (testStatus !== 'running' || !isModelReady || !videoElement || !poseLandmarkerService.current) {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      return;
    }

    poseLandmarkerService.current.setResultCallback(handleLandmarkResults);

    const predictVideoFrame = () => {
      // 外部の状態が変わったらループを止めるためのガード
      if (useAppStore.getState().testStatus !== 'running' || !videoElement) return;

      if (videoElement.videoWidth > 0) {
        poseLandmarkerService.current?.processVideoFrame(videoElement, performance.now());
      }
      rafId.current = requestAnimationFrame(predictVideoFrame);
    };

    // 解析完了ハンドラ
    const performFinalAnalysis = () => {
      console.log('Performing final analysis...');
      const state = useAppStore.getState();
      const lastLandmarks = landmarkHistory.current.at(-1);
      if (state.currentTest && lastLandmarks) {
        const analyzer = analyzers.current[state.currentTest];
        const result = analyzer.analyze(lastLandmarks, landmarkHistory.current);
        completeTest(result);
      } else {
        stopTest(); // データがなければ単純に停止
      }
    };
    
    const isVideoFile = videoElement.src && videoElement.src.startsWith('blob:');
    if (isVideoFile) {
      // 動画ファイルの場合: 'ended'イベントで完了
      videoElement.addEventListener('ended', performFinalAnalysis, { once: true });
    } else {
      // ウェブカメラの場合: 5秒のタイムアウトで完了
      const timeoutId = setTimeout(performFinalAnalysis, 5000);
      return () => clearTimeout(timeoutId);
    }

    // ループ開始
    predictVideoFrame();

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      if (isVideoFile) videoElement.removeEventListener('ended', performFinalAnalysis);
    };
  }, [isModelReady, videoElement, testStatus, handleLandmarkResults, completeTest, stopTest]);

  useEffect(() => {
    if (testStatus === 'idle') {
      landmarkHistory.current = [];
    }
  }, [testStatus]);

  return { isModelReady };
};