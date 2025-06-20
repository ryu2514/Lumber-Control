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

export function VideoAnalyzerSimplest() {
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
  const poseLandmarker = useRef<PoseLandmarker | null>(null)

  const log = (message: string) => {
    const time = new Date().toLocaleTimeString()
    const logMsg = `[${time}] ${message}`
    console.log(logMsg)
    setLogs(prev => [...prev.slice(-10), logMsg])
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
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.3,
        minPosePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3
      })

      log('MediaPipe初期化完了')
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
      log('動画ファイル準備完了')
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

  // Draw pose
  const drawPose = (landmarks: any[], angles: { hip: number | null }, confidence: number) => {
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
      if (landmark && landmark.visibility > 0.3) {
        const x = landmark.x * canvas.width
        const y = landmark.y * canvas.height
        
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, 2 * Math.PI)
        ctx.fillStyle = '#FF0000'
        ctx.fill()
      }
    })

    // Draw text
    ctx.font = 'bold 20px Arial'
    ctx.fillStyle = '#FFFF00'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3
    
    if (angles.hip !== null) {
      const text = `角度: ${angles.hip}°`
      ctx.strokeText(text, 20, 40)
      ctx.fillText(text, 20, 40)
    }
    
    const confText = `信頼度: ${(confidence * 100).toFixed(0)}%`
    ctx.strokeText(confText, 20, 70)
    ctx.fillText(confText, 20, 70)
  }

  const drawCurrentFrame = useCallback(() => {
    if (results.length > 0 && results[currentFrame]) {
      const result = results[currentFrame]
      drawPose(result.landmarks, result.angles, result.confidence)
    }
  }, [results, currentFrame])

  // SUPER SIMPLE ANALYSIS - NO PLAY/PAUSE
  const analyzeVideo = async () => {
    if (!poseLandmarker.current || !videoRef.current || !videoFile) {
      setError('準備が完了していません')
      return
    }

    setIsAnalyzing(true)
    setResults([])
    setError(null)
    log('解析開始')
    
    try {
      const video = videoRef.current
      
      // Wait a bit and check video state
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      log(`動画状態: ${video.videoWidth}x${video.videoHeight}, readyState=${video.readyState}`)
      
      // If no dimensions yet, wait more
      if (video.videoWidth === 0) {
        log('動画次元待機中...')
        let attempts = 0
        while (video.videoWidth === 0 && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 500))
          attempts++
          log(`待機中 ${attempts}/20: ${video.videoWidth}x${video.videoHeight}`)
        }
      }
      
      if (video.videoWidth === 0) {
        setError('動画の読み込みに失敗しました')
        log('動画次元取得失敗')
        return
      }
      
      log(`動画準備完了: ${video.videoWidth}x${video.videoHeight}`)
      
      // Simple fixed duration
      const duration = video.duration || 10
      log(`動画長さ: ${duration.toFixed(1)}秒`)
      
      const frameCount = 3 // Very simple
      const analysisResults: AnalysisResult[] = []

      for (let i = 0; i < frameCount; i++) {
        const time = (i / (frameCount - 1)) * Math.min(duration, 10)
        
        log(`フレーム ${i + 1}: ${time.toFixed(1)}秒`)
        
        try {
          // Simple time set
          video.currentTime = time
          
          // Wait for frame
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          log(`フレーム ${i + 1}: MediaPipe実行 (${video.currentTime.toFixed(2)}s)`)
          
          // Analyze
          const result = poseLandmarker.current.detectForVideo(video, time * 1000)
          
          const landmarks = result.landmarks[0] || []
          const worldLandmarks = result.worldLandmarks[0] || []
          
          const confidence = landmarks.length > 0 
            ? landmarks.reduce((sum: number, lm: any) => sum + (lm.visibility || 0), 0) / landmarks.length
            : 0
            
          const hipAngle = calculateHipAngle(worldLandmarks)
          
          log(`フレーム ${i + 1}: ランドマーク=${landmarks.length}, 角度=${hipAngle || 'N/A'}`)

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
          log(`フレーム ${i + 1} エラー: ${error}`)
        }
      }

      setResults(analysisResults)
      setCurrentFrame(0)
      log(`解析完了: ${analysisResults.length}フレーム`)
      
      if (analysisResults.length > 0) {
        setTimeout(drawCurrentFrame, 500)
      } else {
        setError('姿勢検出できませんでした')
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
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">動画姿勢解析ツール（超簡単版）</h1>
        <p className="text-gray-600">最小限の処理で動画解析テスト</p>
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
              <div className="text-sm">
                📁 {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)
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
              {isAnalyzing ? `🔄 解析中... ${analysisProgress.toFixed(0)}%` : '🔍 解析開始 (3フレーム)'}
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
                        <span>角度: {results[currentFrame].angles.hip}° | </span>
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
                {results.length > 0 ? (results.reduce((sum, r) => sum + (r.angles.hip || 0), 0) / results.length).toFixed(1) : 0}°
              </div>
              <div className="text-sm text-green-600">平均角度</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {results.length > 0 ? Math.round(results.filter(r => r.landmarks.length > 0).length / results.length * 100) : 0}%
              </div>
              <div className="text-sm text-purple-600">姿勢検出率</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}