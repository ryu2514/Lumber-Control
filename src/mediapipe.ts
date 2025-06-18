import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { PoseAnalysisResult } from './types'

export class MediaPipeService {
  private poseLandmarker: PoseLandmarker | null = null
  private lastVideoTime = -1

  async initialize(): Promise<void> {
    try {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm'
      )

      this.poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      })
    } catch (error) {
      throw new Error(`MediaPipe初期化失敗: ${error}`)
    }
  }

  async detectPose(video: HTMLVideoElement): Promise<PoseAnalysisResult | null> {
    if (!this.poseLandmarker) return null

    try {
      const videoTime = video.currentTime * 1000
      if (videoTime === this.lastVideoTime) return null
      
      this.lastVideoTime = videoTime
      const result = this.poseLandmarker.detectForVideo(video, videoTime)
      
      if (result.landmarks.length === 0) return null

      return {
        landmarks: result,
        timestamp: Date.now(),
        confidence: result.landmarks[0].filter((l: any) => l.visibility > 0.5).length / result.landmarks[0].length
      }
    } catch (error) {
      console.error('姿勢検出エラー:', error)
      return null
    }
  }

  cleanup(): void {
    this.poseLandmarker?.close()
    this.poseLandmarker = null
  }
}