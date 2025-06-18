import { useRef, useCallback, useState } from 'react';
import { Landmark, TestType, TestResult } from '../../types';
import { StandingHipFlexionAnalyzer } from '../../inference/analyzers/standingHipFlexionAnalyzer';
import { RockBackAnalyzer } from '../../inference/analyzers/rockBackAnalyzer';
import { SittingKneeExtensionAnalyzer } from '../../inference/analyzers/sittingKneeExtensionAnalyzer';

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

export const useVideoAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const detectorRef = useRef<any>(null);
  const isAnalyzingRef = useRef(false);
  const analyzersRef = useRef({
    [TestType.STANDING_HIP_FLEXION]: new StandingHipFlexionAnalyzer(),
    [TestType.ROCK_BACK]: new RockBackAnalyzer(),
    [TestType.SITTING_KNEE_EXTENSION]: new SittingKneeExtensionAnalyzer()
  });

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

  // 動画ファイルの解析
  const analyzeVideo = useCallback(async (video: HTMLVideoElement, currentTest?: TestType, onLandmarksUpdate?: (landmarks: Landmark[]) => void) => {
    if (!detectorRef.current) {
      const initialized = await initializeMediaPipe();
      if (!initialized) return [];
    }

    setIsAnalyzing(true);
    setError(null);
    setProgress(0);
    setTestResult(null);
    isAnalyzingRef.current = true;

    const allLandmarks: Landmark[][] = [];
    const duration = video.duration;
    const frameRate = 30; // 30fps で解析
    const frameInterval = 1 / frameRate;

    try {
      for (let currentTime = 0; currentTime < duration && isAnalyzingRef.current; currentTime += frameInterval) {
        // 動画の現在時刻を設定
        video.currentTime = currentTime;
        
        // フレームの読み込みを待つ
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
        });

        // MediaPipeでポーズ検出
        const startTime = performance.now();
        const result: MediaPipeResult = await detectorRef.current.detectForVideo(video, startTime);
        
        if (result.landmarks && result.landmarks.length > 0) {
          // MediaPipeの結果をLandmark形式に変換
          const mediapipeLandmarks = result.landmarks[0];
          
          const convertedLandmarks: Landmark[] = mediapipeLandmarks.map((landmark: MediaPipeLandmark) => ({
            x: landmark.x,
            y: landmark.y,
            z: landmark.z || 0,
            visibility: landmark.visibility || 0.8
          }));
          
          allLandmarks.push(convertedLandmarks);
          setLandmarks(convertedLandmarks);
          
          // リアルタイム更新のコールバック
          if (onLandmarksUpdate) {
            onLandmarksUpdate(convertedLandmarks);
          }
        } else {
          // ポーズが検出されなかった場合は空の配列を追加
          allLandmarks.push([]);
          setLandmarks([]);
        }

        // 進捗更新
        const progressPercent = (currentTime / duration) * 100;
        setProgress(progressPercent);
      }

      // 解析完了後、最終的なテスト結果を生成
      if (currentTest && allLandmarks.length > 0) {
        const analyzer = analyzersRef.current[currentTest];
        if (analyzer) {
          try {
            // 最後のフレームのランドマークと全履歴を使用して解析
            const lastFrame = allLandmarks[allLandmarks.length - 1];
            if (lastFrame && lastFrame.length > 0) {
              const result = analyzer.analyze(lastFrame, allLandmarks);
              setTestResult(result);
              console.log(`📊 動画 ${currentTest} 解析結果:`, result);
            }
          } catch (analyzeError) {
            console.error('❌ 動画解析エラー:', analyzeError);
          }
        }
      }

      console.log(`✅ 動画解析完了: ${allLandmarks.length}フレーム処理`);
      return allLandmarks;

    } catch (error) {
      console.error('❌ 動画解析エラー:', error);
      setError(`解析エラー: ${error}`);
      return [];
    } finally {
      setIsAnalyzing(false);
      setProgress(100);
      isAnalyzingRef.current = false;
    }
  }, [initializeMediaPipe]);

  // 解析停止
  const stopAnalysis = useCallback(() => {
    console.log('⏹️ 動画解析停止');
    isAnalyzingRef.current = false;
    setIsAnalyzing(false);
  }, []);

  // クリーンアップ
  const cleanup = useCallback(() => {
    stopAnalysis();
    
    if (detectorRef.current) {
      detectorRef.current.close?.();
      detectorRef.current = null;
    }
    
    setLandmarks([]);
    setError(null);
    setProgress(0);
    setTestResult(null);
  }, [stopAnalysis]);

  return {
    landmarks,
    isAnalyzing,
    error,
    progress,
    testResult,
    analyzeVideo,
    stopAnalysis,
    cleanup
  };
};