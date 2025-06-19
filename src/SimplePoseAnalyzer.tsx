import { useState, useRef } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

interface PoseData {
  landmarks: any[]
  worldLandmarks: any[]
  timestamp: number
}

export function SimplePoseAnalyzer() {
  const [isReady, setIsReady] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [poseData, setPoseData] = useState<PoseData | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const poseLandmarker = useRef<PoseLandmarker | null>(null)
  const animationFrame = useRef<number | null>(null)

  // Initialize MediaPipe
  const initializeMediaPipe = async () => {
    try {
      // Initialize camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current!.play()
        }
      }

      // Initialize MediaPipe Pose
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
      console.error('初期化エラー:', error)
    }
  }

  // Pose detection loop
  const detectPose = () => {
    if (!poseLandmarker.current || !videoRef.current || !isAnalyzing) return

    const video = videoRef.current
    const videoTime = video.currentTime * 1000

    try {
      const result = poseLandmarker.current.detectForVideo(video, videoTime)
      
      if (result.landmarks.length > 0) {
        setPoseData({
          landmarks: result.landmarks[0],
          worldLandmarks: result.worldLandmarks[0],
          timestamp: Date.now()
        })
        drawPose(result.landmarks[0])
      }
    } catch (error) {
      console.error('姿勢検出エラー:', error)
    }

    animationFrame.current = requestAnimationFrame(detectPose)
  }

  // Draw pose on canvas
  const drawPose = (landmarks: any[]) => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw landmarks
    landmarks.forEach((landmark, index) => {
      if (landmark.visibility > 0.5) {
        const x = landmark.x * canvas.width
        const y = landmark.y * canvas.height
        
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, 2 * Math.PI)
        // Color code: red for core joints, green for others
        ctx.fillStyle = [11,12,23,24,25,26].includes(index) ? '#FF0000' : '#00FF00'
        ctx.fill()
      }
    })

    // Draw connections
    const connections = [
      [11,12], [11,23], [12,24], [23,24], // Torso
      [23,25], [24,26], [25,27], [26,28]  // Legs
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
  }

  // Start/Stop analysis
  const toggleAnalysis = () => {
    if (isAnalyzing) {
      setIsAnalyzing(false)
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }
    } else {
      setIsAnalyzing(true)
      detectPose()
    }
  }

  // Calculate simple angles
  const calculateAngles = () => {
    if (!poseData?.worldLandmarks) return null

    const landmarks = poseData.worldLandmarks
    
    // Hip flexion angle (simplified)
    const leftHip = landmarks[23]
    const leftKnee = landmarks[25]
    const leftShoulder = landmarks[11]
    
    if (leftHip && leftKnee && leftShoulder) {
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
      
      // Calculate angle between vectors
      const dot = hipKneeVector.x * shoulderHipVector.x + 
                  hipKneeVector.y * shoulderHipVector.y + 
                  hipKneeVector.z * shoulderHipVector.z
      
      const mag1 = Math.sqrt(hipKneeVector.x**2 + hipKneeVector.y**2 + hipKneeVector.z**2)
      const mag2 = Math.sqrt(shoulderHipVector.x**2 + shoulderHipVector.y**2 + shoulderHipVector.z**2)
      
      const angle = Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI)
      return Math.round(angle)
    }
    
    return null
  }

  const hipAngle = calculateAngles()

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">MediaPipe 動作解析</h1>
        <p className="text-gray-600">シンプルな姿勢検出・角度計算</p>
      </div>

      {!isReady ? (
        <div className="text-center py-8">
          <button 
            onClick={initializeMediaPipe}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            📷 カメラ・MediaPipe初期化
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Video */}
          <div className="bg-white rounded-lg border p-4">
            <h2 className="font-semibold mb-3">カメラ映像</h2>
            <div className="relative bg-gray-100 rounded">
              <video
                ref={videoRef}
                className="w-full aspect-video object-cover rounded"
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            </div>
            <button
              onClick={toggleAnalysis}
              className={`w-full mt-3 py-2 px-4 rounded font-medium ${
                isAnalyzing 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isAnalyzing ? '⏹ 解析停止' : '▶️ 解析開始'}
            </button>
          </div>

          {/* Data */}
          <div className="bg-white rounded-lg border p-4">
            <h2 className="font-semibold mb-3">解析データ</h2>
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-600">検出状態</div>
                <div className="font-medium">
                  {poseData ? '✅ 姿勢検出中' : '❌ 姿勢未検出'}
                </div>
              </div>
              
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-600">ランドマーク数</div>
                <div className="font-medium">
                  {poseData?.landmarks?.length || 0} / 33
                </div>
              </div>
              
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-600">股関節角度（概算）</div>
                <div className="font-medium text-lg">
                  {hipAngle ? `${hipAngle}°` : '---'}
                </div>
              </div>

              {poseData && (
                <div className="bg-blue-50 p-3 rounded">
                  <div className="text-sm text-blue-600 mb-2">主要ランドマーク座標</div>
                  <div className="text-xs space-y-1">
                    <div>左肩: ({poseData.worldLandmarks[11]?.x.toFixed(3)}, {poseData.worldLandmarks[11]?.y.toFixed(3)})</div>
                    <div>左腰: ({poseData.worldLandmarks[23]?.x.toFixed(3)}, {poseData.worldLandmarks[23]?.y.toFixed(3)})</div>
                    <div>左膝: ({poseData.worldLandmarks[25]?.x.toFixed(3)}, {poseData.worldLandmarks[25]?.y.toFixed(3)})</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}