import { useState, useRef, useEffect } from 'react'
import { TestType, TestAnalysis, PoseAnalysisResult } from './types'
import { MediaPipeService } from './mediapipe'
import { LumbarControlEvaluator } from './evaluator'
import { Tabs, Tab, TabContent } from './components/Tabs'
import { TestProtocol } from './components/TestProtocols'

export function PoseAnalyzer() {
  const [activeTab, setActiveTab] = useState<TestType>(TestType.STANDING_HIP_FLEXION)
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
    if (!isReady || !videoRef.current) return
    
    evaluator.current = new LumbarControlEvaluator(activeTab)
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
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          理学療法士向け姿勢解析ツール
        </h1>
        <p className="text-gray-600">
          MediaPipe Pose Landmarkerを使用した腰椎モーターコントロール評価
        </p>
      </div>
      
      {!isReady ? (
        <div className="bg-white rounded-lg border shadow-sm p-8 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">🎥</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">システム初期化</h2>
            <p className="text-gray-600">カメラとMediaPipeを初期化してください</p>
            <button 
              onClick={initializeCamera}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              🚀 初期化開始
            </button>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Camera View */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <h2 className="text-lg font-semibold flex items-center">
                  <span className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm mr-3">
                    📹
                  </span>
                  カメラ映像
                </h2>
              </div>
              <div className="relative aspect-video bg-gray-100">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
                
              </div>
            </div>

            {/* Test Results */}
            {(isAnalyzing || results) && (
              <div className="bg-white rounded-lg border shadow-sm">
                <div className="p-4 border-b bg-gray-50">
                  <h2 className="text-lg font-semibold">📊 評価結果</h2>
                </div>
                <div className="p-6">
                  {isAnalyzing ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                      <p className="text-gray-600">解析中...</p>
                    </div>
                  ) : results ? (
                    <div className="space-y-6">
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
                            <div key={key} className="bg-gray-50 p-4 rounded-lg text-center">
                              <div className="text-sm text-gray-600 mb-1">{label}</div>
                              <div className={`text-xl font-bold ${color}`}>{scoreLabel}</div>
                              <div className="text-xs text-gray-500">{score}/4</div>
                            </div>
                          )
                        })}
                      </div>
                      <div>
                        <h4 className="font-semibold mb-3 text-gray-900">💡 推奨事項</h4>
                        <ul className="space-y-2">
                          {results.recommendations.map((rec, index) => (
                            <li key={index} className="text-sm text-gray-700 flex items-start bg-blue-50 p-3 rounded-lg">
                              <span className="text-blue-600 mr-2">•</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* Test Protocols */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border shadow-sm">
              <div className="p-4 border-b bg-gray-50">
                <h2 className="text-lg font-semibold">🎯 テスト選択</h2>
              </div>
              <div className="p-4">
                <Tabs 
                  defaultValue={TestType.STANDING_HIP_FLEXION}
                  onValueChange={(value) => setActiveTab(value as TestType)}
                >
                  <Tab value={TestType.STANDING_HIP_FLEXION} label="立位股関節">
                    <TabContent>
                      <TestProtocol
                        testType={TestType.STANDING_HIP_FLEXION}
                        isActive={isRecording && activeTab === TestType.STANDING_HIP_FLEXION}
                        onStartTest={startRecording}
                        onStopTest={stopRecording}
                      />
                    </TabContent>
                  </Tab>
                  
                  <Tab value={TestType.ROCK_BACK} label="ロックバック">
                    <TabContent>
                      <TestProtocol
                        testType={TestType.ROCK_BACK}
                        isActive={isRecording && activeTab === TestType.ROCK_BACK}
                        onStartTest={startRecording}
                        onStopTest={stopRecording}
                      />
                    </TabContent>
                  </Tab>
                  
                  <Tab value={TestType.SITTING_KNEE_EXTENSION} label="座位膝伸展">
                    <TabContent>
                      <TestProtocol
                        testType={TestType.SITTING_KNEE_EXTENSION}
                        isActive={isRecording && activeTab === TestType.SITTING_KNEE_EXTENSION}
                        onStartTest={startRecording}
                        onStopTest={stopRecording}
                      />
                    </TabContent>
                  </Tab>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}