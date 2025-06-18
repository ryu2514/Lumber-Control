/**
 * Pose Landmarker Service
 * MediaPipe Pose Landmarkerの統合サービスクラス
 */

import type {
  MediaPipeConfig,
  MediaPipeResult,
  MediaPipeLandmark,
  Landmark,
  PoseLandmarkerInstance,
  InitializationResult,
  AnalysisOptions,
  MediaPipeError,
  MediaPipeDebugInfo
} from './types';

import {
  DEFAULT_MEDIAPIPE_CONFIG,
  HIGH_ACCURACY_CONFIG,
  HIGH_SPEED_CONFIG,
  MEDIAPIPE_CDN,
  DEFAULT_ANALYSIS_OPTIONS,
  DEBUG_CONFIG
} from './config';

export class PoseLandmarkerService {
  private detector: PoseLandmarkerInstance | null = null;
  private isInitialized = false;
  private currentConfig: MediaPipeConfig;
  private analysisOptions: AnalysisOptions;
  private performanceStats = {
    detectionTimes: [] as number[],
    frameCount: 0,
    startTime: 0
  };

  constructor(
    config: Partial<MediaPipeConfig> = {},
    options: Partial<AnalysisOptions> = {}
  ) {
    this.currentConfig = { ...DEFAULT_MEDIAPIPE_CONFIG, ...config };
    this.analysisOptions = { ...DEFAULT_ANALYSIS_OPTIONS, ...options };
  }

  /**
   * MediaPipeの初期化
   */
  async initialize(): Promise<InitializationResult> {
    try {
      console.log('🚀 MediaPipe Pose Landmarker 初期化開始...');
      
      if (this.isInitialized && this.detector) {
        console.log('✅ 既に初期化済み');
        return { success: true, detector: this.detector };
      }

      // CDNスクリプトの動的読み込み
      await this.loadMediaPipeScript();

      // FilesetResolverの初期化
      const vision = window.MediaPipeTasksVision;
      if (!vision) {
        throw new Error('MediaPipe Vision ライブラリが読み込まれていません');
      }

      console.log('🔧 FilesetResolver初期化中...');
      const filesetResolver = await vision.FilesetResolver.forVisionTasks(
        MEDIAPIPE_CDN.WASM_PATH
      );

      // PoseLandmarkerの作成
      console.log('🔧 PoseLandmarker作成中...', this.currentConfig);
      const poseLandmarker = await vision.PoseLandmarker.createFromOptions(
        filesetResolver,
        {
          baseOptions: {
            modelAssetPath: this.currentConfig.modelAssetPath,
            delegate: this.currentConfig.delegate
          },
          runningMode: this.currentConfig.runningMode,
          numPoses: this.currentConfig.numPoses,
          minPoseDetectionConfidence: this.currentConfig.minPoseDetectionConfidence,
          minPosePresenceConfidence: this.currentConfig.minPosePresenceConfidence,
          minTrackingConfidence: this.currentConfig.minTrackingConfidence,
          outputSegmentationMasks: this.currentConfig.outputSegmentationMasks
        }
      );

      this.detector = poseLandmarker;
      this.isInitialized = true;
      this.performanceStats.startTime = performance.now();

      console.log('✅ MediaPipe Pose Landmarker 初期化完了');
      return { success: true, detector: this.detector || undefined };

    } catch (error) {
      const mediaError: MediaPipeError = {
        code: 'INITIALIZATION_FAILED',
        message: `初期化に失敗しました: ${error}`,
        details: error
      };
      
      console.error('❌ MediaPipe初期化エラー:', mediaError);
      return { success: false, error: mediaError.message };
    }
  }

  /**
   * 動画からのポーズ検出
   */
  async detectPose(video: HTMLVideoElement): Promise<Landmark[]> {
    if (!this.isInitialized || !this.detector) {
      throw new Error('MediaPipeが初期化されていません');
    }

    const startTime = performance.now();

    try {
      // MediaPipeでポーズ検出実行
      const result: MediaPipeResult = await this.detector.detectForVideo(
        video,
        startTime
      );

      const detectionTime = performance.now() - startTime;
      this.updatePerformanceStats(detectionTime);

      if (result.landmarks && result.landmarks.length > 0) {
        const landmarks = this.convertToAppLandmarks(result.landmarks[0]);
        
        if (DEBUG_CONFIG.LOG_DETECTION_TIME) {
          console.log(`⚡ 検出時間: ${detectionTime.toFixed(2)}ms, ランドマーク: ${landmarks.length}`);
        }

        return landmarks;
      }

      return [];

    } catch (error) {
      console.error('❌ ポーズ検出エラー:', error);
      throw new Error(`ポーズ検出に失敗: ${error}`);
    }
  }

  /**
   * 高精度モードに切り替え
   */
  async switchToHighAccuracy(): Promise<boolean> {
    return this.reinitialize(HIGH_ACCURACY_CONFIG);
  }

  /**
   * 高速モードに切り替え
   */
  async switchToHighSpeed(): Promise<boolean> {
    return this.reinitialize(HIGH_SPEED_CONFIG);
  }

  /**
   * 設定を変更して再初期化
   */
  async reinitialize(newConfig: Partial<MediaPipeConfig>): Promise<boolean> {
    console.log('🔄 MediaPipe再初期化中...');
    
    this.cleanup();
    this.currentConfig = { ...this.currentConfig, ...newConfig };
    
    const result = await this.initialize();
    return result.success;
  }

  /**
   * デバッグ情報の取得
   */
  getDebugInfo(): MediaPipeDebugInfo {
    const stats = this.calculatePerformanceStats();
    
    return {
      isInitialized: this.isInitialized,
      modelLoaded: this.detector !== null,
      lastDetectionTime: stats.averageDetectionTime,
      performanceStats: {
        averageDetectionTime: stats.averageDetectionTime,
        frameRate: stats.frameRate,
        memoryUsage: this.estimateMemoryUsage()
      }
    };
  }

  /**
   * リソースのクリーンアップ
   */
  cleanup(): void {
    if (this.detector) {
      this.detector.close();
      this.detector = null;
    }
    
    this.isInitialized = false;
    this.performanceStats = {
      detectionTimes: [],
      frameCount: 0,
      startTime: 0
    };
    
    console.log('🧹 MediaPipe リソースクリーンアップ完了');
  }

  /**
   * 現在の設定を取得
   */
  getCurrentConfig(): MediaPipeConfig {
    return { ...this.currentConfig };
  }

  /**
   * 解析オプションの更新
   */
  updateAnalysisOptions(options: Partial<AnalysisOptions>): void {
    this.analysisOptions = { ...this.analysisOptions, ...options };
  }

  // Private Methods

  private async loadMediaPipeScript(): Promise<void> {
    if (window.MediaPipeTasksVision) {
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = MEDIAPIPE_CDN.VISION_BUNDLE;
      script.onload = () => {
        console.log('✅ MediaPipe CDNスクリプト読み込み完了');
        resolve();
      };
      script.onerror = (error) => {
        console.error('❌ MediaPipe CDNスクリプト読み込み失敗:', error);
        reject(new Error('MediaPipe script loading failed'));
      };
      
      document.head.appendChild(script);
    });
  }

  private convertToAppLandmarks(mediapipeLandmarks: MediaPipeLandmark[]): Landmark[] {
    return mediapipeLandmarks.map((landmark) => ({
      x: landmark.x,
      y: landmark.y,
      z: landmark.z || 0,
      visibility: landmark.visibility || 0.5
    }));
  }

  private updatePerformanceStats(detectionTime: number): void {
    this.performanceStats.detectionTimes.push(detectionTime);
    this.performanceStats.frameCount++;

    // 最新100フレームのみを保持
    if (this.performanceStats.detectionTimes.length > 100) {
      this.performanceStats.detectionTimes.shift();
    }
  }

  private calculatePerformanceStats() {
    const times = this.performanceStats.detectionTimes;
    const averageDetectionTime = times.length > 0 
      ? times.reduce((sum, time) => sum + time, 0) / times.length 
      : 0;

    const elapsedTime = (performance.now() - this.performanceStats.startTime) / 1000;
    const frameRate = elapsedTime > 0 ? this.performanceStats.frameCount / elapsedTime : 0;

    return {
      averageDetectionTime,
      frameRate
    };
  }

  private estimateMemoryUsage(): number {
    // 簡易的なメモリ使用量推定
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / (1024 * 1024); // MB
    }
    return 0;
  }
}