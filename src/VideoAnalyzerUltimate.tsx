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

export function VideoAnalyzerUltimate() {
  const [isReady, setIsReady] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const poseLandmarker = useRef<PoseLandmarker | null>(null)

  // Initialize MediaPipe
  const initializeMediaPipe = async () => {
    try {
      setError(null)
      setStatus('MediaPipe初期化中...')
      
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
        minPoseDetectionConfidence: 0.3,
        minPosePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3
      })

      setStatus('MediaPipe初期化完了')
      setIsReady(true)
    } catch (error) {
      setError(`MediaPipe初期化失敗: ${error}`)
      setStatus('初期化失敗')
    }
  }

  // Handle video upload - NO METADATA DEPENDENCY
  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('video/')) {
      setError('動画ファイルを選択してください')
      return
    }

    setStatus(`動画ファイル選択: ${file.name}`)
    setVideoFile(file)
    setResults([])
    setCurrentFrame(0)
    setError(null)
    
    if (videoRef.current) {
      // Clean up previous URL
      if (videoRef.current.src) {
        URL.revokeObjectURL(videoRef.current.src)
      }
      
      const url = URL.createObjectURL(file)
      videoRef.current.src = url
      
      // Set basic properties - NO METADATA WAITING
      videoRef.current.muted = true
      videoRef.current.playsInline = true
      videoRef.current.controls = false
      videoRef.current.preload = 'auto'
      
      setStatus('動画ファイル準備完了 - メタデータ不要モード')
    }
  }

  // Calculate hip angle
  const calculateHipAngle = (worldLandmarks: any[]): number | null => {
    try {
      if (!worldLandmarks || worldLandmarks.length < 26) return null
      
      const leftHip = worldLandmarks[23]
      const leftKnee = worldLandmarks[25]
      const leftAnkle = worldLandmarks[27]
      
      if (!leftHip || !leftKnee || !leftAnkle) return null

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

    // Draw key landmarks
    const keyPoints = [11, 12, 23, 24, 25, 26, 27, 28]
    keyPoints.forEach(index => {
      const landmark = landmarks[index]
      if (landmark && landmark.visibility > 0.3) {
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
      
      if (startPoint?.visibility > 0.3 && endPoint?.visibility > 0.3) {
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
    if (angles.hip !== null) {
      const text = `膝角度: ${angles.hip}°`
      ctx.strokeText(text, 30, yPos)
      ctx.fillText(text, 30, yPos)
      yPos += 40
    }
    
    const confText = `信頼度: ${(confidence * 100).toFixed(0)}%`
    ctx.strokeText(confText, 30, yPos)
    ctx.fillText(confText, 30, yPos)
    
    const frameText = `${currentFrame + 1}/${results.length}`
    ctx.strokeText(frameText, canvas.width - 150, 50)
    ctx.fillText(frameText, canvas.width - 150, 50)
  }

  const drawCurrentFrame = useCallback(() => {
    if (results.length > 0 && results[currentFrame]) {
      const result = results[currentFrame]
      drawPoseOverlay(result.landmarks, result.angles, result.confidence)
    }
  }, [results, currentFrame])

  // AGGRESSIVE ANALYSIS - NO METADATA DEPENDENCY
  const analyzeVideo = async () => {
    if (!poseLandmarker.current || !videoRef.current || !videoFile) {
      setError('準備が完了していません')
      return
    }

    setIsAnalyzing(true)
    setResults([])
    setError(null)
    setStatus('解析開始 - メタデータ不要モード')
    
    try {
      const video = videoRef.current
      
      // BYPASS METADATA - Use fixed duration assumptions
      const estimatedDuration = 30 // Assume 30 seconds max
      const frameCount = 8 // Very limited frames
      const analysisResults: AnalysisResult[] = []

      for (let i = 0; i < frameCount; i++) {
        // Distribute frames across estimated duration
        const time = (i / (frameCount - 1)) * estimatedDuration
        
        setStatus(`フレーム ${i + 1}/${frameCount} 解析中 (${time.toFixed(1)}s推定)`)
        
        try {
          // Force video to time without waiting for metadata
          video.currentTime = time
          
          // Brief wait - no metadata dependency
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Try analysis regardless of video state
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
          setStatus(`フレーム ${i} エラー: ${error}`)
        }
      }

      setResults(analysisResults)
      setCurrentFrame(0)
      setStatus(`解析完了: ${analysisResults.length}フレーム取得`)
      
      if (analysisResults.length > 0) {
        video.currentTime = 0
        setTimeout(drawCurrentFrame, 300)
      } else {
        setError('姿勢検出できませんでした - 別の動画を試してください')
      }
    } catch (error) {
      setError(`解析失敗: ${error}`)
      setStatus('解析失敗')
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
        <h1 className="text-3xl font-bold mb-2">動画姿勢解析ツール（究極版）</h1>
        <p className="text-gray-600">メタデータ完全バイパス・強制解析モード</p>
      </div>

      {/* Status */}
      {status && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-blue-800">ℹ️ {status}</div>
        </div>
      )}

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
                <div className="text-green-600">✅ メタデータ不要モード - 即座に解析可能</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Analysis */}
      {videoFile && (
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
              {isAnalyzing ? `🔄 解析中... ${analysisProgress.toFixed(0)}%` : '🔍 強制解析開始 (8フレーム・メタデータ不要)'}
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