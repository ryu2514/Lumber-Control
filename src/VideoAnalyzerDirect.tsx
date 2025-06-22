import { useState, useRef, useCallback } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

interface BlazePoseLandmark {
  x: number
  y: number
  z: number
  visibility: number
}

interface AnalysisResult {
  frame: number
  timestamp: number
  landmarks: BlazePoseLandmark[]
  worldLandmarks: BlazePoseLandmark[]
  confidence: number
  angles: {
    hipFlexion: number | null
    kneeFlexion: number | null
    ankleFlexion: number | null
    spinalAlignment: number | null
  }
}

export function VideoAnalyzerDirect() {
  const [isReady, setIsReady] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const processingCanvasRef = useRef<HTMLCanvasElement>(null)
  const poseLandmarker = useRef<PoseLandmarker | null>(null)

  const log = (message: string) => {
    const time = new Date().toLocaleTimeString()
    const logMsg = `[${time}] ${message}`
    console.log(logMsg)
    setLogs(prev => [...prev.slice(-25), logMsg])
  }

  // Initialize MediaPipe with BlazePose GHUM
  const initializeMediaPipe = async () => {
    try {
      setError(null)
      log('MediaPipe BlazePose GHUM 初期化開始')
      
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm'
      )

      poseLandmarker.current = await PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
          delegate: 'GPU'
        },
        runningMode: 'IMAGE',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false
      })

      log('MediaPipe BlazePose GHUM 初期化完了 - 33点高精度ランドマーク対応')
      setIsReady(true)
    } catch (error) {
      log(`MediaPipe初期化失敗: ${error}`)
      setError(`MediaPipe初期化失敗: ${error}`)
    }
  }

  // Handle video upload with user interaction detection
  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('video/')) {
      setError('動画ファイルを選択してください')
      return
    }

    log(`動画選択: ${file.name} (${(file.size/1024/1024).toFixed(1)}MB)`)
    setVideoFile(file)
    setResults([])
    setCurrentFrame(0)
    setError(null)
    setLogs([])
    setNeedsUserInteraction(true)
    
    if (videoRef.current) {
      if (videoRef.current.src) {
        URL.revokeObjectURL(videoRef.current.src)
      }
      
      const url = URL.createObjectURL(file)
      videoRef.current.src = url
      videoRef.current.muted = true
      videoRef.current.playsInline = true
      videoRef.current.controls = true
      videoRef.current.preload = 'none' // Don't preload to avoid metadata issues
      
      // Set up user interaction listener
      const handleUserPlay = () => {
        log('ユーザー操作検出 - 動画準備完了')
        setNeedsUserInteraction(false)
        videoRef.current?.removeEventListener('play', handleUserPlay)
      }
      
      videoRef.current.addEventListener('play', handleUserPlay, { once: true })
      
      log('動画ファイル準備完了 - ユーザー操作待機')
    }
  }

  // Direct canvas processing without video metadata dependency
  const processVideoFrame = async (video: HTMLVideoElement, targetTime: number): Promise<ImageData | null> => {
    return new Promise((resolve) => {
      const canvas = processingCanvasRef.current
      if (!canvas) {
        resolve(null)
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }

      let resolved = false

      const captureFrame = () => {
        if (resolved) return
        resolved = true

        try {
          // Use standard video dimensions or fallback
          const width = Math.max(video.videoWidth, 640)
          const height = Math.max(video.videoHeight, 480)
          
          canvas.width = width
          canvas.height = height
          
          // Draw current video frame
          ctx.drawImage(video, 0, 0, width, height)
          
          // Get image data for MediaPipe
          const imageData = ctx.getImageData(0, 0, width, height)
          log(`フレーム取得成功: ${width}x${height}, データ長=${imageData.data.length}`)
          resolve(imageData)
        } catch (e) {
          log(`フレーム取得失敗: ${e}`)
          resolve(null)
        }
      }

      // Set video time and capture
      video.currentTime = targetTime
      
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked)
        setTimeout(captureFrame, 100)
      }
      
      video.addEventListener('seeked', onSeeked, { once: true })
      
      // Fallback timeout
      setTimeout(() => {
        if (!resolved) {
          log('シークタイムアウト - 現在フレーム使用')
          captureFrame()
        }
      }, 2000)
    })
  }

  // BlazePose GHUM angle calculations for lumbar motor control
  const calculateLumbarAngles = (worldLandmarks: BlazePoseLandmark[]) => {
    const calculateAngle = (p1: BlazePoseLandmark, p2: BlazePoseLandmark, p3: BlazePoseLandmark): number | null => {
      try {
        // Use world coordinates for accurate 3D angles
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z }
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z }

        const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z)
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z)

        if (mag1 === 0 || mag2 === 0) return null

        const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)))
        const angle = Math.acos(cosAngle) * (180 / Math.PI)
        return Math.round(angle * 10) / 10
      } catch (error) {
        return null
      }
    }

    if (worldLandmarks.length < 33) {
      return { hipFlexion: null, kneeFlexion: null, ankleFlexion: null, spinalAlignment: null }
    }

    // BlazePose GHUM landmark indices
    const leftShoulder = worldLandmarks[11]  // LEFT_SHOULDER
    const leftHip = worldLandmarks[23]       // LEFT_HIP
    const leftKnee = worldLandmarks[25]      // LEFT_KNEE
    const leftAnkle = worldLandmarks[27]     // LEFT_ANKLE
    const leftToe = worldLandmarks[31]       // LEFT_FOOT_INDEX

    return {
      // Hip flexion: trunk to thigh angle
      hipFlexion: calculateAngle(leftShoulder, leftHip, leftKnee),
      
      // Knee flexion: thigh to shin angle  
      kneeFlexion: calculateAngle(leftHip, leftKnee, leftAnkle),
      
      // Ankle flexion: shin to foot angle
      ankleFlexion: calculateAngle(leftKnee, leftAnkle, leftToe),
      
      // Spinal alignment: shoulder to hip vertical deviation
      spinalAlignment: leftShoulder && leftHip ? 
        Math.abs(leftShoulder.x - leftHip.x) * 180 / Math.PI : null
    }
  }

  // Draw BlazePose GHUM pose with all 33 landmarks
  const drawBlazePose = (landmarks: BlazePoseLandmark[], angles: any, confidence: number) => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = Math.max(videoRef.current.videoWidth, 640)
    canvas.height = Math.max(videoRef.current.videoHeight, 480)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!landmarks || landmarks.length === 0) return

    // BlazePose GHUM 33 landmarks visualization
    landmarks.forEach((landmark, index) => {
      if (landmark.visibility > 0.01) { // Very low threshold for all points
        const x = landmark.x * canvas.width
        const y = landmark.y * canvas.height
        
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, 2 * Math.PI)
        
        // Color coding by body part
        if ([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(index)) {
          ctx.fillStyle = '#FF0000' // Face - Red
        } else if ([11, 12, 13, 14, 15, 16].includes(index)) {
          ctx.fillStyle = '#00FF00' // Arms - Green
        } else if ([17, 18, 19, 20, 21, 22].includes(index)) {
          ctx.fillStyle = '#0000FF' // Hands - Blue
        } else if ([23, 24].includes(index)) {
          ctx.fillStyle = '#FFD700' // Hips - Gold
        } else if ([25, 26, 27, 28].includes(index)) {
          ctx.fillStyle = '#FF69B4' // Legs - Pink
        } else {
          ctx.fillStyle = '#00FFFF' // Feet - Cyan
        }
        
        ctx.fill()
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    })

    // Draw key connections for pose structure
    const connections = [
      [11, 12], [11, 13], [12, 14], [13, 15], [14, 16], // Arms
      [11, 23], [12, 24], [23, 24], // Torso
      [23, 25], [24, 26], [25, 27], [26, 28], // Legs
      [27, 29], [28, 30], [29, 31], [30, 32] // Feet
    ]

    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start]
      const endPoint = landmarks[end]
      
      if (startPoint?.visibility > 0.01 && endPoint?.visibility > 0.01) {
        ctx.beginPath()
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height)
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height)
        ctx.strokeStyle = '#00FF00'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })

    // Draw lumbar motor control analysis info
    ctx.font = 'bold 20px Arial'
    ctx.fillStyle = '#FFFF00'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3
    
    let yPos = 40
    if (angles.hipFlexion !== null) {
      const text = `股関節屈曲: ${angles.hipFlexion}°`
      ctx.strokeText(text, 20, yPos)
      ctx.fillText(text, 20, yPos)
      yPos += 30
    }
    if (angles.kneeFlexion !== null) {
      const text = `膝関節屈曲: ${angles.kneeFlexion}°`
      ctx.strokeText(text, 20, yPos)
      ctx.fillText(text, 20, yPos)
      yPos += 30
    }
    if (angles.ankleFlexion !== null) {
      const text = `足関節背屈: ${angles.ankleFlexion}°`
      ctx.strokeText(text, 20, yPos)
      ctx.fillText(text, 20, yPos)
      yPos += 30
    }
    if (angles.spinalAlignment !== null) {
      const text = `脊椎アライメント: ${angles.spinalAlignment.toFixed(1)}°`
      ctx.strokeText(text, 20, yPos)
      ctx.fillText(text, 20, yPos)
      yPos += 30
    }
    
    const confText = `検出精度: ${(confidence * 100).toFixed(0)}%`
    ctx.strokeText(confText, 20, yPos)
    ctx.fillText(confText, 20, yPos)
  }

  const drawCurrentFrame = useCallback(() => {
    if (results.length > 0 && results[currentFrame]) {
      const result = results[currentFrame]
      drawBlazePose(result.landmarks, result.angles, result.confidence)
    }
  }, [results, currentFrame])

  // DIRECT PROCESSING ANALYSIS - No metadata dependency
  const analyzeVideo = async () => {
    if (!poseLandmarker.current || !videoRef.current || !videoFile) {
      setError('準備が完了していません')
      return
    }

    if (needsUserInteraction) {
      setError('先に動画を手動で再生してください')
      return
    }

    setIsAnalyzing(true)
    setResults([])
    setError(null)
    log('BlazePose GHUM 腰椎モーターコントロール解析開始')
    
    try {
      const video = videoRef.current
      
      // Force video to be ready for processing
      log('動画処理準備')
      try {
        video.pause()
        video.currentTime = 0
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (e) {
        log(`動画準備警告: ${e}`)
      }

      // Use estimated duration or default
      const estimatedDuration = 10 // seconds
      log(`推定動画長: ${estimatedDuration}秒 - メタデータ不使用`)
      
      const frameCount = 5 // Multiple frames for motor control analysis
      const analysisResults: AnalysisResult[] = []

      for (let i = 0; i < frameCount; i++) {
        const time = (i / (frameCount - 1)) * estimatedDuration
        
        log(`フレーム ${i + 1}/${frameCount}: ${time.toFixed(1)}s`)
        
        try {
          // Process frame directly
          const imageData = await processVideoFrame(video, time)
          
          if (!imageData) {
            log(`フレーム ${i + 1}: 画像データ取得失敗`)
            continue
          }

          // Create ImageData for MediaPipe
          log(`フレーム ${i + 1}: BlazePose GHUM 解析実行`)
          
          // Convert ImageData to canvas for MediaPipe
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = imageData.width
          tempCanvas.height = imageData.height
          const tempCtx = tempCanvas.getContext('2d')!
          tempCtx.putImageData(imageData, 0, 0)
          
          const result = poseLandmarker.current.detect(tempCanvas)
          
          const landmarks: BlazePoseLandmark[] = result.landmarks[0] || []
          const worldLandmarks: BlazePoseLandmark[] = result.worldLandmarks[0] || []
          
          if (landmarks.length > 0) {
            const confidence = landmarks.reduce((sum, lm) => sum + (lm.visibility || 0), 0) / landmarks.length
            const angles = calculateLumbarAngles(worldLandmarks)

            analysisResults.push({
              frame: i,
              timestamp: time,
              landmarks,
              worldLandmarks,
              angles,
              confidence
            })

            log(`フレーム ${i + 1}: 成功 - ${landmarks.length}点検出, 股関節=${angles.hipFlexion}°`)
          } else {
            log(`フレーム ${i + 1}: ポーズ検出なし`)
          }

          setAnalysisProgress((i + 1) / frameCount * 100)
          
        } catch (error) {
          log(`フレーム ${i + 1} エラー: ${error}`)
        }
      }

      setResults(analysisResults)
      setCurrentFrame(0)
      log(`腰椎モーターコントロール解析完了: ${analysisResults.length}フレーム`)
      
      if (analysisResults.length > 0) {
        video.currentTime = 0
        setTimeout(drawCurrentFrame, 300)
      } else {
        setError('BlazePose GHUM でポーズ検出できませんでした')
      }
    } catch (error) {
      log(`解析失敗: ${error}`)
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
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">BlazePose GHUM 腰椎モーターコントロール解析</h1>
        <p className="text-gray-600">MediaPipe 33点高精度ランドマーク・理学療法評価システム</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-medium">⚠️ {error}</div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <h3 className="font-medium mb-2">🔍 解析ログ</h3>
          <div className="bg-black text-green-400 p-3 rounded text-sm font-mono max-h-40 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* Initialize MediaPipe */}
      {!isReady && (
        <div className="bg-white rounded-lg border p-8 text-center">
          <button 
            onClick={initializeMediaPipe}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            🚀 BlazePose GHUM 初期化
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
              <div className="text-sm space-y-2">
                <div>📁 {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)</div>
                
                {needsUserInteraction ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <div className="text-yellow-800 font-medium text-sm">
                      ⚠️ 動画を一度手動で再生してください
                    </div>
                    <div className="text-yellow-700 text-xs mt-1">
                      ブラウザ制限により、ユーザー操作が必要です
                    </div>
                  </div>
                ) : (
                  <div className="text-green-600">
                    ✅ BlazePose GHUM 解析準備完了
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Analysis */}
      {videoFile && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">🎥 腰椎モーターコントロール解析</h2>
          
          <div className="relative bg-gray-900 rounded-lg overflow-hidden mb-4">
            <video
              ref={videoRef}
              className="w-full aspect-video object-contain"
              controls={true}
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>

          {/* Hidden processing canvas */}
          <canvas
            ref={processingCanvasRef}
            style={{ display: 'none' }}
          />

          <div className="space-y-4">
            <button
              onClick={analyzeVideo}
              disabled={isAnalyzing || needsUserInteraction}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-lg"
            >
              {isAnalyzing ? `🔄 BlazePose解析中... ${analysisProgress.toFixed(0)}%` : 
               needsUserInteraction ? '⚠️ 先に動画を再生してください' :
               '🔍 腰椎モーターコントロール解析開始'}
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
                    <div className="text-sm text-gray-600 mt-1 grid grid-cols-2 gap-2">
                      <div>股関節: {results[currentFrame].angles.hipFlexion || 'N/A'}°</div>
                      <div>膝関節: {results[currentFrame].angles.kneeFlexion || 'N/A'}°</div>
                      <div>足関節: {results[currentFrame].angles.ankleFlexion || 'N/A'}°</div>
                      <div>精度: {(results[currentFrame].confidence * 100).toFixed(0)}%</div>
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
          <h2 className="text-lg font-semibold mb-4">📊 腰椎モーターコントロール評価結果</h2>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{results.length}</div>
              <div className="text-sm text-blue-600">解析フレーム数</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {(results.reduce((sum, r) => sum + (r.angles.hipFlexion || 0), 0) / results.length).toFixed(1)}°
              </div>
              <div className="text-sm text-green-600">平均股関節屈曲</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {(results.reduce((sum, r) => sum + (r.angles.kneeFlexion || 0), 0) / results.length).toFixed(1)}°
              </div>
              <div className="text-sm text-purple-600">平均膝関節屈曲</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {(results.reduce((sum, r) => sum + r.confidence, 0) / results.length * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-orange-600">平均検出精度</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}