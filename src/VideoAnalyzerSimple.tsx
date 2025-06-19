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

export function VideoAnalyzerSimple() {
  const [isReady, setIsReady] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const poseLandmarker = useRef<PoseLandmarker | null>(null)

  const updateDebug = (message: string) => {
    const time = new Date().toLocaleTimeString()
    setDebugInfo(prev => prev + `\n[${time}] ${message}`)
    console.log(message)
  }

  // Initialize MediaPipe
  const initializeMediaPipe = async () => {
    try {
      setError(null)
      updateDebug('MediaPipe初期化開始...')
      
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

      updateDebug('MediaPipe初期化完了')
      setIsReady(true)
    } catch (error) {
      updateDebug(`MediaPipe初期化エラー: ${error}`)
      setError(`MediaPipe初期化に失敗: ${error}`)
    }
  }

  // Handle video upload with forced loading
  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('video/')) {
      setError('動画ファイルを選択してください')
      return
    }

    updateDebug(`動画ファイル選択: ${file.name} (${(file.size/1024/1024).toFixed(1)}MB)`)
    setVideoFile(file)
    setResults([])
    setCurrentFrame(0)
    setError(null)
    setVideoLoaded(false)
    setVideoDuration(0)
    
    if (videoRef.current) {
      // Clean up previous URL
      if (videoRef.current.src) {
        URL.revokeObjectURL(videoRef.current.src)
      }
      
      const url = URL.createObjectURL(file)
      videoRef.current.src = url
      
      // Multiple event listeners for better compatibility
      const video = videoRef.current
      
      let metadataLoaded = false
      
      const handleMetadataLoaded = () => {
        if (metadataLoaded) return
        metadataLoaded = true
        
        updateDebug(`動画情報: ${video.duration}s, ${video.videoWidth}x${video.videoHeight}`)
        
        if (video.duration && !isNaN(video.duration) && video.duration > 0) {
          setVideoDuration(video.duration)
          setVideoLoaded(true)
          updateDebug('✅ 動画読み込み完了')
        } else {
          updateDebug('❌ 動画の長さを取得できません')
          // Try alternative method
          forceVideoLoad()
        }
      }
      
      const forceVideoLoad = async () => {
        updateDebug('代替方法で動画読み込み試行...')
        try {
          // Force play and pause to trigger metadata loading
          video.muted = true
          await video.play()
          video.pause()
          video.currentTime = 0
          
          // Wait a bit and check again
          setTimeout(() => {
            if (video.duration && !isNaN(video.duration) && video.duration > 0) {
              setVideoDuration(video.duration)
              setVideoLoaded(true)
              updateDebug('✅ 強制読み込み成功')
            } else {
              setError('動画のメタデータを読み込めません。別のファイルを試してください。')
              updateDebug('❌ 強制読み込み失敗')
            }
          }, 1000)
        } catch (err) {
          updateDebug(`強制読み込みエラー: ${err}`)
          setError('動画の読み込みに失敗しました')
        }
      }
      
      // Set up event listeners
      video.addEventListener('loadedmetadata', handleMetadataLoaded)
      video.addEventListener('loadeddata', handleMetadataLoaded)
      video.addEventListener('canplay', handleMetadataLoaded)
      video.addEventListener('canplaythrough', handleMetadataLoaded)
      
      video.onerror = (e) => {
        updateDebug(`動画エラー: ${e}`)
        setError('動画ファイルの読み込みエラー')
      }
      
      // Force load
      video.load()
      
      // Timeout fallback
      setTimeout(() => {
        if (!metadataLoaded) {
          updateDebug('タイムアウト: 強制読み込み実行')
          forceVideoLoad()
        }
      }, 3000)
    }
  }

  // Calculate angle
  const calculateHipAngle = (worldLandmarks: any[]): number | null => {
    try {
      if (!worldLandmarks || worldLandmarks.length < 26) return null
      
      const leftShoulder = worldLandmarks[11]
      const leftHip = worldLandmarks[23]
      const leftKnee = worldLandmarks[25]
      
      if (!leftShoulder || !leftHip || !leftKnee) return null

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
      if (landmark.visibility > 0.5) {
        const x = landmark.x * canvas.width
        const y = landmark.y * canvas.height
        
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, 2 * Math.PI)
        
        const isKeyJoint = [11,12,23,24,25,26,27,28].includes(index)
        ctx.fillStyle = isKeyJoint ? '#FF0000' : '#00FF00'
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
      
      if (startPoint?.visibility > 0.5 && endPoint?.visibility > 0.5) {
        ctx.beginPath()
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height)
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height)
        ctx.strokeStyle = '#00FF00'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })

    // Draw info
    ctx.font = 'bold 16px Arial'
    ctx.fillStyle = '#FFFF00'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    
    if (angles.hip !== null) {
      ctx.strokeText(`Hip: ${angles.hip}°`, 10, 30)
      ctx.fillText(`Hip: ${angles.hip}°`, 10, 30)
    }
    
    ctx.strokeText(`Conf: ${(confidence * 100).toFixed(0)}%`, 10, 55)
    ctx.fillText(`Conf: ${(confidence * 100).toFixed(0)}%`, 10, 55)
  }

  const drawCurrentFrame = useCallback(() => {
    if (results.length > 0 && results[currentFrame]) {
      const result = results[currentFrame]
      drawPoseOverlay(result.landmarks, result.angles, result.confidence)
    }
  }, [results, currentFrame])

  // Simple video analysis
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
      updateDebug(`解析開始: ${videoDuration.toFixed(1)}秒の動画`)
      
      const fps = 3
      const totalFrames = Math.min(Math.floor(videoDuration * fps), 30) // Max 30 frames
      const analysisResults: AnalysisResult[] = []

      for (let frame = 0; frame < totalFrames; frame++) {
        const time = frame / fps
        
        updateDebug(`フレーム ${frame + 1}/${totalFrames}`)
        
        try {
          // Simple seek without complex waiting
          video.currentTime = time
          
          // Wait briefly for seek
          await new Promise(resolve => setTimeout(resolve, 200))
          
          // Analyze
          const result = poseLandmarker.current.detectForVideo(video, time * 1000)
          
          const landmarks = result.landmarks[0] || []
          const worldLandmarks = result.worldLandmarks[0] || []
          
          const confidence = landmarks.length > 0 
            ? landmarks.reduce((sum: number, lm: any) => sum + (lm.visibility || 0), 0) / landmarks.length
            : 0
            
          const hipAngle = calculateHipAngle(worldLandmarks)

          analysisResults.push({
            frame,
            timestamp: time,
            landmarks,
            worldLandmarks,
            angles: { hip: hipAngle },
            confidence
          })

          setAnalysisProgress((frame + 1) / totalFrames * 100)
          
        } catch (error) {
          updateDebug(`フレーム ${frame} エラー: ${error}`)
        }
      }

      setResults(analysisResults)
      setCurrentFrame(0)
      updateDebug(`解析完了: ${analysisResults.length}フレーム`)
      
      if (analysisResults.length > 0) {
        video.currentTime = 0
        setTimeout(drawCurrentFrame, 100)
      }
    } catch (error) {
      updateDebug(`解析エラー: ${error}`)
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
    
    setTimeout(drawCurrentFrame, 50)
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">動画姿勢解析ツール（シンプル版）</h1>
        <p className="text-gray-600">メタデータ読み込み問題を解決・簡素化</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-medium">⚠️ エラー</div>
          <div className="text-red-700 text-sm mt-1">{error}</div>
        </div>
      )}

      {/* Debug Info */}
      {debugInfo && (
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono max-h-32 overflow-y-auto">
          {debugInfo.split('\n').map((line, i) => <div key={i}>{line}</div>)}
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
            accept="video/mp4,video/mov,video/avi"
            onChange={handleVideoUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          
          {videoFile && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm space-y-2">
                <div>📁 ファイル: {videoFile.name}</div>
                <div>📏 サイズ: {(videoFile.size / 1024 / 1024).toFixed(1)} MB</div>
                {videoDuration > 0 ? (
                  <div className="text-green-600">⏱️ 長さ: {videoDuration.toFixed(1)}秒 ✅</div>
                ) : (
                  <div className="text-yellow-600">⏳ メタデータ読み込み中...</div>
                )}
              </div>
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
              muted
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex gap-3">
              <button
                onClick={analyzeVideo}
                disabled={isAnalyzing || !videoLoaded}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {isAnalyzing ? '🔄 解析中...' : '🔍 解析開始 (最大30フレーム)'}
              </button>
            </div>

            {isAnalyzing && (
              <div className="bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
            )}

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

                <div className="text-center text-sm">
                  フレーム: {currentFrame + 1} / {results.length}
                  {results[currentFrame] && (
                    <>
                      {results[currentFrame].angles.hip && (
                        <span className="ml-4">角度: {results[currentFrame].angles.hip}°</span>
                      )}
                      <span className="ml-4">信頼度: {(results[currentFrame].confidence * 100).toFixed(0)}%</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">📊 解析結果</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-sm text-blue-600">総フレーム数</div>
              <div className="text-2xl font-bold text-blue-800">{results.length}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-sm text-green-600">平均角度</div>
              <div className="text-2xl font-bold text-green-800">
                {(results.reduce((sum, r) => sum + (r.angles.hip || 0), 0) / results.length).toFixed(1)}°
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-sm text-purple-600">検出率</div>
              <div className="text-2xl font-bold text-purple-800">
                {Math.round(results.filter(r => r.landmarks.length > 0).length / results.length * 100)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}