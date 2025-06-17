// src/ui/hooks/usePoseAnalysis.ts (デバッグ強化版)

import { useEffect, useState, useCallback, useRef } from 'react';
import { PoseLandmarkerService } from '../../inference/mediapipe/poseLandmarkerService';
import { StandingHipFlexionAnalyzer } from '../../inference/analyzers/standingHipFlexionAnalyzer';
import { RockBackAnalyzer } from '../../inference/analyzers/rockBackAnalyzer';
import { SittingKneeExtensionAnalyzer } from '../../inference/analyzers/sittingKneeExtensionAnalyzer';
import { BaseAnalyzer } from '../../inference/analyzers/baseAnalyzer';
import { Landmark, TestType } from '../../types';
import { useAppStore } from '../../state/store';

export const usePoseAnalysis = (videoElement: HTMLVideoElement | null) => {
  const [isModelReady, setIsModelReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const poseLandmarkerService = useRef<PoseLandmarkerService | null>(null);
  const rafId = useRef<number | null>(null);
  const landmarkHistory = useRef<Landmark[][]>([]);
  const analyzers = useRef<Record<TestType, BaseAnalyzer>>({
    [TestType.STANDING_HIP_FLEXION]: new StandingHipFlexionAnalyzer(),
    [TestType.ROCK_BACK]: new RockBackAnalyzer(),
    [TestType.SITTING_KNEE_EXTENSION]: new SittingKneeExtensionAnalyzer(),
  });

  const { 
    testStatus, 
    updateLandmarks, 
    completeTest, 
    stopTest 
  } = useAppStore();

  const handleLandmarkResults = useCallback((landmarks: Landmark[], timestamp: number) => {
    try {
      console.log('🔍 handleLandmarkResults called with:', {
        landmarksCount: landmarks?.length,
        timestamp,
        firstLandmark: landmarks?.[0],
      });

      if (!landmarks || landmarks.length === 0) {
        console.warn('⚠️ Empty landmarks received');
        return;
      }

      const importantLandmarks = [11, 12, 23, 24, 25, 26, 27, 28, 0, 15, 16];
      const visibleImportantLandmarks = importantLandmarks.filter(
        index => {
          const landmark = landmarks[index];
          return landmark && typeof landmark.visibility === 'number' && landmark.visibility > 0.5;
        }
      );

      console.log('👁️ Visibility check:', {
        total: importantLandmarks.length,
        visible: visibleImportantLandmarks.length,
        visibleIndexes: visibleImportantLandmarks,
      });

      // ここが重要: storeを更新
      updateLandmarks(landmarks, timestamp);
      console.log('✅ updateLandmarks called successfully');

      landmarkHistory.current.push(landmarks);
      
      if (landmarkHistory.current.length > 300) {
        landmarkHistory.current.shift();
      }

      console.log(`📍 Updated: ${landmarks.length} landmarks, History: ${landmarkHistory.current.length} frames`);
    } catch (err) {
      console.error('❌ Error in handleLandmarkResults:', err);
      setError(`ランドマーク処理エラー: ${err}`);
    }
  }, [updateLandmarks]);

  useEffect(() => {
    const initialize = async () => {
      if (isInitializing) return;
      
      console.log('🚀 Starting MediaPipe initialization...');
      setIsInitializing(true);
      setError(null);
      
      try {
        poseLandmarkerService.current = new PoseLandmarkerService();
        console.log('📦 PoseLandmarkerService created');
        
        await poseLandmarkerService.current.initialize();
        console.log('✅ MediaPipe initialized successfully');
        setIsModelReady(true);
      } catch (error) {
        console.error('❌ Failed to initialize Pose Landmarker:', error);
        setError(`MediaPipe初期化エラー: ${error instanceof Error ? error.message : String(error)}`);
        setIsModelReady(false);
      } finally {
        setIsInitializing(false);
      }
    };
    
    initialize();
    
    return () => {
      console.log('🧹 Cleaning up MediaPipe resources...');
      if (poseLandmarkerService.current) {
        try {
          poseLandmarkerService.current.close();
        } catch (err) {
          console.error('Error closing poseLandmarkerService:', err);
        }
      }
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  useEffect(() => {
    console.log(`🎬 Analysis Effect - Status: ${testStatus}, Model: ${isModelReady}, Video: ${!!videoElement}`);
    
    if (testStatus !== 'running' || !isModelReady || !videoElement || !poseLandmarkerService.current) {
      console.log('🛑 Stopping analysis loop');
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      return;
    }

    console.log('▶️ Starting analysis loop...');
    setError(null);
    
    try {
      // コールバック設定の確認
      console.log('🔗 Setting result callback');
      poseLandmarkerService.current.setResultCallback(handleLandmarkResults);

      const predictVideoFrame = () => {
        try {
          const currentStatus = useAppStore.getState().testStatus;
          if (currentStatus !== 'running' || !videoElement) {
            console.log('🔄 Loop guard triggered - stopping');
            return;
          }

          if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
            if (videoElement.readyState >= 2) {
              console.log('🎥 Processing video frame...');
              poseLandmarkerService.current?.processVideoFrame(videoElement, performance.now());
            } else {
              console.log('⏳ Video not ready (readyState:', videoElement.readyState, ')');
            }
          } else {
            console.log('⏳ Video dimensions not available:', videoElement.videoWidth, 'x', videoElement.videoHeight);
          }
          
          rafId.current = requestAnimationFrame(predictVideoFrame);
        } catch (err) {
          console.error('❌ Error in predictVideoFrame:', err);
          setError(`フレーム処理エラー: ${err instanceof Error ? err.message : String(err)}`);
        }
      };

      const performFinalAnalysis = () => {
        console.log('🏁 Performing final analysis...');
        try {
          const state = useAppStore.getState();
          const lastLandmarks = landmarkHistory.current.at(-1);
          
          console.log('📊 Final analysis data:', {
            currentTest: state.currentTest,
            historyLength: landmarkHistory.current.length,
            hasLastLandmarks: !!lastLandmarks,
          });
          
          if (state.currentTest && lastLandmarks && landmarkHistory.current.length > 0) {
            console.log(`📈 Analyzing ${landmarkHistory.current.length} frames for ${state.currentTest}`);
            const analyzer = analyzers.current[state.currentTest];
            const result = analyzer.analyze(lastLandmarks, landmarkHistory.current);
            console.log('📈 Analysis result:', result);
            completeTest(result);
          } else {
            console.log('📭 No sufficient data to analyze');
            if (landmarkHistory.current.length === 0) {
              setError('解析用のデータが収集されませんでした。カメラの位置や照明を確認してください。');
            }
            stopTest();
          }
        } catch (err) {
          console.error('❌ Error in final analysis:', err);
          setError(`解析エラー: ${err instanceof Error ? err.message : String(err)}`);
          stopTest();
        }
      };
      
      const isVideoFile = videoElement.src && videoElement.src.startsWith('blob:');
      console.log(`📹 Video type: ${isVideoFile ? 'File' : 'Webcam'}`);
      
      if (isVideoFile) {
        videoElement.addEventListener('ended', performFinalAnalysis, { once: true });
        console.log('🎬 Video file analysis setup complete');
      } else {
        const timeoutId = setTimeout(() => {
          console.log('⏰ Webcam analysis timeout reached');
          performFinalAnalysis();
        }, 8000);
        
        return () => {
          console.log('⏰ Clearing webcam timeout');
          clearTimeout(timeoutId);
        };
      }

      console.log('🎯 Starting prediction loop');
      predictVideoFrame();

      return () => {
        console.log('🛑 Cleaning up analysis effect');
        if (rafId.current) {
          cancelAnimationFrame(rafId.current);
          rafId.current = null;
        }
        if (isVideoFile) {
          videoElement.removeEventListener('ended', performFinalAnalysis);
        }
      };
    } catch (err) {
      console.error('❌ Error setting up analysis:', err);
      setError(`セットアップエラー: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [isModelReady, videoElement, testStatus, handleLandmarkResults, completeTest, stopTest]);

  useEffect(() => {
    if (testStatus === 'idle') {
      console.log('🔄 Resetting landmark history');
      landmarkHistory.current = [];
      setError(null);
    }
  }, [testStatus]);

  return { 
    isModelReady, 
    error, 
    isInitializing,
    landmarkCount: landmarkHistory.current.length 
  };
};
