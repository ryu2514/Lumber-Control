import { useState, useRef, useCallback } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

interface BlazePoseLandmark {
  x: number
  y: number
  z: number
  visibility: number
}

interface TDPTPoint {
  x: number
  y: number
  z: number
}

interface AnalysisResult {
  frame: number
  timestamp: number
  blazePoseLandmarks: BlazePoseLandmark[]
  tdptPoints: TDPTPoint[]
  confidence: number
  angles: {
    hipFlexion: number | null
    kneeFlexion: number | null
    ankleFlexion: number | null
  }
}

export function VideoAnalyzerTDPT() {
  const [isReady, setIsReady] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
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
      console.log('MediaPipe初期化開始')
      
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

    console.log(`動画選択: ${file.name}`)
    setVideoFile(file)
    setResults([])
    setCurrentFrame(0)
    setError(null)
    
    if (videoRef.current) {
      if (videoRef.current.src) {
        URL.revokeObjectURL(videoRef.current.src)
      }
      
      const url = URL.createObjectURL(file)
      videoRef.current.src = url
      videoRef.current.muted = true
      videoRef.current.playsInline = true
    }
  }

  // Convert BlazePose landmarks to TDPT 24 points
  const convertToTDPT = (landmarks: BlazePoseLandmark[]): TDPTPoint[] => {
    if (landmarks.length < 33) {
      return Array(24).fill({ x: 0, y: 0, z: 0 })
    }

    const tdptPoints: TDPTPoint[] = new Array(24)

    // Helper functions
    const midpoint = (p1: BlazePoseLandmark, p2: BlazePoseLandmark): TDPTPoint => ({
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
      z: (p1.z + p2.z) / 2
    })

    const centroid = (p1: BlazePoseLandmark, p2: BlazePoseLandmark, p3: BlazePoseLandmark): TDPTPoint => ({
      x: (p1.x + p2.x + p3.x) / 3,
      y: (p1.y + p2.y + p3.y) / 3,
      z: (p1.z + p2.z + p3.z) / 3
    })

    const addOffset = (point: TDPTPoint, offset: { x: number, y: number, z: number }): TDPTPoint => ({
      x: point.x + offset.x,
      y: point.y + offset.y,
      z: point.z + offset.z
    })

    // Direct mappings
    tdptPoints[2] = { x: landmarks[11].x, y: landmarks[11].y, z: landmarks[11].z } // left_shoulder
    tdptPoints[3] = { x: landmarks[12].x, y: landmarks[12].y, z: landmarks[12].z } // right_shoulder
    tdptPoints[4] = { x: landmarks[13].x, y: landmarks[13].y, z: landmarks[13].z } // left_elbow
    tdptPoints[5] = { x: landmarks[14].x, y: landmarks[14].y, z: landmarks[14].z } // right_elbow
    tdptPoints[6] = { x: landmarks[15].x, y: landmarks[15].y, z: landmarks[15].z } // left_wrist
    tdptPoints[7] = { x: landmarks[16].x, y: landmarks[16].y, z: landmarks[16].z } // right_wrist
    tdptPoints[13] = { x: landmarks[23].x, y: landmarks[23].y, z: landmarks[23].z } // left_hip
    tdptPoints[14] = { x: landmarks[24].x, y: landmarks[24].y, z: landmarks[24].z } // right_hip
    tdptPoints[15] = { x: landmarks[25].x, y: landmarks[25].y, z: landmarks[25].z } // left_knee
    tdptPoints[16] = { x: landmarks[26].x, y: landmarks[26].y, z: landmarks[26].z } // right_knee
    tdptPoints[17] = { x: landmarks[27].x, y: landmarks[27].y, z: landmarks[27].z } // left_ankle
    tdptPoints[18] = { x: landmarks[28].x, y: landmarks[28].y, z: landmarks[28].z } // right_ankle
    tdptPoints[21] = { x: landmarks[31].x, y: landmarks[31].y, z: landmarks[31].z } // left_toe
    tdptPoints[22] = { x: landmarks[32].x, y: landmarks[32].y, z: landmarks[32].z } // right_toe

    // Calculated points
    const shoulderMid = midpoint(landmarks[11], landmarks[12])
    const hipMid = midpoint(landmarks[23], landmarks[24])

    // 0: head_top (estimated from nose)
    const neckCenter = addOffset(shoulderMid, { x: 0, y: -0.1, z: 0 })
    const noseToNeck = {
      x: landmarks[0].x - neckCenter.x,
      y: landmarks[0].y - neckCenter.y,
      z: landmarks[0].z - neckCenter.z
    }
    tdptPoints[0] = addOffset({ x: landmarks[0].x, y: landmarks[0].y, z: landmarks[0].z }, 
                             { x: noseToNeck.x * 0.3, y: noseToNeck.y * 0.3, z: noseToNeck.z * 0.3 })

    // 1: neck
    tdptPoints[1] = addOffset(shoulderMid, { x: 0, y: -0.1, z: 0 })

    // 8: left_hand (centroid of finger tips)
    tdptPoints[8] = centroid(landmarks[17], landmarks[19], landmarks[21])

    // 9: right_hand (centroid of finger tips)
    tdptPoints[9] = centroid(landmarks[18], landmarks[20], landmarks[22])

    // 10: chest_center
    tdptPoints[10] = addOffset(shoulderMid, { x: 0, y: 0.15, z: 0 })

    // 11: spine_mid
    tdptPoints[11] = midpoint(shoulderMid, hipMid)

    // 12: pelvis_center
    tdptPoints[12] = hipMid

    // 19: left_foot
    tdptPoints[19] = midpoint(landmarks[29], landmarks[31])

    // 20: right_foot
    tdptPoints[20] = midpoint(landmarks[30], landmarks[32])

    // 23: spine_base
    tdptPoints[23] = addOffset(hipMid, { x: 0, y: -0.05, z: 0 })

    return tdptPoints
  }

  // Calculate angles using TDPT points
  const calculateAngles = (tdptPoints: TDPTPoint[]) => {
    const calculateAngle = (p1: TDPTPoint, p2: TDPTPoint, p3: TDPTPoint): number | null => {
      try {
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z }
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z }

        const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z)
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z)

        if (mag1 === 0 || mag2 === 0) return null

        const cosAngle = dot / (mag1 * mag2)
        const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI)
        return Math.round(angle * 10) / 10
      } catch (error) {
        return null
      }
    }

    return {
      hipFlexion: calculateAngle(tdptPoints[11], tdptPoints[13], tdptPoints[15]), // spine_mid -> left_hip -> left_knee
      kneeFlexion: calculateAngle(tdptPoints[13], tdptPoints[15], tdptPoints[17]), // left_hip -> left_knee -> left_ankle
      ankleFlexion: calculateAngle(tdptPoints[15], tdptPoints[17], tdptPoints[21]) // left_knee -> left_ankle -> left_toe
    }
  }

  // Draw TDPT skeleton
  const drawSkeleton = (tdptPoints: TDPTPoint[], angles: any, confidence: number) => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = videoRef.current.videoWidth || 640
    canvas.height = videoRef.current.videoHeight || 480
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw points
    tdptPoints.forEach((point, index) => {
      if (point.x !== 0 || point.y !== 0) {
        const x = point.x * canvas.width
        const y = point.y * canvas.height
        
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, 2 * Math.PI)
        
        // Color coding for different body parts
        if ([0, 1].includes(index)) ctx.fillStyle = '#FF0000' // Head/neck
        else if ([2, 3, 4, 5, 6, 7, 8, 9].includes(index)) ctx.fillStyle = '#00FF00' // Arms
        else if ([10, 11, 12, 23].includes(index)) ctx.fillStyle = '#0000FF' // Torso
        else if ([13, 14, 15, 16, 17, 18].includes(index)) ctx.fillStyle = '#FFD700' // Legs
        else ctx.fillStyle = '#FF69B4' // Feet
        
        ctx.fill()
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })

    // Draw connections (simplified skeleton)
    const connections = [
      [0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7], // Head to arms
      [1, 10], [10, 11], [11, 12], [12, 23], // Spine
      [12, 13], [12, 14], [13, 15], [14, 16], [15, 17], [16, 18], // Hips to ankles
      [17, 19], [18, 20], [19, 21], [20, 22] // Feet
    ]

    ctx.strokeStyle = '#00FFFF'
    ctx.lineWidth = 3
    connections.forEach(([start, end]) => {
      const startPoint = tdptPoints[start]
      const endPoint = tdptPoints[end]
      
      if (startPoint && endPoint && 
          (startPoint.x !== 0 || startPoint.y !== 0) && 
          (endPoint.x !== 0 || endPoint.y !== 0)) {
        ctx.beginPath()
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height)
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height)
        ctx.stroke()
      }
    })

    // Draw angle information
    ctx.font = 'bold 18px Arial'
    ctx.fillStyle = '#FFFF00'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3
    
    let yPos = 30
    if (angles.hipFlexion !== null) {
      const text = `股関節: ${angles.hipFlexion}°`
      ctx.strokeText(text, 20, yPos)
      ctx.fillText(text, 20, yPos)
      yPos += 25
    }
    if (angles.kneeFlexion !== null) {
      const text = `膝関節: ${angles.kneeFlexion}°`
      ctx.strokeText(text, 20, yPos)
      ctx.fillText(text, 20, yPos)
      yPos += 25
    }
    if (angles.ankleFlexion !== null) {
      const text = `足関節: ${angles.ankleFlexion}°`
      ctx.strokeText(text, 20, yPos)
      ctx.fillText(text, 20, yPos)
      yPos += 25
    }
    
    const confText = `信頼度: ${(confidence * 100).toFixed(0)}%`
    ctx.strokeText(confText, 20, yPos)
    ctx.fillText(confText, 20, yPos)
  }

  const drawCurrentFrame = useCallback(() => {
    if (results.length > 0 && results[currentFrame]) {
      const result = results[currentFrame]
      drawSkeleton(result.tdptPoints, result.angles, result.confidence)
    }
  }, [results, currentFrame])

  // Simple video analysis
  const analyzeVideo = async () => {
    if (!poseLandmarker.current || !videoRef.current || !videoFile) {
      setError('準備が完了していません')
      return
    }

    setIsAnalyzing(true)
    setResults([])
    setError(null)
    console.log('TDPT解析開始')
    
    try {
      const video = videoRef.current

      // Wait for video to be ready
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Try to get video duration, fallback to 10 seconds
      let duration = video.duration
      if (!duration || isNaN(duration) || duration <= 0) {
        duration = 10
        console.log('動画長さ不明 - 10秒と仮定')
      }
      
      console.log(`動画解析開始: ${duration.toFixed(1)}秒`)
      
      const frameCount = 5
      const analysisResults: AnalysisResult[] = []

      for (let i = 0; i < frameCount; i++) {
        const time = (i / (frameCount - 1)) * Math.min(duration, 15)
        
        console.log(`フレーム ${i + 1}/${frameCount}: ${time.toFixed(1)}秒`)
        
        try {
          video.currentTime = time
          await new Promise(resolve => setTimeout(resolve, 800))
          
          // MediaPipe analysis
          const result = poseLandmarker.current.detectForVideo(video, time * 1000)
          
          const blazePoseLandmarks: BlazePoseLandmark[] = result.landmarks[0] || []
          
          if (blazePoseLandmarks.length > 0) {
            // Convert to TDPT format
            const tdptPoints = convertToTDPT(blazePoseLandmarks)
            
            // Calculate angles
            const angles = calculateAngles(tdptPoints)
            
            // Calculate confidence
            const confidence = blazePoseLandmarks.reduce((sum, lm) => sum + (lm.visibility || 0), 0) / blazePoseLandmarks.length

            analysisResults.push({
              frame: i,
              timestamp: time,
              blazePoseLandmarks,
              tdptPoints,
              angles,
              confidence
            })

            console.log(`フレーム ${i + 1}: TDPT変換完了, 角度=${angles.hipFlexion || 'N/A'}°`)
          }

          setAnalysisProgress((i + 1) / frameCount * 100)
          
        } catch (error) {
          console.warn(`フレーム ${i + 1} エラー:`, error)
        }
      }

      setResults(analysisResults)
      setCurrentFrame(0)
      console.log(`TDPT解析完了: ${analysisResults.length}フレーム`)
      
      if (analysisResults.length > 0) {
        video.currentTime = 0
        setTimeout(drawCurrentFrame, 500)
      } else {
        setError('姿勢検出できませんでした')
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
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">TDPT動画姿勢解析ツール</h1>
        <p className="text-gray-600">BlazePose → TDPT 24点変換による3D姿勢解析</p>
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
              <div className="text-sm">
                📁 {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)
                <div className="text-green-600 mt-1">✅ TDPT解析準備完了</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Analysis */}
      {videoFile && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">🎥 TDPT姿勢解析</h2>
          
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
              {isAnalyzing ? `🔄 TDPT解析中... ${analysisProgress.toFixed(0)}%` : '🔍 TDPT解析開始 (5フレーム)'}
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
          <h2 className="text-lg font-semibold mb-4">📊 TDPT解析結果</h2>
          <div className="grid grid-cols-4 gap-4 text-center">
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
                {results.length > 0 ? (results.reduce((sum, r) => sum + (r.angles.kneeFlexion || 0), 0) / results.length).toFixed(1) : 0}°
              </div>
              <div className="text-sm text-purple-600">平均膝関節角度</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {results.length > 0 ? (results.reduce((sum, r) => sum + r.confidence, 0) / results.length * 100).toFixed(1) : 0}%
              </div>
              <div className="text-sm text-orange-600">平均信頼度</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}