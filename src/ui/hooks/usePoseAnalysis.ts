// src/ui/hooks/usePoseAnalysis.ts (タイムスタンプ修正版)

import { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Landmark } from '../../types';
import { useAppStore } from '../../state/store';

export const usePoseAnalysis = (videoElement: HTMLVideoElement | null) => {
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // useRefをコンポーネントトップレベルで宣言
  const animationFrameRef = useRef<number>();
  const frameCountRef = useRef(0);
  const startTimeRef = useRef(0);
  const lastTimestampRef = useRef(0); // MediaPipeタイムスタンプ管理
  
  const { 
    testStatus, 
    currentTest,
    updateLandmarks
  } = useAppStore();

  // MediaPipe初期化（runtime = mediapipe明示）
  useEffect(() => {
    let isMounted = true;
    
    const initializePoseLandmarker = async () => {
      try {
        setError(null);
        setIsInitializing(true);
        
        console.log('🚀 MediaPipe初期化開始...');
        
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        
        if (!isMounted) return;
        
        console.log('📦 MediaPipe Wasmロード完了');
        
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputSegmentationMasks: false
        });
        
        if (!isMounted) return;
        
        console.log('✅ PoseLandmarker初期化完了');
        setPoseLandmarker(landmarker);
        setIsModelReady(true);
        setIsInitializing(false);
        
      } catch (err) {
        console.error('❌ MediaPipe初期化エラー:', err);
        if (isMounted) {
          setError(`MediaPipeの初期化に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
          setIsInitializing(false);
        }
      }
    };

    initializePoseLandmarker();
    
    return () => {
      isMounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // ビデオ解析ループ
  useEffect(() => {
    if (!poseLandmarker || !videoElement || testStatus !== 'running') {
      return;
    }

    let lastVideoTime = -1;

    const detectPose = async () => {
      try {
        if (!videoElement || !poseLandmarker || testStatus !== 'running') {
          return;
        }

        const currentTime = videoElement.currentTime;
        
        if (currentTime !== lastVideoTime) {
          lastVideoTime = currentTime;
          frameCountRef.current++;
          
          // フレームレート制御（15fps目安）
          if (frameCountRef.current % 2 !== 0) {
            animationFrameRef.current = requestAnimationFrame(detectPose);
            return;
          }

          // MediaPipe用の単調増加タイムスタンプを生成
          const currentTimestamp = performance.now();
          
          // タイムスタンプが前回より大きいことを保証
          if (currentTimestamp <= lastTimestampRef.current) {
            lastTimestampRef.current += 1; // 最小限増加
          } else {
            lastTimestampRef.current = currentTimestamp;
          }

          console.log('🎬 MediaPipe timestamp:', lastTimestampRef.current);

          const results = await poseLandmarker.detectForVideo(videoElement, lastTimestampRef.current);
          
          if (results.landmarks && results.landmarks.length > 0) {
            const detectedLandmarks: Landmark[] = results.landmarks[0].map(landmark => ({
              x: landmark.x,
              y: landmark.y,
              z: landmark.z || 0,
              visibility: landmark.visibility || 1.0
            }));
            
            // アプリ用のタイムスタンプ（別管理）
            const appTimestamp = Date.now();
            updateLandmarks(detectedLandmarks, appTimestamp);
            
            console.log('✅ ランドマーク検出:', detectedLandmarks.length + '個');
          }

          // 10秒でテスト終了
          const elapsed = Date.now() - startTimeRef.current;
          if (elapsed > 10000) {
            // 自動的にテスト完了（ストア内で処理される）
            console.log('✅ テスト完了（10秒経過）');
            return;
          }
        }
        
        animationFrameRef.current = requestAnimationFrame(detectPose);
      } catch (err) {
        console.error('🔴 Pose detection error:', err);
        setError(`ポーズ検出中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    if (testStatus === 'running') {
      startTimeRef.current = Date.now();
      frameCountRef.current = 0;
      lastTimestampRef.current = 0; // タイムスタンプリセット
      detectPose();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [poseLandmarker, videoElement, testStatus, currentTest, updateLandmarks]);

  return {
    isModelReady,
    error,
    isInitializing
  };
};
