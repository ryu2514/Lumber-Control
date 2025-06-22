import { useState, useRef, useCallback } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

interface AnalysisResult {
  frame: number
  timestamp: number
  landmarks: any[]
  confidence: number
  angles: {
    hipFlexion: number | null
    kneeFlexion: number | null
  }
}

export function VideoAnalyzerCanvas() {
  const [isReady, setIsReady] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null)
  const poseLandmarker = useRef<PoseLandmarker | null>(null)

  const log = (message: string) => {
    const time = new Date().toLocaleTimeString()
    const logMsg = `[${time}] ${message}`
    console.log(logMsg)
    setLogs(prev => [...prev.slice(-20), logMsg])
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
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'IMAGE',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      })

      log('MediaPipe初期化完了 (IMAGE mode)')
      setIsReady(true)
    } catch (error) {
      log(`MediaPipe初期化失敗: ${error}`)
      setError(`MediaPipe初期化失敗: ${error}`)
    }
  }

  // Handle video upload
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
    
    if (videoRef.current) {
      if (videoRef.current.src) {
        URL.revokeObjectURL(videoRef.current.src)
      }
      
      const url = URL.createObjectURL(file)
      videoRef.current.src = url
      videoRef.current.muted = true
      videoRef.current.playsInline = true
      videoRef.current.controls = true
      videoRef.current.preload = 'metadata'
      
      log('動画ファイル準備完了')
    }
  }

  // Canvas-based frame extraction
  const extractFrameToCanvas = (video: HTMLVideoElement, targetTime: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const canvas = hiddenCanvasRef.current
      if (!canvas) {
        resolve(false)
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(false)
        return
      }

      let resolved = false

      const onSeeked = () => {
        if (resolved) return
        resolved = true
        video.removeEventListener('seeked', onSeeked)
        
        try {
          // Force canvas dimensions based on video natural size or default
          const width = video.videoWidth || 640
          const height = video.videoHeight || 480
          
          canvas.width = width
          canvas.height = height
          
          // Draw current video frame to canvas
          ctx.drawImage(video, 0, 0, width, height)
          
          log(`フレーム抽出成功: ${width}x${height}`)
          resolve(true)
        } catch (e) {
          log(`フレーム抽出失敗: ${e}`)
          resolve(false)
        }
      }

      const onError = () => {
        if (resolved) return
        resolved = true
        video.removeEventListener('seeked', onSeeked)
        video.removeEventListener('error', onError)
        log('動画シークエラー')
        resolve(false)
      }

      video.addEventListener('seeked', onSeeked, { once: true })
      video.addEventListener('error', onError, { once: true })
      
      // Set time and trigger seek
      video.currentTime = targetTime
      
      // Timeout fallback
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          video.removeEventListener('seeked', onSeeked)
          video.removeEventListener('error', onError)
          log('シークタイムアウト - 現在フレームを使用')
          
          try {
            const width = video.videoWidth || 640
            const height = video.videoHeight || 480
            canvas.width = width
            canvas.height = height
            ctx.drawImage(video, 0, 0, width, height)
            resolve(true)
          } catch (e) {
            resolve(false)
          }
        }
      }, 2000)
    })
  }

  // Calculate angles
  const calculateAngles = (landmarks: any[]) => {
    const calculateAngle = (p1: any, p2: any, p3: any): number | null => {
      try {
        if (!p1 || !p2 || !p3) return null
        
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y }
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y }

        const dot = v1.x * v2.x + v1.y * v2.y
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)

        if (mag1 === 0 || mag2 === 0) return null

        const cosAngle = dot / (mag1 * mag2)
        const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI)
        return Math.round(angle * 10) / 10
      } catch (error) {
        return null
      }
    }

    if (landmarks.length < 29) return { hipFlexion: null, kneeFlexion: null }

    return {
      hipFlexion: calculateAngle(landmarks[11], landmarks[23], landmarks[25]),
      kneeFlexion: calculateAngle(landmarks[23], landmarks[25], landmarks[27])
    }
  }

  // Draw pose
  const drawPose = (landmarks: any[], angles: any, confidence: number) => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = videoRef.current.videoWidth || 640
    canvas.height = videoRef.current.videoHeight || 480
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!landmarks || landmarks.length === 0) return

    // Draw key points
    const keyPoints = [11, 12, 23, 24, 25, 26, 27, 28]
    keyPoints.forEach(index => {
      const landmark = landmarks[index]
      if (landmark && landmark.visibility > 0.5) {
        const x = landmark.x * canvas.width
        const y = landmark.y * canvas.height
        
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, 2 * Math.PI)
        ctx.fillStyle = '#FF0000'
        ctx.fill()
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 3
        ctx.stroke()
      }
    })

    // Draw connections
    const connections = [[11,12], [11,23], [12,24], [23,24], [23,25], [24,26], [25,27], [26,28]]
    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start]
      const endPoint = landmarks[end]
      
      if (startPoint?.visibility > 0.5 && endPoint?.visibility > 0.5) {
        ctx.beginPath()
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height)
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height)
        ctx.strokeStyle = '#00FF00'
        ctx.lineWidth = 4
        ctx.stroke()
      }
    })

    // Draw info
    ctx.font = 'bold 24px Arial'
    ctx.fillStyle = '#FFFF00'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 4
    
    let yPos = 50
    if (angles.hipFlexion !== null) {
      const text = `股関節: ${angles.hipFlexion}°`
      ctx.strokeText(text, 30, yPos)
      ctx.fillText(text, 30, yPos)
      yPos += 40
    }
    if (angles.kneeFlexion !== null) {
      const text = `膝関節: ${angles.kneeFlexion}°`
      ctx.strokeText(text, 30, yPos)
      ctx.fillText(text, 30, yPos)
      yPos += 40
    }
    
    const confText = `信頼度: ${(confidence * 100).toFixed(0)}%`
    ctx.strokeText(confText, 30, yPos)
    ctx.fillText(confText, 30, yPos)
  }

  const drawCurrentFrame = useCallback(() => {
    if (results.length > 0 && results[currentFrame]) {
      const result = results[currentFrame]
      drawPose(result.landmarks, result.angles, result.confidence)
    }
  }, [results, currentFrame])

  // CANVAS-BASED ANALYSIS
  const analyzeVideo = async () => {
    if (!poseLandmarker.current || !videoRef.current || !videoFile) {
      setError('準備が完了していません')
      return
    }

    setIsAnalyzing(true)
    setResults([])
    setError(null)
    log('Canvas経由解析開始')
    
    try {
      const video = videoRef.current
      
      // Force video to load by user interaction requirement
      log('動画手動再生確認')
      try {
        await video.play()
        log('動画再生成功')
        video.pause()
        video.currentTime = 0
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (playError) {
        log(`再生失敗: ${playError} - Canvas経由で続行`)
      }

      // Get basic video info
      let duration = video.duration || 10
      let width = video.videoWidth || 640
      let height = video.videoHeight || 480
      
      log(`動画情報: ${width}x${height}, ${duration.toFixed(1)}s`)

      // Setup hidden canvas
      if (hiddenCanvasRef.current) {
        hiddenCanvasRef.current.width = width
        hiddenCanvasRef.current.height = height
      }
      
      const frameCount = 3
      const analysisResults: AnalysisResult[] = []

      for (let i = 0; i < frameCount; i++) {
        const time = (i / (frameCount - 1)) * Math.min(duration, 10)
        
        log(`フレーム ${i + 1}/${frameCount}: ${time.toFixed(1)}s`)
        
        try {
          // Extract frame to canvas
          const extracted = await extractFrameToCanvas(video, time)
          
          if (!extracted || !hiddenCanvasRef.current) {
            log(`フレーム ${i + 1}: 抽出失敗`)
            continue
          }

          // Analyze canvas directly
          log(`フレーム ${i + 1}: Canvas解析実行`)
          const result = poseLandmarker.current.detect(hiddenCanvasRef.current)
          
          const landmarks = result.landmarks[0] || []
          
          if (landmarks.length > 0) {
            const confidence = landmarks.reduce((sum: number, lm: any) => sum + (lm.visibility || 0), 0) / landmarks.length
            const angles = calculateAngles(landmarks)

            analysisResults.push({
              frame: i,
              timestamp: time,
              landmarks,
              angles,
              confidence
            })

            log(`フレーム ${i + 1}: 成功, 股関節=${angles.hipFlexion}°, 膝=${angles.kneeFlexion}°`)
          } else {
            log(`フレーム ${i + 1}: ランドマーク検出なし`)
          }

          setAnalysisProgress((i + 1) / frameCount * 100)
          
        } catch (error) {
          log(`フレーム ${i + 1} エラー: ${error}`)
        }
      }

      setResults(analysisResults)
      setCurrentFrame(0)
      log(`Canvas解析完了: ${analysisResults.length}フレーム`)
      
      if (analysisResults.length > 0) {
        video.currentTime = 0
        setTimeout(drawCurrentFrame, 500)
      } else {
        setError('Canvas経由でも姿勢検出できませんでした')
      }
    } catch (error) {
      log(`Canvas解析失敗: ${error}`)
      setError(`Canvas解析失敗: ${error}`)
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
        <h1 className="text-3xl font-bold mb-2">Canvas動画姿勢解析</h1>
        <p className="text-gray-600">メタデータ不要・Canvas直接処理モード</p>
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
          <h3 className="font-medium mb-2">🔍 実行ログ</h3>
          <div className="bg-black text-green-400 p-3 rounded text-sm font-mono max-h-32 overflow-y-auto">
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
            🚀 MediaPipe初期化 (Canvas mode)
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
              <div className="text-sm">
                📁 {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)
              </div>
              <div className="text-green-600 text-sm mt-2">
                ✅ Canvas処理準備完了 - メタデータ問題を回避
              </div>
              <div className="text-blue-600 text-xs mt-1">
                💡 Canvas経由でフレーム抽出し、IMAGE modeで解析します
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Analysis */}
      {videoFile && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">🎥 Canvas動画解析</h2>
          
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

          {/* Hidden canvas for frame extraction */}
          <canvas
            ref={hiddenCanvasRef}
            style={{ display: 'none' }}
          />

          <div className="space-y-4">
            <button
              onClick={analyzeVideo}
              disabled={isAnalyzing}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-lg"
            >
              {isAnalyzing ? `🔄 Canvas解析中... ${analysisProgress.toFixed(0)}%` : 
               '🔍 Canvas解析開始 (3フレーム・メタデータ回避)'}
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
                    <div className="text-sm text-gray-600 mt-1 space-x-4">
                      {results[currentFrame].angles.hipFlexion && (
                        <span>股関節: {results[currentFrame].angles.hipFlexion}°</span>
                      )}
                      {results[currentFrame].angles.kneeFlexion && (
                        <span>膝関節: {results[currentFrame].angles.kneeFlexion}°</span>
                      )}
                      <span>信頼度: {(results[currentFrame].confidence * 100).toFixed(0)}%</span>
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
          <h2 className="text-lg font-semibold mb-4">📊 Canvas解析結果</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{results.length}</div>
              <div className="text-sm text-blue-600">解析フレーム数</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {results.length > 0 ? (results.reduce((sum, r) => sum + (r.angles.hipFlexion || 0), 0) / results.length).toFixed(1) : 0}°
              </div>
              <div className="text-sm text-green-600">平均股関節角度</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {results.length > 0 ? (results.reduce((sum, r) => sum + r.confidence, 0) / results.length * 100).toFixed(1) : 0}%
              </div>
              <div className="text-sm text-purple-600">平均信頼度</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}