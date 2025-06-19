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

export function VideoAnalyzerDebug() {
  const [isReady, setIsReady] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [currentAnalyzingFrame, setCurrentAnalyzingFrame] = useState(0)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [debugLogs, setDebugLogs] = useState<string[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const poseLandmarker = useRef<PoseLandmarker | null>(null)

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `[${timestamp}] ${message}`
    console.log(logMessage)
    setDebugLogs(prev => [...prev.slice(-20), logMessage]) // Keep last 20 logs
  }

  // Initialize MediaPipe
  const initializeMediaPipe = async () => {
    try {
      setError(null)
      addDebugLog('MediaPipe初期化開始...')
      
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
        minPoseDetectionConfidence: 0.3, // Lower threshold for better detection
        minPosePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3
      })

      addDebugLog('MediaPipe初期化完了')
      setIsReady(true)
    } catch (error) {
      const errorMsg = `MediaPipe初期化エラー: ${error}`
      addDebugLog(errorMsg)
      setError(errorMsg)
    }
  }

  // Handle video upload
  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('video/')) {
      setError('動画ファイルを選択してください')
      return
    }

    addDebugLog(`動画ファイル選択: ${file.name} (${file.type}, ${(file.size/1024/1024).toFixed(1)}MB)`)
    setVideoFile(file)
    setResults([])
    setCurrentFrame(0)
    setError(null)
    setVideoLoaded(false)
    setVideoDuration(0)
    setDebugLogs([])
    
    if (videoRef.current) {
      if (videoRef.current.src) {
        URL.revokeObjectURL(videoRef.current.src)
      }
      
      const url = URL.createObjectURL(file)
      videoRef.current.src = url
      
      videoRef.current.onloadedmetadata = () => {
        const video = videoRef.current!
        const duration = video.duration
        
        addDebugLog(`動画メタデータ読み込み: duration=${duration}s, size=${video.videoWidth}x${video.videoHeight}`)
        
        if (duration && !isNaN(duration) && duration > 0) {
          setVideoDuration(duration)
          setVideoLoaded(true)
          addDebugLog('動画読み込み完了 ✅')
        } else {
          const errorMsg = '動画の長さを取得できません'
          addDebugLog(errorMsg)
          setError(errorMsg)
        }
      }
      
      videoRef.current.onerror = (e) => {
        const errorMsg = `動画読み込みエラー: ${e}`
        addDebugLog(errorMsg)
        setError(errorMsg)
      }
      
      videoRef.current.load()
    }
  }

  // Calculate angle with validation
  const calculateHipAngle = (worldLandmarks: any[]): number | null => {
    try {
      if (!worldLandmarks || worldLandmarks.length < 26) return null
      
      const leftShoulder = worldLandmarks[11]
      const leftHip = worldLandmarks[23]
      const leftKnee = worldLandmarks[25]
      
      if (!leftShoulder || !leftHip || !leftKnee) return null
      if (!leftShoulder.x || !leftHip.x || !leftKnee.x) return null

      const hipKneeVector = {
        x: leftKnee.x - leftHip.x,
        y: leftKnee.y - leftHip.y,
        z: leftKnee.z - leftHip.z
      }
      
      const shoulderHipVector = {
        x: leftHip.x - leftShoulder.x,
        y: leftHip.y - leftShoulder.y,
        z: leftHip.z - leftShoulder.z
      }
      
      const dot = hipKneeVector.x * shoulderHipVector.x + 
                  hipKneeVector.y * shoulderHipVector.y + 
                  hipKneeVector.z * shoulderHipVector.z
      
      const mag1 = Math.sqrt(hipKneeVector.x**2 + hipKneeVector.y**2 + hipKneeVector.z**2)
      const mag2 = Math.sqrt(shoulderHipVector.x**2 + shoulderHipVector.y**2 + shoulderHipVector.z**2)
      
      if (mag1 === 0 || mag2 === 0) return null
      
      const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI)
      return Math.round(angle * 10) / 10
    } catch (error) {
      addDebugLog(`角度計算エラー: ${error}`)
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

    // Draw landmarks
    landmarks.forEach((landmark, index) => {
      if (landmark.visibility > 0.3) {
        const x = landmark.x * canvas.width
        const y = landmark.y * canvas.height
        
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, 2 * Math.PI)
        
        const isKeyJoint = [11,12,23,24,25,26,27,28].includes(index)
        const isCore = [11,12,23,24].includes(index)
        
        if (isCore) {
          ctx.fillStyle = '#FF0000'
        } else if (isKeyJoint) {
          ctx.fillStyle = '#FFA500'
        } else {
          ctx.fillStyle = '#00FF00'
        }
        
        ctx.fill()
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    })

    // Draw connections
    const connections = [
      [11,12], [11,23], [12,24], [23,24],
      [23,25], [24,26], [25,27], [26,28]
    ]
    
    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start]
      const endPoint = landmarks[end]
      
      if (startPoint?.visibility > 0.3 && endPoint?.visibility > 0.3) {
        ctx.beginPath()
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height)
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height)
        ctx.strokeStyle = '#00FF00'
        ctx.lineWidth = 3
        ctx.stroke()
      }
    })

    // Draw info overlay
    ctx.font = 'bold 16px Arial'
    ctx.fillStyle = '#FFFF00'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    
    let yPos = 30
    if (angles.hip !== null) {
      const text = `Hip: ${angles.hip}°`
      ctx.strokeText(text, 10, yPos)
      ctx.fillText(text, 10, yPos)
      yPos += 25
    }
    
    const confText = `Confidence: ${(confidence * 100).toFixed(1)}%`
    ctx.strokeText(confText, 10, yPos)
    ctx.fillText(confText, 10, yPos)
    
    const frameText = `Frame: ${currentFrame + 1}`
    ctx.strokeText(frameText, canvas.width - 120, 30)
    ctx.fillText(frameText, canvas.width - 120, 30)
  }

  const drawCurrentFrame = useCallback(() => {
    if (results.length > 0 && results[currentFrame]) {
      const result = results[currentFrame]
      drawPoseOverlay(result.landmarks, result.angles, result.confidence)
    } else {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }, [results, currentFrame])

  // Analyze video with detailed logging
  const analyzeVideo = async () => {
    if (!poseLandmarker.current) {
      setError('MediaPipeが初期化されていません')
      return
    }
    
    if (!videoRef.current || !videoLoaded || videoDuration <= 0) {
      setError('動画が準備できていません')
      return
    }

    setIsAnalyzing(true)
    setResults([])
    setError(null)
    setCurrentAnalyzingFrame(0)
    
    try {
      const video = videoRef.current
      const fps = 2 // Very slow for debugging
      const frameInterval = 1 / fps
      const totalFrames = Math.min(Math.floor(videoDuration * fps), 20) // Limit to 20 frames for debugging
      
      addDebugLog(`解析開始: ${totalFrames}フレーム (${fps}fps, 最大${videoDuration.toFixed(1)}s)`)

      const analysisResults: AnalysisResult[] = []

      for (let frame = 0; frame < totalFrames; frame++) {
        const time = frame * frameInterval
        setCurrentAnalyzingFrame(frame + 1)
        
        addDebugLog(`フレーム ${frame + 1}/${totalFrames} (時間: ${time.toFixed(2)}s)`)
        
        try {
          // Set video time
          video.currentTime = time
          addDebugLog(`  - 動画時間設定: ${time.toFixed(2)}s`)
          
          // Wait for seek
          await new Promise<void>((resolve) => {
            let resolved = false
            const timeout = setTimeout(() => {
              if (!resolved) {
                addDebugLog(`  - シークタイムアウト (2秒)`)
                resolved = true
                resolve()
              }
            }, 2000)
            
            const onSeeked = () => {
              if (!resolved) {
                clearTimeout(timeout)
                video.removeEventListener('seeked', onSeeked)
                addDebugLog(`  - シーク完了: ${video.currentTime.toFixed(2)}s`)
                resolved = true
                resolve()
              }
            }
            
            video.addEventListener('seeked', onSeeked, { once: true })
            
            // Check if already at correct time
            if (Math.abs(video.currentTime - time) < 0.1) {
              if (!resolved) {
                clearTimeout(timeout)
                addDebugLog(`  - 既に正しい時間位置`)
                resolved = true
                resolve()
              }
            }
          })

          // Wait a bit for video to settle
          await new Promise(resolve => setTimeout(resolve, 100))

          // Analyze pose
          addDebugLog(`  - MediaPipe姿勢解析実行`)
          const result = poseLandmarker.current.detectForVideo(video, time * 1000)
          
          const landmarks = result.landmarks[0] || []
          const worldLandmarks = result.worldLandmarks[0] || []
          
          addDebugLog(`  - 検出結果: landmarks=${landmarks.length}, worldLandmarks=${worldLandmarks.length}`)
          
          // Calculate confidence (average visibility)
          const confidence = landmarks.length > 0 
            ? landmarks.reduce((sum: number, lm: any) => sum + (lm.visibility || 0), 0) / landmarks.length
            : 0
            
          const hipAngle = calculateHipAngle(worldLandmarks)
          
          addDebugLog(`  - 信頼度: ${(confidence * 100).toFixed(1)}%, 股関節角度: ${hipAngle || 'N/A'}°`)

          const analysisResult: AnalysisResult = {
            frame,
            timestamp: time,
            landmarks,
            worldLandmarks,
            angles: { hip: hipAngle },
            confidence
          }
          
          analysisResults.push(analysisResult)
          setResults([...analysisResults]) // Update results incrementally

          setAnalysisProgress((frame + 1) / totalFrames * 100)
          
        } catch (error) {
          addDebugLog(`  - フレーム解析エラー: ${error}`)
        }
      }

      addDebugLog(`解析完了: ${analysisResults.length}フレーム処理`)
      setCurrentFrame(0)
      
      if (analysisResults.length > 0) {
        video.currentTime = 0
        setTimeout(drawCurrentFrame, 100)
      } else {
        setError('姿勢を検出できませんでした')
      }
    } catch (error) {
      const errorMsg = `動画解析エラー: ${error}`
      addDebugLog(errorMsg)
      setError(errorMsg)
    } finally {
      setIsAnalyzing(false)
      setCurrentAnalyzingFrame(0)
    }
  }

  // Navigate frames
  const goToFrame = (frameIndex: number) => {
    if (!videoRef.current || !results.length) return
    
    const clampedFrame = Math.max(0, Math.min(frameIndex, results.length - 1))
    setCurrentFrame(clampedFrame)
    
    const timestamp = results[clampedFrame].timestamp
    videoRef.current.currentTime = timestamp
    
    setTimeout(drawCurrentFrame, 50)
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">動画姿勢解析ツール（デバッグ版）</h1>
        <p className="text-gray-600">詳細ログ・段階的解析・エラー診断</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-medium">⚠️ エラー</div>
          <div className="text-red-700 text-sm mt-1">{error}</div>
        </div>
      )}

      {/* Debug Logs */}
      {debugLogs.length > 0 && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <h3 className="font-medium mb-2">🔍 デバッグログ</h3>
          <div className="bg-black text-green-400 p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
            {debugLogs.map((log, index) => (
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
            <div className="mt-3 space-y-1 text-sm">
              <div className="text-gray-600">
                ファイル: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)
              </div>
              {videoDuration > 0 && (
                <div className="text-green-600">
                  ✅ 動画読み込み完了 - 長さ: {videoDuration.toFixed(1)}秒
                </div>
              )}
              {videoFile && !videoLoaded && (
                <div className="text-yellow-600">
                  ⏳ 動画メタデータ読み込み中...
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Video Player */}
      {videoFile && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">🎥 動画解析</h2>
          
          <div className="relative bg-gray-900 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full aspect-video object-contain"
              controls={false}
              playsInline
              preload="metadata"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>

          <div className="mt-4 space-y-4">
            {/* Analysis Controls */}
            <div className="flex gap-3">
              <button
                onClick={analyzeVideo}
                disabled={isAnalyzing || !videoLoaded}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {isAnalyzing ? `🔄 解析中... (${currentAnalyzingFrame}/20)` : '🔍 動画解析開始 (最大20フレーム)'}
              </button>
              
              {results.length > 0 && (
                <div className="text-sm text-gray-600 flex items-center">
                  解析済み: {results.length} フレーム
                </div>
              )}
            </div>

            {/* Analysis Progress */}
            {isAnalyzing && (
              <div className="space-y-2">
                <div className="bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
                <div className="text-sm text-gray-600 text-center">
                  フレーム {currentAnalyzingFrame}/20 - {analysisProgress.toFixed(1)}% 完了
                </div>
              </div>
            )}

            {/* Frame Navigation */}
            {results.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => goToFrame(currentFrame - 1)}
                    disabled={currentFrame <= 0}
                    className="px-3 py-1 bg-gray-600 text-white rounded disabled:opacity-50"
                  >
                    ◀️
                  </button>
                  
                  <input
                    type="range"
                    min="0"
                    max={results.length - 1}
                    value={currentFrame}
                    onChange={(e) => goToFrame(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  
                  <button
                    onClick={() => goToFrame(currentFrame + 1)}
                    disabled={currentFrame >= results.length - 1}
                    className="px-3 py-1 bg-gray-600 text-white rounded disabled:opacity-50"
                  >
                    ▶️
                  </button>
                </div>

                <div className="text-sm text-gray-600 text-center">
                  フレーム: {currentFrame + 1} / {results.length}
                  {results[currentFrame] && (
                    <>
                      {results[currentFrame].angles.hip && (
                        <span className="ml-4 font-medium">
                          股関節角度: {results[currentFrame].angles.hip}°
                        </span>
                      )}
                      <span className="ml-4 font-medium">
                        信頼度: {(results[currentFrame].confidence * 100).toFixed(1)}%
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analysis Results Summary */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">📊 解析結果</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600">総フレーム数</div>
              <div className="text-2xl font-bold text-blue-800">{results.length}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600">平均股関節角度</div>
              <div className="text-2xl font-bold text-green-800">
                {results.length > 0 ? (results.reduce((sum, r) => sum + (r.angles.hip || 0), 0) / results.length).toFixed(1) : 0}°
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-purple-600">姿勢検出率</div>
              <div className="text-2xl font-bold text-purple-800">
                {results.length > 0 ? Math.round(results.filter(r => r.landmarks.length > 0).length / results.length * 100) : 0}%
              </div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm text-orange-600">平均信頼度</div>
              <div className="text-2xl font-bold text-orange-800">
                {results.length > 0 ? (results.reduce((sum, r) => sum + r.confidence, 0) / results.length * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}