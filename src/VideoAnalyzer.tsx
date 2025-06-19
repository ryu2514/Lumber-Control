import { useState, useRef, useCallback } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

interface AnalysisResult {
  frame: number
  timestamp: number
  landmarks: any[]
  worldLandmarks: any[]
  angles: { hip: number | null }
}

export function VideoAnalyzer() {
  const [isReady, setIsReady] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentFrame, setCurrentFrame] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const poseLandmarker = useRef<PoseLandmarker | null>(null)

  // Initialize MediaPipe
  const initializeMediaPipe = async () => {
    try {
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

      setIsReady(true)
    } catch (error) {
      console.error('MediaPipe初期化エラー:', error)
    }
  }

  // Handle video upload
  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file)
      setResults([])
      setCurrentFrame(0)
      
      // Load video
      if (videoRef.current) {
        const url = URL.createObjectURL(file)
        videoRef.current.src = url
        videoRef.current.onloadedmetadata = () => {
          drawCurrentFrame()
        }
      }
    }
  }

  // Calculate angle from world landmarks
  const calculateHipAngle = (worldLandmarks: any[]): number | null => {
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
  }

  // Draw pose overlay on canvas
  const drawPoseOverlay = (landmarks: any[], angles: { hip: number | null }) => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Match canvas size to video
    canvas.width = videoRef.current.videoWidth || videoRef.current.clientWidth
    canvas.height = videoRef.current.videoHeight || videoRef.current.clientHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!landmarks || landmarks.length === 0) return

    // Draw landmarks
    landmarks.forEach((landmark, index) => {
      if (landmark.visibility > 0.5) {
        const x = landmark.x * canvas.width
        const y = landmark.y * canvas.height
        
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, 2 * Math.PI)
        // Color coding: red for key joints, green for others
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
      [11,12], [11,23], [12,24], [23,24], // Torso
      [23,25], [24,26], [25,27], [26,28], // Legs
      [11,13], [12,14], [13,15], [14,16]  // Arms
    ]
    
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

    // Draw angle text
    if (angles.hip !== null) {
      ctx.font = 'bold 20px Arial'
      ctx.fillStyle = '#FFFF00'
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      const text = `Hip: ${angles.hip}°`
      ctx.strokeText(text, 20, 40)
      ctx.fillText(text, 20, 40)
    }

    // Draw frame number
    ctx.font = 'bold 16px Arial'
    ctx.fillStyle = '#FFFFFF'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    const frameText = `Frame: ${currentFrame + 1}`
    ctx.strokeText(frameText, canvas.width - 120, 30)
    ctx.fillText(frameText, canvas.width - 120, 30)
  }

  // Draw current frame with pose overlay
  const drawCurrentFrame = useCallback(() => {
    if (results.length > 0 && results[currentFrame]) {
      const result = results[currentFrame]
      drawPoseOverlay(result.landmarks, result.angles)
    } else {
      // Clear canvas if no results
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }, [results, currentFrame])

  // Analyze video
  const analyzeVideo = async () => {
    if (!poseLandmarker.current || !videoRef.current || !videoFile) return

    setIsAnalyzing(true)
    setResults([])
    
    const video = videoRef.current
    const duration = video.duration
    const fps = 30 // Analyze at 30fps
    const frameInterval = 1 / fps
    const totalFrames = Math.floor(duration * fps)

    const analysisResults: AnalysisResult[] = []

    for (let frame = 0; frame < totalFrames; frame++) {
      const time = frame * frameInterval
      video.currentTime = time

      // Wait for video to seek
      await new Promise(resolve => {
        video.onseeked = resolve
        if (video.readyState >= 2) resolve(undefined)
      })

      try {
        const result = poseLandmarker.current.detectForVideo(video, time * 1000)
        
        const landmarks = result.landmarks[0] || []
        const worldLandmarks = result.worldLandmarks[0] || []
        const hipAngle = calculateHipAngle(worldLandmarks)

        analysisResults.push({
          frame,
          timestamp: time,
          landmarks,
          worldLandmarks,
          angles: { hip: hipAngle }
        })

        setAnalysisProgress((frame + 1) / totalFrames * 100)
      } catch (error) {
        console.error(`Frame ${frame} analysis error:`, error)
      }
    }

    setResults(analysisResults)
    setCurrentFrame(0)
    setIsAnalyzing(false)
    
    // Draw first frame
    if (analysisResults.length > 0) {
      video.currentTime = 0
      setTimeout(drawCurrentFrame, 100)
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
        <h1 className="text-3xl font-bold mb-2">動画姿勢解析ツール</h1>
        <p className="text-gray-600">動画をアップロードしてMediaPipeで姿勢解析</p>
      </div>

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
            <div className="mt-3 text-sm text-gray-600">
              選択済み: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)
            </div>
          )}
        </div>
      )}

      {/* Video Player with Pose Overlay */}
      {videoFile && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">🎥 動画解析</h2>
          
          <div className="relative bg-gray-900 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full aspect-video object-contain"
              controls={false}
              playsInline
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
                disabled={isAnalyzing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {isAnalyzing ? '🔄 解析中...' : '🔍 動画解析開始'}
              </button>
              
              {results.length > 0 && (
                <div className="text-sm text-gray-600 flex items-center">
                  解析完了: {results.length} フレーム
                </div>
              )}
            </div>

            {/* Analysis Progress */}
            {isAnalyzing && (
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${analysisProgress}%` }}
                />
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
                  {results[currentFrame]?.angles.hip && (
                    <span className="ml-4 font-medium">
                      股関節角度: {results[currentFrame].angles.hip}°
                    </span>
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
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600">総フレーム数</div>
              <div className="text-2xl font-bold text-blue-800">{results.length}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600">平均股関節角度</div>
              <div className="text-2xl font-bold text-green-800">
                {(results.reduce((sum, r) => sum + (r.angles.hip || 0), 0) / results.length).toFixed(1)}°
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-purple-600">姿勢検出率</div>
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