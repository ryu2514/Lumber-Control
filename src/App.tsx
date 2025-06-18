import { useState, useRef } from 'react'
import { TestType, TestAnalysis, PoseAnalysisResult } from './lib/mediapipe/types'
import { MediaPipePoseService } from './lib/mediapipe/service'
import { LumbarControlEvaluator } from './lib/analysis/evaluator'
import { TestSelector } from './components/TestSelector'
import { CameraView } from './components/CameraView'
import { PoseCanvas } from './components/PoseCanvas'
import { ResultsPanel } from './components/ResultsPanel'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'

function App() {
  const [selectedTest, setSelectedTest] = useState<TestType | undefined>()
  const [isMediaPipeReady, setIsMediaPipeReady] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentPose, setCurrentPose] = useState<PoseAnalysisResult | null>(null)
  const [results, setResults] = useState<TestAnalysis | null>(null)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)

  const mediaPipeService = useRef<MediaPipePoseService>(new MediaPipePoseService())
  const evaluator = useRef<LumbarControlEvaluator | null>(null)
  const analysisInterval = useRef<number | null>(null)

  const initializeMediaPipe = async () => {
    try {
      await mediaPipeService.current.initialize()
      setIsMediaPipeReady(true)
    } catch (error) {
      console.error('MediaPipe initialization failed:', error)
    }
  }

  const startRecording = () => {
    if (!selectedTest || !isMediaPipeReady || !videoElement) return

    evaluator.current = new LumbarControlEvaluator(selectedTest)
    setIsRecording(true)
    setResults(null)

    analysisInterval.current = window.setInterval(async () => {
      try {
        const poseResult = await mediaPipeService.current.detectPose(videoElement)
        if (poseResult && evaluator.current) {
          setCurrentPose(poseResult)
          evaluator.current.addAnalysisData(poseResult)
        }
      } catch (error) {
        console.error('Pose detection error:', error)
      }
    }, 100)
  }

  const stopRecording = async () => {
    setIsRecording(false)
    if (analysisInterval.current) {
      clearInterval(analysisInterval.current)
      analysisInterval.current = null
    }

    if (evaluator.current) {
      setIsAnalyzing(true)
      try {
        const analysisResults = evaluator.current.evaluateTest()
        setResults(analysisResults)
      } catch (error) {
        console.error('Analysis error:', error)
      } finally {
        setIsAnalyzing(false)
      }
    }
  }

  const handleVideoReady = (video: HTMLVideoElement) => {
    setVideoElement(video)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            理学療法士向け姿勢解析ツール
          </h1>
          <p className="text-gray-600">
            MediaPipe Pose Landmarkerを使用した腰椎モーターコントロール評価
          </p>
        </header>

        {!isMediaPipeReady && (
          <Card>
            <CardHeader>
              <CardTitle>システム初期化</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="mb-4">MediaPipeを初期化してください</p>
                <Button onClick={initializeMediaPipe}>
                  初期化開始
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isMediaPipeReady && !selectedTest && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">テストを選択してください</h2>
            <TestSelector 
              onTestSelect={setSelectedTest}
              selectedTest={selectedTest}
            />
          </div>
        )}

        {selectedTest && isMediaPipeReady && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="relative">
                <CameraView
                  onVideoReady={handleVideoReady}
                  isRecording={isRecording}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                />
                {videoElement && (
                  <PoseCanvas
                    poseResult={currentPose}
                    videoElement={videoElement}
                  />
                )}
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>現在のテスト</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {selectedTest === TestType.STANDING_HIP_FLEXION && '立位股関節屈曲テスト'}
                      {selectedTest === TestType.ROCK_BACK && '四つ這い後方移動テスト'}
                      {selectedTest === TestType.SITTING_KNEE_EXTENSION && '座位膝伸展テスト'}
                    </span>
                    <Button 
                      variant="outline" 
                      onClick={() => setSelectedTest(undefined)}
                    >
                      変更
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <ResultsPanel 
                results={results}
                isAnalyzing={isAnalyzing}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App