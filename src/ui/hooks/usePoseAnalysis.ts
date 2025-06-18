// src/ui/hooks/usePoseAnalysis.ts (MediaPipe版)

import { useRef, useCallback, useState } from 'react';
import { Landmark } from '../../types';

// MediaPipe types
interface MediaPipeLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface MediaPipeResult {
  landmarks?: MediaPipeLandmark[][];
}

declare global {
  interface Window {
    MediaPipeTasksVision?: any;
  }
}

export const usePoseAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [error, setError] = useState<string | null>(null);
  const detectorRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // MediaPipe初期化
  const initializeMediaPipe = useCallback(async () => {
    try {
      console.log('🚀 MediaPipe初期化開始...');
      
      // MediaPipe CDNから動的インポート
      if (!window.MediaPipeTasksVision) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js';
        document.head.appendChild(script);
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
      }

      const vision = window.MediaPipeTasksVision;
      
      // FilesetResolverを初期化
      const filesetResolver = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      
      // PoseLandmarkerを作成
      const poseLandmarker = await vision.PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.3,
        minPosePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
        outputSegmentationMasks: false
      });
      
      detectorRef.current = poseLandmarker;
      console.log('✅ MediaPipe初期化完了');
      return true;
    } catch (error) {
      console.error('❌ MediaPipe初期化エラー:', error);
      setError(`MediaPipe初期化エラー: ${error}`);
      return false;
    }
  }, []);

  // ポーズ検出の実行
  const detectPose = useCallback(async (video: HTMLVideoElement) => {
    if (!detectorRef.current || !video) return;

    try {
      const startTime = performance.now();
      
      // MediaPipeでポーズ検出
      const result: MediaPipeResult = await detectorRef.current.detectForVideo(video, startTime);
      
      if (result.landmarks && result.landmarks.length > 0) {
        // MediaPipeの結果をLandmark形式に変換
        const mediapipeLandmarks = result.landmarks[0]; // 最初の人のランドマーク
        
        const convertedLandmarks: Landmark[] = mediapipeLandmarks.map((landmark: MediaPipeLandmark) => ({
          x: landmark.x, // MediaPipeは既に正規化済み（0-1）
          y: landmark.y,
          z: landmark.z || 0,
          visibility: landmark.visibility || 0.8 // MediaPipeのvisibilityまたはデフォルト値
        }));
        
        console.log(`✅ MediaPipe ランドマーク検出: ${convertedLandmarks.length}個`);
        console.log('📊 最初のランドマーク:', convertedLandmarks[0]);
        console.log('📊 可視性サンプル:', convertedLandmarks.slice(0, 5).map(l => l.visibility));
        
        setLandmarks(convertedLandmarks);
        setError(null);
      } else {
        console.log('⚠️ MediaPipe: ポーズが検出されませんでした');
        setLandmarks([]);
      }
    } catch (error) {
      console.error('❌ MediaPipe検出エラー:', error);
      setError(`検出エラー: ${error}`);
      setLandmarks([]);
    }
  }, []);

  // 動画解析の開始
  const startAnalysis = useCallback(async (video: HTMLVideoElement) => {
    console.log('🎯 MediaPipe動画解析開始');
    
    if (!detectorRef.current) {
      const initialized = await initializeMediaPipe();
      if (!initialized) return;
    }

    setIsAnalyzing(true);
    setError(null);
    videoRef.current = video;

    const analyzeFrame = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        setIsAnalyzing(false);
        return;
      }

      await detectPose(videoRef.current);
      
      // 次のフレーム解析をスケジュール
      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
    };

    // 解析開始
    analyzeFrame();
  }, [detectPose, initializeMediaPipe]);

  // 解析停止
  const stopAnalysis = useCallback(() => {
    console.log('⏹️ MediaPipe解析停止');
    setIsAnalyzing(false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    videoRef.current = null;
  }, []);

  // クリーンアップ
  const cleanup = useCallback(() => {
    stopAnalysis();
    
    if (detectorRef.current) {
      // MediaPipeのクリーンアップ
      detectorRef.current.close?.();
      detectorRef.current = null;
    }
    
    setLandmarks([]);
    setError(null);
  }, [stopAnalysis]);

  return {
    landmarks,
    isAnalyzing,
    error,
    startAnalysis,
    stopAnalysis,
    cleanup
  };
};
