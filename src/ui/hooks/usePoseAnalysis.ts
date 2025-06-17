// src/ui/hooks/usePoseAnalysis.ts (不要変数削除版)

import { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Landmark } from '../../types';
import { useAppStore } from '../../state/store';

export const usePoseAnalysis = (videoElement: HTMLVideoElement | null) => {
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const animationFrameRef = useRef<number>();
  
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
    const frameCount = useRef(0);
    const startTime = useRef(Date.now());

    const detectPose = async () => {
      try {
        if (!videoElement || !poseLandmarker || testStatus !== 'running') {
          return;
        }

        const currentTime = videoElement.currentTime;
        
        if (currentTime !== lastVideoTime) {
          lastVideoTime = currentTime;
          frameCount.current++;
          
          // フレームレート制御（15fps目安）
          if (frameCount.current % 2 !== 0) {
            animationFrameRef.current = requestAnimationFrame(detectPose);
            return;
          }

          const results = await poseLandmarker.detectForVideo(videoElement, Date.now());
          
          if (results.landmarks && results.landmarks.length > 0) {
            const detectedLandmarks: Landmark[] = results.landmarks[0].map(landmark => ({
              x: landmark.x,
              y: landmark.y,
              z: landmark.z || 0,
              visibility: landmark.visibility || 1.0
            }));
            
            // timestampを追加してupdateLandmarksを呼び出し
            const timestamp = Date.now();
            updateLandmarks(detectedLandmarks, timestamp);
          }

          // 10秒でテスト終了
          const elapsed = Date.now() - startTime.current;
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
      startTime.current = Date.now();
      frameCount.current = 0;
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
