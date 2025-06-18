import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { MediaPipeConfig, MediaPipeService, PoseAnalysisResult } from './types'
import { DEFAULT_MEDIAPIPE_CONFIG } from './config'

export class MediaPipePoseService implements MediaPipeService {
  public poseLandmarker: PoseLandmarker | null = null
  private config: MediaPipeConfig
  private lastVideoTime = -1

  constructor(config: MediaPipeConfig = DEFAULT_MEDIAPIPE_CONFIG) {
    this.config = config
  }

  async initialize(): Promise<void> {
    try {
      console.log('MediaPipe初期化開始...')
      
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm'
      )

      this.poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: this.config.baseOptions,
        runningMode: this.config.runningMode,
        numPoses: this.config.numPoses,
        minPoseDetectionConfidence: this.config.minPoseDetectionConfidence,
        minPosePresenceConfidence: this.config.minPosePresenceConfidence,
        minTrackingConfidence: this.config.minTrackingConfidence,
        outputSegmentationMasks: this.config.outputSegmentationMasks
      })

      console.log('MediaPipe初期化完了')
    } catch (error) {
      console.error('MediaPipe初期化エラー:', error)
      throw new Error(`MediaPipe初期化に失敗しました: ${error}`)
    }
  }

  async detectPose(imageSource: HTMLVideoElement | HTMLImageElement): Promise<PoseAnalysisResult | null> {
    if (!this.poseLandmarker) {
      throw new Error('MediaPipeが初期化されていません')
    }

    try {
      let result
      const currentTime = Date.now()

      if (imageSource instanceof HTMLVideoElement) {
        const videoTime = imageSource.currentTime * 1000
        if (videoTime === this.lastVideoTime) {
          return null
        }
        this.lastVideoTime = videoTime
        result = this.poseLandmarker.detectForVideo(imageSource, videoTime)
      } else {
        result = this.poseLandmarker.detect(imageSource)
      }

      if (result.landmarks.length === 0) {
        return null
      }

      const confidence = this.calculateOverallConfidence(result)

      return {
        landmarks: result,
        timestamp: currentTime,
        confidence
      }
    } catch (error) {
      console.error('姿勢検出エラー:', error)
      return null
    }
  }

  private calculateOverallConfidence(result: any): number {
    if (!result.landmarks || result.landmarks.length === 0) return 0
    
    const landmarks = result.landmarks[0]
    const validLandmarks = landmarks.filter((landmark: any) => landmark.visibility > 0.5)
    
    return validLandmarks.length / landmarks.length
  }

  cleanup(): void {
    if (this.poseLandmarker) {
      this.poseLandmarker.close()
      this.poseLandmarker = null
    }
    console.log('MediaPipe cleanup完了')
  }
}