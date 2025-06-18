import { useState, useRef, useEffect } from 'react'
import { TestType, TestAnalysis, PoseAnalysisResult } from './types'
import { MediaPipeService } from './mediapipe'
import { LumbarControlEvaluator } from './evaluator'

const TEST_NAMES = {
  [TestType.STANDING_HIP_FLEXION]: '立位股関節屈曲テスト',
  [TestType.ROCK_BACK]: '四つ這い後方移動テスト',
  [TestType.SITTING_KNEE_EXTENSION]: '座位膝伸展テスト'
}

export function PoseAnalyzer() {
  const [selectedTest, setSelectedTest] = useState<TestType | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<TestAnalysis | null>(null)
  const [currentPose, setCurrentPose] = useState<PoseAnalysisResult | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaService = useRef<MediaPipeService>(new MediaPipeService())
  const evaluator = useRef<LumbarControlEvaluator | null>(null)
  const analysisInterval = useRef<number | null>(null)

  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await new Promise(resolve => {
          videoRef.current!.onloadedmetadata = resolve
        })
        videoRef.current.play()
        await mediaService.current.initialize()
        setIsReady(true)
      }
    } catch (error) {
      console.error('初期化エラー:', error)
    }
  }

  const startRecording = () => {
    if (!selectedTest || !videoRef.current) return
    
    evaluator.current = new LumbarControlEvaluator(selectedTest)
    setIsRecording(true)
    setResults(null)

    analysisInterval.current = window.setInterval(async () => {
      const poseResult = await mediaService.current.detectPose(videoRef.current!)
      if (poseResult && evaluator.current) {
        setCurrentPose(poseResult)
        evaluator.current.addAnalysisData(poseResult)
      }
    }, 100)
  }

  const stopRecording = async () => {
    setIsRecording(false)
    if (analysisInterval.current) {
      clearInterval(analysisInterval.current)
    }

    if (evaluator.current) {
      setIsAnalyzing(true)
      const analysisResults = evaluator.current.evaluateTest()
      setResults(analysisResults)
      setIsAnalyzing(false)
    }
  }

  // Canvas drawing
  useEffect(() => {
    if (!currentPose || !canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = videoRef.current.videoWidth || 640
    canvas.height = videoRef.current.videoHeight || 480

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const landmarks = currentPose.landmarks.landmarks[0]
    if (landmarks) {
      // Draw landmarks
      landmarks.forEach((landmark: any, index: number) => {
        if (landmark.visibility > 0.5) {
          const x = landmark.x * canvas.width
          const y = landmark.y * canvas.height
          
          ctx.beginPath()
          ctx.arc(x, y, 4, 0, 2 * Math.PI)
          ctx.fillStyle = index >= 23 && index <= 28 ? '#FF0000' : '#00FF00'
          ctx.fill()
        }
      })

      // Draw connections
      const connections = [[11,12],[11,23],[12,24],[23,24],[23,25],[24,26],[25,27],[26,28]]
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
  }, [currentPose])

  const getScoreLabel = (score: number) => {
    if (score >= 4) return { label: '優秀', color: 'text-green-600' }
    if (score >= 3) return { label: '良好', color: 'text-blue-600' }
    if (score >= 2) return { label: '要改善', color: 'text-orange-600' }
    return { label: '要注意', color: 'text-red-600' }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold text-center">理学療法士向け姿勢解析ツール</h1>
      
      {!isReady ? (
        <div className="text-center">
          <button 
            onClick={initializeCamera}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            カメラ・MediaPipe初期化
          </button>
        </div>
      ) : (
        <>
          {!selectedTest ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">テストを選択</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {Object.entries(TEST_NAMES).map(([testType, name]) => (
                  <button
                    key={testType}
                    onClick={() => setSelectedTest(testType as TestType)}
                    className="p-4 border rounded-lg hover:bg-gray-50 text-left"
                  >
                    <h3 className="font-medium">{name}</h3>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="relative">
                  <video
                    ref={videoRef}
                    className="w-full aspect-video bg-gray-100 rounded-lg"
                    playsInline
                    muted
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex-1 py-2 px-4 rounded-lg ${
                      isRecording 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isRecording ? '録画停止' : '録画開始'}
                  </button>
                  <button
                    onClick={() => setSelectedTest(null)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    テスト変更
                  </button>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium">{TEST_NAMES[selectedTest]}</h3>
                </div>
              </div>

              <div className="space-y-4">
                {isAnalyzing ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p>解析中...</p>
                  </div>
                ) : results ? (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">評価結果</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { key: 'lumbarStability', label: '腰椎安定性' },
                        { key: 'trunkControl', label: '体幹制御' },
                        { key: 'movementPattern', label: '動作パターン' },
                        { key: 'compensatoryMovement', label: '代償動作' }
                      ].map(({ key, label }) => {
                        const score = results[key as keyof TestAnalysis] as number
                        const { label: scoreLabel, color } = getScoreLabel(score)
                        return (
                          <div key={key} className="p-3 border rounded-lg">
                            <div className="text-sm text-gray-600">{label}</div>
                            <div className={`text-lg font-bold ${color}`}>{scoreLabel}</div>
                          </div>
                        )
                      })}
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">推奨事項</h4>
                      <ul className="space-y-1">
                        {results.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm text-gray-700 flex items-start">
                            <span className="text-blue-600 mr-2">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    テストを実行すると結果が表示されます
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}