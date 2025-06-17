// src/ui/hooks/usePoseAnalysis.ts (TypeScript修正版)

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
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const poseLandmarkerService = useRef<PoseLandmarkerService | null>(null);
  const rafId = useRef<number | null>(null);
  const landmarkHistory = useRef<Landmark[][]>([]);
  const analyzers = useRef<Record<TestType, BaseAnalyzer>>({
    [TestType.WAITERS_BOW]: new WaitersBowAnalyzer(),
    [TestType.PELVIC_TILT]: new PelvicTiltAnalyzer(),
    [TestType.SINGLE_LEG_STANCE]: new SingleLegStanceAnalyzer(),
  });

  const { 
    testStatus, 
    updateLandmarks, 
    completeTest, 
    stopTest 
  } = useAppStore();

  const handleLandmarkResults = useCallback((landmarks: Landmark[], timestamp: number) => {
    try {
      // ランドマークの品質チェック
      if (!landmarks || landmarks.length === 0) {
        console.warn('Empty landmarks received');
        return;
      }

      // 重要なランドマークの可視性チェック
      const importantLandmarks = [11, 12, 23, 24, 25, 26, 27, 28]; // 肩、腰、膝、足首
      const visibleImportantLandmarks = importantLandmarks.filter(
        index => {
          const landmark = landmarks[index];
          return landmark && typeof landmark.visibility === 'number' && landmark.visibility > 0.5;
        }
      );

      if (visibleImportantLandmarks.length < 6) {
        console.warn(`Only ${visibleImportantLandmarks.length}/8 important landmarks visible`);
      }

      updateLandmarks(landmarks, timestamp);
      landmarkHistory.current.push(landmarks);
      
      // メモリ使用量制限
      if (landmarkHistory.current.length > 300) {
        landmarkHistory.current.shift();
      }

      console.log(`📍 Landmarks: ${landmarks.length} points, History: ${landmarkHistory.current.length} frames`);
    } catch (err) {
      console.error('❌ Error in handleLandmarkResults:', err);
      setError(`ランドマーク処理エラー: ${err}`);
    }
  }, [updateLandmarks]);

  // MediaPipe初期化
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

  // 解析ループの管理
  useEffect(() => {
    console.log(`🎬 Analysis Effect - Status: ${testStatus}, Model: ${isModelReady}, Video: ${!!videoElement}`);
    
    // 実行中でない、または準備ができていない場合は、ループを完全に停止する
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
      poseLandmarkerService.current.setResultCallback(handleLandmarkResults);

      const predictVideoFrame = () => {
        try {
          // 状態チェック
          const currentStatus = useAppStore.getState().testStatus;
          if (currentStatus !== 'running' || !videoElement) {
            console.log('🔄 Loop guard triggered - stopping');
            return;
          }

          // ビデオの準備チェック
          if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
            if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA
              poseLandmarkerService.current?.processVideoFrame(videoElement, performance.now());
            }
          } else {
            console.log('⏳ Video not ready yet...');
          }
          
          rafId.current = requestAnimationFrame(predictVideoFrame);
        } catch (err) {
          console.error('❌ Error in predictVideoFrame:', err);
          setError(`フレーム処理エラー: ${err instanceof Error ? err.message : String(err)}`);
        }
      };

      // 解析完了ハンドラ
      const performFinalAnalysis = () => {
        console.log('🏁 Performing final analysis...');
        try {
          const state = useAppStore.getState();
          const lastLandmarks = landmarkHistory.current.at(-1);
          
          if (state.currentTest && lastLandmarks && landmarkHistory.current.length > 0) {
            console.log(`📊 Analyzing ${landmarkHistory.current.length} frames for ${state.currentTest}`);
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
        // 動画ファイルの場合: 'ended'イベントで完了
        videoElement.addEventListener('ended', performFinalAnalysis, { once: true });
        console.log('🎬 Video file analysis setup complete');
      } else {
        // ウェブカメラの場合: 5秒のタイムアウトで完了
        const timeoutId = setTimeout(() => {
          console.log('⏰ Webcam analysis timeout reached');
          performFinalAnalysis();
        }, 5000);
        
        return () => {
          console.log('⏰ Clearing webcam timeout');
          clearTimeout(timeoutId);
        };
      }

      // ループ開始
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

  // テスト状態のリセット
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