// src/inference/mediapipe/poseLandmarkerService.ts (完成版)

import {
  FilesetResolver,
  PoseLandmarker,
  PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { Landmark } from '../../types';

export class PoseLandmarkerService {
  private poseLandmarker: PoseLandmarker | null = null;
  private lastVideoTime = -1;

  // --- ↓↓↓ ここを修正 (1/3) ---
  // onResultsCallback という名前を、より分かりやすい resultCallback に変更し、
  // 型定義に timestamp を追加しました。
  private resultCallback: ((landmarks: Landmark[], timestamp: number) => void) | null = null;

  /**
   * Initialize the MediaPipe Pose Landmarker
   */
  async initialize(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  }

  /**
   * Set callback for result processing
   */
  // --- ↓↓↓ ここを修正 (2/3) ---
  // onResultsCallback という名前を resultCallback に変更し、
  // 型定義に timestamp を追加しました。
  setResultCallback(callback: (landmarks: Landmark[], timestamp: number) => void): void {
    this.resultCallback = callback;
  }

  /**
   * Process a video frame
   */
  processVideoFrame(videoElement: HTMLVideoElement, timestamp: number): void {
    if (!this.poseLandmarker) {
      console.error('Pose Landmarker not initialized');
      return;
    }

    if (videoElement.currentTime === this.lastVideoTime) {
      return;
    }

    this.lastVideoTime = videoElement.currentTime;

    const results: PoseLandmarkerResult = this.poseLandmarker.detectForVideo(
      videoElement,
      timestamp
    );

    // --- ↓↓↓ ここを修正 (3/3) ---
    // resultCallbackを呼び出す際に、2つ目の引数として timestamp を渡します。
    if (results.landmarks && results.landmarks.length > 0 && this.resultCallback) {
      this.resultCallback(results.landmarks[0], timestamp);
    }
  }

  /**
   * Release resources
   */
  close(): void {
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
  }
}