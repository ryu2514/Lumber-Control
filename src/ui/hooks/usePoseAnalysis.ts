// src/ui/hooks/usePoseAnalysis.ts (TensorFlow.js runtime版)

import { useEffect, useRef, useState } from 'react';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';
import { Landmark } from '../../types';
import { useAppStore } from '../../state/store';

export const usePoseAnalysis = (videoElement: HTMLVideoElement | null) => {
  const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // useRefをコンポーネントトップレベルで宣言
  const animationFrameRef = useRef<number>();
  const frameCountRef = useRef(0);
  const startTimeRef = useRef(0);
  
  const { 
    testStatus, 
    currentTest,
    updateLandmarks
  } = useAppStore();

  // TensorFlow.js BlazePose初期化
  useEffect(() => {
    let isMounted = true;
    
    const initializePoseDetector = async () => {
      try {
        setError(null);
        setIsInitializing(true);
        
        console.log('🚀 TensorFlow.js BlazePose初期化開始...');
        
        const model = poseDetection.SupportedModels.BlazePose;
        const detectorConfig = {
          runtime: 'tfjs' as const,
          modelType: 'lite' as const,
          enableSmoothing: true,
          enableSegmentation: false
        };
        
        const poseDetector = await poseDetection.createDetector(model, detectorConfig);
        
        if (!isMounted) return;
        
        console.log('✅ TensorFlow.js BlazePose初期化完了');
        setDetector(poseDetector);
        setIsModelReady(true);
        setIsInitializing(false);
        
      } catch (err) {
        console.error('❌ TensorFlow.js BlazePose初期化エラー:', err);
        if (isMounted) {
          setError(`TensorFlow.js BlazePoseの初期化に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
          setIsInitializing(false);
        }
      }
    };

    initializePoseDetector();
    
    return () => {
      isMounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // ビデオ解析ループ
  useEffect(() => {
    if (!detector || !videoElement || testStatus !== 'running') {
      return;
    }

    let lastVideoTime = -1;

    const detectPose = async () => {
      try {
        if (!videoElement || !detector || testStatus !== 'running') {
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

          console.log('🎬 TensorFlow.js pose detection...');

          const poses = await detector.estimatePoses(videoElement);
          
          if (poses && poses.length > 0 && poses[0].keypoints) {
            const detectedLandmarks: Landmark[] = poses[0].keypoints.map(keypoint => ({
              x: keypoint.x / videoElement.videoWidth,  // 正規化（0-1）
              y: keypoint.y / videoElement.videoHeight, // 正規化（0-1）
              z: 0, // 2Dモードでは0
              visibility: keypoint.score || 1.0
            }));
            
            // アプリ用のタイムスタンプ
            const timestamp = Date.now();
            updateLandmarks(detectedLandmarks, timestamp);
            
            console.log('✅ TensorFlow.js ランドマーク検出:', detectedLandmarks.length + '個');
          }

          // 10秒でテスト終了
          const elapsed = Date.now() - startTimeRef.current;
          if (elapsed > 10000) {
            console.log('✅ テスト完了（10秒経過）');
            return;
          }
        }
        
        animationFrameRef.current = requestAnimationFrame(detectPose);
      } catch (err) {
        console.error('🔴 TensorFlow.js Pose detection error:', err);
        setError(`ポーズ検出中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    if (testStatus === 'running') {
      startTimeRef.current = Date.now();
      frameCountRef.current = 0;
      detectPose();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [detector, videoElement, testStatus, currentTest, updateLandmarks]);

  return {
    isModelReady,
    error,
    isInitializing
  };
};
