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

export function VideoAnalyzerWorking() {
  const [isReady, setIsReady] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hiddenVideoRef = useRef<HTMLVideoElement>(null)
  const poseLandmarker = useRef<PoseLandmarker | null>(null)

  const log = (message: string) => {
    const time = new Date().toLocaleTimeString()
    const logMsg = `[${time}] ${message}`
    console.log(logMsg)
    setLogs(prev => [...prev.slice(-25), logMsg])
  }

  // Initialize MediaPipe
  const initializeMediaPipe = async () => {
    try {
      setError(null)
      log('MediaPipe初期化開始')
      
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
        minPoseDetectionConfidence: 0.1,
        minPosePresenceConfidence: 0.1,
        minTrackingConfidence: 0.1,
        outputSegmentationMasks: false
      })

      log('MediaPipe初期化完了 - BlazePose GHUM')
      setIsReady(true)
    } catch (error) {
      log(`MediaPipe初期化失敗: ${error}`)
      setError(`MediaPipe初期化失敗: ${error}`)
    }
  }

  // Handle video upload with immediate processing
  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
    
    // Create blob URL for immediate use
    const blobUrl = URL.createObjectURL(file)
    
    // Set up display video
    if (videoRef.current) {
      videoRef.current.src = blobUrl
      videoRef.current.muted = true
      videoRef.current.playsInline = true
      videoRef.current.controls = true
    }

    // Set up hidden processing video
    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.src = blobUrl
      hiddenVideoRef.current.muted = true
      hiddenVideoRef.current.playsInline = true
      hiddenVideoRef.current.preload = 'auto'
      
      // Force load
      try {
        hiddenVideoRef.current.load()
        log('隠し動画要素準備完了')
      } catch (e) {
        log(`隠し動画要素準備警告: ${e}`)
      }
    }
    
    log('動画ファイル準備完了')
  }

  // Enhanced frame capture with user interaction
  const captureVideoFrame = async (video: HTMLVideoElement, targetTime: number, canvas: HTMLCanvasElement): Promise<boolean> => {
    return new Promise(async (resolve) => {
      let resolved = false

      const processFrame = () => {
        if (resolved) return
        resolved = true

        try {
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(false)
            return
          }

          // Get video dimensions or use defaults
          const width = video.videoWidth || 640
          const height = video.videoHeight || 480
          
          canvas.width = width
          canvas.height = height
          
          // Clear canvas first
          ctx.clearRect(0, 0, width, height)
          
          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, width, height)
          
          // Check if frame has content
          const imageData = ctx.getImageData(0, 0, width, height)
          const pixels = imageData.data
          let hasContent = false
          
          // Sample some pixels to check if frame has content
          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i]
            const g = pixels[i + 1]
            const b = pixels[i + 2]
            if (r > 10 || g > 10 || b > 10) {
              hasContent = true
              break
            }
          }
          
          log(`フレーム取得: ${width}x${height} @ ${targetTime.toFixed(1)}s, コンテンツ=${hasContent ? 'あり' : 'なし'}`)
          resolve(hasContent)
        } catch (e) {
          log(`フレーム取得エラー: ${e}`)
          resolve(false)
        }
      }

      // Try to force video to play first
      try {
        await video.play()
        log('動画再生開始')
        video.pause()
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (playError) {
        log(`動画再生試行: ${playError}`)
      }

      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked)
        setTimeout(processFrame, 200)
      }

      const onTimeUpdate = () => {
        if (Math.abs(video.currentTime - targetTime) < 0.2) {
          video.removeEventListener('timeupdate', onTimeUpdate)
          processFrame()
        }
      }

      // Set up event listeners
      video.addEventListener('seeked', onSeeked, { once: true })
      video.addEventListener('timeupdate', onTimeUpdate)
      
      // Set target time
      video.currentTime = targetTime
      
      // Timeout fallback
      setTimeout(() => {
        if (!resolved) {
          video.removeEventListener('seeked', onSeeked)
          video.removeEventListener('timeupdate', onTimeUpdate)
          log(`フレーム取得タイムアウト @ ${targetTime.toFixed(1)}s`)
          processFrame()
        }
      }, 2000)
    })
  }

  // Calculate anatomical angles
  const calculateLumbarAngles = (worldLandmarks: BlazePoseLandmark[]) => {
    const calculateAngle = (p1: BlazePoseLandmark, p2: BlazePoseLandmark, p3: BlazePoseLandmark): number | null => {
      try {
        // 3D vector calculations for accurate angles
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z }
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z }

        const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z)
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z)

        if (mag1 === 0 || mag2 === 0) return null

        const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)))
        const angle = Math.acos(cosAngle) * (180 / Math.PI)
        return Math.round(angle * 100) / 100
      } catch (error) {
        return null
      }
    }

    if (worldLandmarks.length < 33) {
      return { hipFlexion: null, kneeFlexion: null, ankleFlexion: null, spinalAlignment: null }
    }

    // BlazePose landmark indices
    const leftShoulder = worldLandmarks[11]
    const leftHip = worldLandmarks[23]
    const leftKnee = worldLandmarks[25]
    const leftAnkle = worldLandmarks[27]
    const leftToe = worldLandmarks[31]

    return {
      // Hip flexion: shoulder-hip-knee angle
      hipFlexion: calculateAngle(leftShoulder, leftHip, leftKnee),
      
      // Knee flexion: hip-knee-ankle angle
      kneeFlexion: calculateAngle(leftHip, leftKnee, leftAnkle),
      
      // Ankle flexion: knee-ankle-toe angle
      ankleFlexion: calculateAngle(leftKnee, leftAnkle, leftToe),
      
      // Spinal alignment: deviation from vertical
      spinalAlignment: leftShoulder && leftHip ? 
        Math.abs(Math.atan2(leftShoulder.x - leftHip.x, leftShoulder.y - leftHip.y)) * 180 / Math.PI : null
    }
  }

  // Advanced pose visualization
  const drawAdvancedPose = (landmarks: BlazePoseLandmark[], angles: any, confidence: number) => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Match video dimensions
    canvas.width = videoRef.current.videoWidth || 640
    canvas.height = videoRef.current.videoHeight || 480
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!landmarks || landmarks.length === 0) return

    // Draw all 33 landmarks with enhanced visibility
    landmarks.forEach((landmark, index) => {
      if (landmark.visibility > 0.01) { // Lower threshold for visibility
        const x = landmark.x * canvas.width
        const y = landmark.y * canvas.height
        const size = Math.max(4, landmark.visibility * 12) // Larger landmark points
        
        ctx.beginPath()
        ctx.arc(x, y, size, 0, 2 * Math.PI)
        
        // Enhanced color coding by body region
        if ([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(index)) {
          ctx.fillStyle = '#FF0000' // Head/face - Red
        } else if ([11, 12, 13, 14, 15, 16].includes(index)) {
          ctx.fillStyle = '#00FF00' // Upper body - Green  
        } else if ([17, 18, 19, 20, 21, 22].includes(index)) {
          ctx.fillStyle = '#0000FF' // Hands - Blue
        } else if ([23, 24].includes(index)) {
          ctx.fillStyle = '#FFD700' // Hips - Gold
        } else if ([25, 26, 27, 28].includes(index)) {
          ctx.fillStyle = '#FF00FF' // Legs - Magenta
        } else {
          ctx.fillStyle = '#00FFFF' // Feet - Cyan
        }
        
        // Fill landmark with partial transparency based on visibility
        ctx.globalAlpha = Math.max(0.6, landmark.visibility)
        ctx.fill()
        ctx.globalAlpha = 1
        
        // Strong white outline for visibility
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2
        ctx.stroke()
        
        // Add landmark index for debugging
        if (showAdvanced) {
          ctx.fillStyle = '#FFFFFF'
          ctx.font = '10px Arial'
          ctx.fillText(index.toString(), x + size + 2, y - size)
        }
      }
    })

    // Draw pose connections
    const connections = [
      // Face outline
      [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
      // Upper body
      [9, 10], [11, 12], [11, 13], [12, 14], [13, 15], [14, 16],
      // Hands  
      [15, 17], [15, 19], [15, 21], [16, 18], [16, 20], [16, 22],
      [17, 19], [19, 21], [18, 20], [20, 22],
      // Body
      [11, 23], [12, 24], [23, 24],
      // Legs
      [23, 25], [24, 26], [25, 27], [26, 28],
      // Feet
      [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32]
    ]

    ctx.lineWidth = 3
    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start]
      const endPoint = landmarks[end]
      
      if (startPoint?.visibility > 0.1 && endPoint?.visibility > 0.1) { // Lower threshold
        ctx.beginPath()
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height)
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height)
        
        // Enhanced color connections by body region
        if ([11, 12, 23, 24].some(i => [start, end].includes(i))) {
          ctx.strokeStyle = '#00FF00' // Core - Green
        } else if ([25, 26, 27, 28].some(i => [start, end].includes(i))) {
          ctx.strokeStyle = '#FF00FF' // Legs - Magenta
        } else if ([13, 14, 15, 16, 17, 18, 19, 20, 21, 22].some(i => [start, end].includes(i))) {
          ctx.strokeStyle = '#00FFFF' // Arms/Hands - Cyan
        } else {
          ctx.strokeStyle = '#FFFF00' // Face/Other - Yellow
        }
        
        // Semi-transparent lines based on landmark visibility
        ctx.globalAlpha = Math.min(startPoint.visibility, endPoint.visibility) * 0.8 + 0.2
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    })

    // Draw analysis information
    ctx.font = 'bold 16px Arial'
    ctx.fillStyle = '#FFFFFF'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3
    
    let yOffset = 25
    const infoItems = [
      `検出ポイント: ${landmarks.filter(l => l.visibility > 0.1).length}/33`,
      `検出精度: ${(confidence * 100).toFixed(1)}%`,
      angles.hipFlexion !== null ? `股関節屈曲: ${angles.hipFlexion}°` : null,
      angles.kneeFlexion !== null ? `膝関節屈曲: ${angles.kneeFlexion}°` : null,
      angles.ankleFlexion !== null ? `足関節背屈: ${angles.ankleFlexion}°` : null,
      angles.spinalAlignment !== null ? `脊椎アライメント: ${angles.spinalAlignment.toFixed(1)}°` : null
    ].filter(Boolean)

    infoItems.forEach(text => {
      if (text) {
        ctx.strokeText(text, 15, yOffset)
        ctx.fillText(text, 15, yOffset)
        yOffset += 22
      }
    })
  }

  const drawCurrentFrame = useCallback(() => {
    if (results.length > 0 && results[currentFrame]) {
      const result = results[currentFrame]
      drawAdvancedPose(result.landmarks, result.angles, result.confidence)
    }
  }, [results, currentFrame])

  // WORKING VIDEO ANALYSIS
  const analyzeVideo = async () => {
    if (!poseLandmarker.current || !videoFile || !hiddenVideoRef.current) {
      setError('準備が完了していません')
      return
    }

    setIsAnalyzing(true)
    setResults([])
    setError(null)
    log('動作ポーズ解析開始')
    
    try {
      const video = hiddenVideoRef.current
      
      // Wait for video to be ready
      log('動画準備確認中...')
      let readyAttempts = 0
      while (readyAttempts < 10 && (video.readyState < 2 || video.videoWidth === 0)) {
        log(`準備状態: readyState=${video.readyState}, 次元=${video.videoWidth}x${video.videoHeight}`)
        await new Promise(resolve => setTimeout(resolve, 500))
        readyAttempts++
        
        if (readyAttempts % 3 === 0) {
          try {
            video.load()
            // Try to force metadata loading
            video.currentTime = 0.1
            await new Promise(resolve => setTimeout(resolve, 100))
            video.currentTime = 0
          } catch (e) {
            log(`強制読み込み試行: ${e}`)
          }
        }
      }

      // Check final state
      log(`最終動画状態: readyState=${video.readyState}, 次元=${video.videoWidth}x${video.videoHeight}`)
      
      if (video.videoWidth === 0) {
        log('動画次元が0 - 推定値で続行')
      }

      // Get duration (with fallback)
      const duration = video.duration && !isNaN(video.duration) ? video.duration : 8
      log(`解析対象: ${duration.toFixed(1)}秒`)
      
      // Create processing canvas
      const processingCanvas = document.createElement('canvas')
      processingCanvas.width = Math.max(video.videoWidth, 640)
      processingCanvas.height = Math.max(video.videoHeight, 480)
      
      const frameCount = 3 // Start with fewer frames for reliability
      const analysisResults: AnalysisResult[] = []

      for (let i = 0; i < frameCount; i++) {
        const time = (i / Math.max(frameCount - 1, 1)) * Math.min(duration, 10)
        
        log(`フレーム ${i + 1}/${frameCount}: ${time.toFixed(1)}s`)
        
        try {
          // Capture frame with content verification
          const frameSuccess = await captureVideoFrame(video, time, processingCanvas)
          
          if (!frameSuccess) {
            log(`フレーム ${i + 1}: フレーム内容なし - スキップ`)
            continue
          }

          // Analyze with MediaPipe
          log(`フレーム ${i + 1}: MediaPipe解析実行`)
          const result = poseLandmarker.current.detect(processingCanvas)
          
          const landmarks: BlazePoseLandmark[] = result.landmarks[0] || []
          const worldLandmarks: BlazePoseLandmark[] = result.worldLandmarks[0] || []
          
          log(`フレーム ${i + 1}: ランドマーク検出数=${landmarks.length}`)
          
          if (landmarks.length > 0) {
            const visibleLandmarks = landmarks.filter(lm => lm.visibility > 0.01)
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

            log(`フレーム ${i + 1}: 成功 - ${visibleLandmarks.length}/${landmarks.length}点可視, 信頼度${(confidence*100).toFixed(1)}%`)
          } else {
            log(`フレーム ${i + 1}: ポーズ検出なし - MediaPipeが人物を認識できませんでした`)
            
            // For debugging - add a dummy result to show canvas was processed
            if (showAdvanced) {
              analysisResults.push({
                frame: i,
                timestamp: time,
                landmarks: [],
                worldLandmarks: [],
                angles: { hipFlexion: null, kneeFlexion: null, ankleFlexion: null, spinalAlignment: null },
                confidence: 0
              })
              log(`フレーム ${i + 1}: デバッグ用空結果を追加`)
            }
          }

          setAnalysisProgress((i + 1) / frameCount * 100)
          
          // Small delay between frames
          await new Promise(resolve => setTimeout(resolve, 200))
          
        } catch (error) {
          log(`フレーム ${i + 1} エラー: ${error}`)
        }
      }

      setResults(analysisResults)
      setCurrentFrame(0)
      log(`動作ポーズ解析完了: ${analysisResults.length}フレーム`)
      
      if (analysisResults.length > 0) {
        // Move display video to first result
        if (videoRef.current) {
          videoRef.current.currentTime = analysisResults[0].timestamp
        }
        setTimeout(drawCurrentFrame, 300)
        log('ポーズ描写開始')
      } else {
        setError('動作ポーズが検出できませんでした。別の動画で試してください。')
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
        <h1 className="text-3xl font-bold mb-2">動作ポーズ検出・描写システム</h1>
        <p className="text-gray-600">確実な動画解析・33点ランドマーク可視化</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-medium">⚠️ {error}</div>
        </div>
      )}

      {/* Advanced logs toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="showAdvanced"
          checked={showAdvanced}
          onChange={(e) => setShowAdvanced(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="showAdvanced" className="text-sm font-medium">詳細ログ表示</label>
      </div>

      {/* Logs */}
      {showAdvanced && logs.length > 0 && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <h3 className="font-medium mb-2">🔍 動作解析ログ</h3>
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
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm">
                <div className="font-medium">📁 {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)</div>
                <div className="text-green-600 mt-1">✅ 動作ポーズ解析準備完了</div>
                <div className="text-blue-600 mt-2 text-xs">
                  💡 解析前に動画を一度手動で再生すると検出精度が向上します
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Analysis */}
      {videoFile && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">🎥 動作ポーズ検出・描写</h2>
          
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

          {/* Hidden video for processing */}
          <video
            ref={hiddenVideoRef}
            style={{ display: 'none' }}
            playsInline
            muted
          />

          <div className="space-y-4">
            <button
              onClick={analyzeVideo}
              disabled={isAnalyzing}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-lg"
            >
              {isAnalyzing ? `🔄 動作解析中... ${analysisProgress.toFixed(0)}%` : 
               '🔍 動作ポーズ検出・描写開始'}
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
                      <div className="grid grid-cols-2 gap-2">
                        <div>検出ポイント: {results[currentFrame].landmarks.filter(l => l.visibility > 0.1).length}/33</div>
                        <div>検出精度: {(results[currentFrame].confidence * 100).toFixed(1)}%</div>
                        <div>股関節: {results[currentFrame].angles.hipFlexion?.toFixed(1) || 'N/A'}°</div>
                        <div>膝関節: {results[currentFrame].angles.kneeFlexion?.toFixed(1) || 'N/A'}°</div>
                      </div>
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
          <h2 className="text-lg font-semibold mb-4">📊 動作ポーズ解析結果</h2>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{results.length}</div>
              <div className="text-sm text-blue-600">解析フレーム数</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {Math.round(results.reduce((sum, r) => sum + r.landmarks.filter(l => l.visibility > 0.1).length, 0) / results.length)}
              </div>
              <div className="text-sm text-green-600">平均検出ポイント数</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {(results.reduce((sum, r) => sum + (r.angles.hipFlexion || 0), 0) / results.length).toFixed(1)}°
              </div>
              <div className="text-sm text-purple-600">平均股関節角度</div>
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