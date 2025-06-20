import { useState, useRef, useCallback } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

interface AnalysisResult {
  frame: number
  timestamp: number
  landmarks: any[]
  worldLandmarks: any[]
  angles: { hip: number | null }
  confidence: number
}

export function VideoAnalyzerFinal() {
  const [isReady, setIsReady] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [videoInfo, setVideoInfo] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const poseLandmarker = useRef<PoseLandmarker | null>(null)

  // Initialize MediaPipe
  const initializeMediaPipe = async () => {
    try {
      setError(null)
      console.log('MediaPipe初期化開始...')
      
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm'
      )

      poseLandmarker.current = await PoseLandmarker.createFromOptions(filesetResolver, {
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

      console.log('MediaPipe初期化完了')
      setIsReady(true)
    } catch (error) {
      console.error('MediaPipe初期化エラー:', error)
      setError(`MediaPipe初期化に失敗: ${error}`)
    }
  }

  // Force video metadata loading
  const forceLoadVideoMetadata = async (video: HTMLVideoElement): Promise<boolean> => {
    console.log('強制メタデータ読み込み開始...')
    
    return new Promise((resolve) => {
      let attempts = 0
      const maxAttempts = 10
      
      const checkMetadata = () => {
        attempts++
        console.log(`試行 ${attempts}: duration=${video.duration}, readyState=${video.readyState}`)
        
        if (video.duration && !isNaN(video.duration) && video.duration > 0) {
          console.log('✅ メタデータ読み込み成功')
          resolve(true)
          return
        }
        
        if (attempts >= maxAttempts) {
          console.log('❌ メタデータ読み込み失敗')
          resolve(false)
          return
        }
        
        // Try different approaches each attempt
        switch (attempts) {
          case 1:
            video.load()
            break
          case 2:
            video.muted = true
            video.play().then(() => {
              video.pause()
              video.currentTime = 0
            }).catch(() => {})
            break
          case 3:
            video.currentTime = 0.1
            break
          case 4:
            video.currentTime = 1
            break
          case 5:
            video.volume = 0
            video.autoplay = false
            break
        }
        
        setTimeout(checkMetadata, 500)
      }
      
      checkMetadata()
    })
  }

  // Handle video upload with aggressive metadata loading
  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('video/')) {
      setError('動画ファイルを選択してください')
      return
    }

    console.log(`動画ファイル選択: ${file.name} (${(file.size/1024/1024).toFixed(1)}MB)`)
    setVideoFile(file)
    setResults([])
    setCurrentFrame(0)
    setError(null)
    setVideoLoaded(false)
    setVideoDuration(0)
    setVideoInfo('動画読み込み中...')
    
    if (videoRef.current) {
      const video = videoRef.current
      
      // Clean up previous URL
      if (video.src) {
        URL.revokeObjectURL(video.src)
      }
      
      // Create new object URL
      const url = URL.createObjectURL(file)
      video.src = url
      
      // Set video properties for better compatibility
      video.muted = true
      video.playsInline = true
      video.controls = false
      video.autoplay = false
      video.preload = 'metadata'
      
      try {
        // Force load the video
        video.load()
        
        // Wait for any metadata event
        const metadataPromise = new Promise<void>((resolve) => {
          const events = ['loadedmetadata', 'loadeddata', 'canplay', 'durationchange']
          
          const handleAnyEvent = () => {
            events.forEach(event => {
              video.removeEventListener(event, handleAnyEvent)
            })
            resolve()
          }
          
          events.forEach(event => {
            video.addEventListener(event, handleAnyEvent, { once: true })
          })
          
          // Fallback timeout
          setTimeout(resolve, 2000)
        })
        
        await metadataPromise
        
        // Force metadata loading
        const success = await forceLoadVideoMetadata(video)
        
        if (success && video.duration > 0) {
          setVideoDuration(video.duration)
          setVideoLoaded(true)
          setVideoInfo(`✅ 読み込み完了: ${video.duration.toFixed(1)}秒 (${video.videoWidth}x${video.videoHeight})`)
          console.log('動画読み込み完了')
        } else {
          // Last resort: assume 10 seconds duration
          console.log('⚠️ メタデータ取得失敗、デフォルト値使用')
          setVideoDuration(10)
          setVideoLoaded(true)
          setVideoInfo(`⚠️ メタデータ不完全 - 推定10秒として処理`)
        }
        
      } catch (error) {
        console.error('動画読み込みエラー:', error)
        setError('動画の読み込みに失敗しました')
        setVideoInfo('❌ 読み込み失敗')
      }
    }
  }

  // Simple angle calculation
  const calculateHipAngle = (worldLandmarks: any[]): number | null => {
    try {
      if (!worldLandmarks || worldLandmarks.length < 26) return null
      
      const leftHip = worldLandmarks[23]
      const leftKnee = worldLandmarks[25]
      const leftAnkle = worldLandmarks[27]
      
      if (!leftHip || !leftKnee || !leftAnkle) return null

      // Calculate angle between hip-knee and knee-ankle vectors
      const hipKneeVector = {
        x: leftKnee.x - leftHip.x,
        y: leftKnee.y - leftHip.y
      }
      
      const kneeAnkleVector = {
        x: leftAnkle.x - leftKnee.x,
        y: leftAnkle.y - leftKnee.y
      }
      
      const dot = hipKneeVector.x * kneeAnkleVector.x + hipKneeVector.y * kneeAnkleVector.y
      const mag1 = Math.sqrt(hipKneeVector.x**2 + hipKneeVector.y**2)
      const mag2 = Math.sqrt(kneeAnkleVector.x**2 + kneeAnkleVector.y**2)
      
      if (mag1 === 0 || mag2 === 0) return null
      
      const cosAngle = dot / (mag1 * mag2)
      const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI)
      
      return Math.round(angle * 10) / 10
    } catch (error) {
      return null
    }
  }

  // Draw pose overlay
  const drawPoseOverlay = (landmarks: any[], angles: { hip: number | null }, confidence: number) => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = videoRef.current.videoWidth || 640
    canvas.height = videoRef.current.videoHeight || 480

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!landmarks || landmarks.length === 0) return

    // Draw key landmarks only
    const keyPoints = [11, 12, 23, 24, 25, 26, 27, 28] // shoulders, hips, knees, ankles
    keyPoints.forEach(index => {
      const landmark = landmarks[index]
      if (landmark && landmark.visibility > 0.5) {
        const x = landmark.x * canvas.width
        const y = landmark.y * canvas.height
        
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, 2 * Math.PI)
        ctx.fillStyle = '#FF0000'
        ctx.fill()
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })

    // Draw key connections
    const connections = [[11,12], [11,23], [12,24], [23,24], [23,25], [24,26], [25,27], [26,28]]
    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start]
      const endPoint = landmarks[end]
      
      if (startPoint?.visibility > 0.5 && endPoint?.visibility > 0.5) {
        ctx.beginPath()
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height)
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height)
        ctx.strokeStyle = '#00FF00'
        ctx.lineWidth = 3
        ctx.stroke()
      }
    })

    // Draw info
    ctx.font = 'bold 20px Arial'
    ctx.fillStyle = '#FFFF00'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3
    
    let yPos = 40
    if (angles.hip !== null) {
      const text = `膝角度: ${angles.hip}°`
      ctx.strokeText(text, 20, yPos)
      ctx.fillText(text, 20, yPos)
      yPos += 30
    }
    
    const confText = `信頼度: ${(confidence * 100).toFixed(0)}%`
    ctx.strokeText(confText, 20, yPos)
    ctx.fillText(confText, 20, yPos)
    
    const frameText = `${currentFrame + 1}/${results.length}`
    ctx.strokeText(frameText, canvas.width - 100, 40)
    ctx.fillText(frameText, canvas.width - 100, 40)
  }

  const drawCurrentFrame = useCallback(() => {
    if (results.length > 0 && results[currentFrame]) {
      const result = results[currentFrame]
      drawPoseOverlay(result.landmarks, result.angles, result.confidence)
    }
  }, [results, currentFrame])

  // Ultra-simple video analysis
  const analyzeVideo = async () => {
    if (!poseLandmarker.current || !videoRef.current || !videoLoaded) {
      setError('準備が完了していません')
      return
    }

    setIsAnalyzing(true)
    setResults([])
    setError(null)
    
    try {
      const video = videoRef.current
      const duration = videoDuration
      
      console.log(`解析開始: ${duration}秒`)
      
      // Minimal frame analysis
      const frameCount = 10 // Very limited for simplicity
      const analysisResults: AnalysisResult[] = []

      for (let i = 0; i < frameCount; i++) {
        const time = (i / (frameCount - 1)) * duration // Spread frames across video
        
        console.log(`フレーム ${i + 1}/${frameCount} (${time.toFixed(1)}s)`)
        
        try {
          // Simple seek
          video.currentTime = time
          
          // Brief wait
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // Analyze frame
          const result = poseLandmarker.current.detectForVideo(video, time * 1000)
          
          const landmarks = result.landmarks[0] || []
          const worldLandmarks = result.worldLandmarks[0] || []
          
          const confidence = landmarks.length > 0 
            ? landmarks.reduce((sum: number, lm: any) => sum + (lm.visibility || 0), 0) / landmarks.length
            : 0
            
          const hipAngle = calculateHipAngle(worldLandmarks)

          analysisResults.push({
            frame: i,
            timestamp: time,
            landmarks,
            worldLandmarks,
            angles: { hip: hipAngle },
            confidence
          })

          setAnalysisProgress((i + 1) / frameCount * 100)
          
        } catch (error) {
          console.warn(`フレーム ${i} エラー:`, error)
        }
      }

      setResults(analysisResults)
      setCurrentFrame(0)
      console.log(`解析完了: ${analysisResults.length}フレーム`)
      
      if (analysisResults.length > 0) {
        video.currentTime = 0
        setTimeout(drawCurrentFrame, 200)
      }
    } catch (error) {
      console.error('解析エラー:', error)
      setError(`解析失敗: ${error}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Navigate frames
  const goToFrame = (frameIndex: number) => {
    if (!videoRef.current || !results.length) return
    
    const clampedFrame = Math.max(0, Math.min(frameIndex, results.length - 1))
    setCurrentFrame(clampedFrame)
    
    const timestamp = results[clampedFrame].timestamp
    videoRef.current.currentTime = timestamp
    
    setTimeout(drawCurrentFrame, 100)
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">動画姿勢解析ツール（最終版）</h1>
        <p className="text-gray-600">メタデータ読み込み強制実行・超シンプル解析</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-medium">⚠️ {error}</div>
        </div>
      )}

      {/* Initialize MediaPipe */}
      {!isReady && (
        <div className="bg-white rounded-lg border p-8 text-center">
          <button 
            onClick={initializeMediaPipe}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            🚀 MediaPipe初期化
          </button>
        </div>
      )}

      {/* Video Upload */}
      {isReady && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">📁 動画アップロード</h2>
          <input
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          
          {videoFile && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm space-y-1">
                <div>📁 {videoFile.name}</div>
                <div>📏 {(videoFile.size / 1024 / 1024).toFixed(1)} MB</div>
                <div className={videoLoaded ? 'text-green-600' : 'text-yellow-600'}>
                  {videoInfo}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Analysis */}
      {videoFile && videoLoaded && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">🎥 動画解析</h2>
          
          <div className="relative bg-gray-900 rounded-lg overflow-hidden mb-4">
            <video
              ref={videoRef}
              className="w-full aspect-video object-contain"
              controls={!isAnalyzing}
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>

          <div className="space-y-4">
            <button
              onClick={analyzeVideo}
              disabled={isAnalyzing}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-lg"
            >
              {isAnalyzing ? `🔄 解析中... ${analysisProgress.toFixed(0)}%` : '🔍 動画解析開始 (10フレーム)'}
            </button>

            {isAnalyzing && (
              <div className="bg-gray-200 rounded-full h-4">
                <div 
                  className="bg-green-600 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => goToFrame(currentFrame - 1)}
                    disabled={currentFrame <= 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                  >
                    ← 前
                  </button>
                  
                  <input
                    type="range"
                    min="0"
                    max={results.length - 1}
                    value={currentFrame}
                    onChange={(e) => goToFrame(parseInt(e.target.value))}
                    className="flex-1 h-3"
                  />
                  
                  <button
                    onClick={() => goToFrame(currentFrame + 1)}
                    disabled={currentFrame >= results.length - 1}
                    className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                  >
                    次 →
                  </button>
                </div>

                <div className="text-center bg-gray-50 p-3 rounded-lg">
                  <div className="font-medium">
                    フレーム {currentFrame + 1} / {results.length}
                  </div>
                  {results[currentFrame] && (
                    <div className="text-sm text-gray-600 mt-1">
                      {results[currentFrame].angles.hip && (
                        <span>膝角度: {results[currentFrame].angles.hip}° | </span>
                      )}
                      信頼度: {(results[currentFrame].confidence * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results Summary */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">📊 解析結果</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{results.length}</div>
              <div className="text-sm text-blue-600">解析フレーム数</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {(results.reduce((sum, r) => sum + (r.angles.hip || 0), 0) / results.length).toFixed(1)}°
              </div>
              <div className="text-sm text-green-600">平均膝角度</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(results.filter(r => r.landmarks.length > 0).length / results.length * 100)}%
              </div>
              <div className="text-sm text-purple-600">姿勢検出率</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}