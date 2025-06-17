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

  const {
    currentTest,
    testStatus,
    updateLandmarks,
    completeTest,
    stopTest,
  } = useAppStore();

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

  const handleLandmarkResults = useCallback(
    (landmarks: Landmark[], timestamp: number) => {
      updateLandmarks(landmarks, timestamp);
      landmarkHistory.current.push(landmarks);
      if (landmarkHistory.current.length > 200) landmarkHistory.current.shift();
      if (testStatus === 'running' && currentTest !== null && loop) {
        if (landmarkHistory.current.length >= 30) {
          const analyzer = analyzers.current[currentTest];
          const result = analyzer.analyze(landmarks, landmarkHistory.current);
          completeTest(result);
        }
      }
    },
    [currentTest, testStatus, updateLandmarks, completeTest, loop]
  );

  useEffect(() => {
    if (!isModelReady || !videoElement || !poseLandmarkerService.current || testStatus !== 'running') {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = null;
      return;
    }

    poseLandmarkerService.current.setResultCallback(handleLandmarkResults);

    const predictVideoFrame = () => {
      if (poseLandmarkerService.current && useAppStore.getState().testStatus === 'running') {
        const isVideoPlaying = !videoElement.paused && !videoElement.ended;
        if (isVideoPlaying || loop) {
          if (videoElement.videoWidth > 0) {
            const timestamp = loop ? performance.now() : videoElement.currentTime * 1000;
            poseLandmarkerService.current.processVideoFrame(videoElement, timestamp);
          }
          rafId.current = requestAnimationFrame(predictVideoFrame);
        } else if (!loop) {
          console.log('Video analysis finished.');
          const lastLandmarks = landmarkHistory.current[landmarkHistory.current.length - 1];
          if (currentTest && lastLandmarks) {
            const analyzer = analyzers.current[currentTest];
            const result = analyzer.analyze(lastLandmarks, landmarkHistory.current);
            completeTest(result);
          } else {
            stopTest();
          }
        }
      }
    };
    predictVideoFrame();
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [videoElement, isModelReady, handleLandmarkResults, testStatus, loop, currentTest, completeTest, stopTest]);

  useEffect(() => {
    if (testStatus === 'idle') landmarkHistory.current = [];
  }, [testStatus]);

  return { isModelReady };
};