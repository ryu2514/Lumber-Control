import { useState, useRef, useCallback } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

interface AnalysisResult {
  frame: number
  timestamp: number
  landmarks: any[]
  confidence: number
  angles: {
    hipFlexion: number | null
    kneeFlexion: number | null
  }
}

export function VideoAnalyzerMinimal() {
  const [isReady, setIsReady] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [userPlayedVideo, setUserPlayedVideo] = useState(false)

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
    setUserPlayedVideo(false)
    
    if (videoRef.current) {
      if (videoRef.current.src) {
        URL.revokeObjectURL(videoRef.current.src)
      }
      
      const url = URL.createObjectURL(file)
      videoRef.current.src = url
      videoRef.current.muted = true
      videoRef.current.playsInline = true
      
      // Set up multiple event listeners for play detection
      const video = videoRef.current
      
      const handlePlay = () => {
        console.log('動画再生イベント検出')
        setUserPlayedVideo(true)
        setError(null)
      }
      
      const handleTimeUpdate = () => {
        console.log('動画時間更新イベント検出')
        setUserPlayedVideo(true)
        setError(null)
      }
      
      // Multiple event listeners to catch any user interaction
      video.addEventListener('play', handlePlay)
      video.addEventListener('playing', handlePlay)
      video.addEventListener('timeupdate', handleTimeUpdate)
      video.addEventListener('loadeddata', () => {
        console.log('動画データ読み込み完了')
      })
      video.addEventListener('canplay', () => {
        console.log('動画再生可能状態')
      })
    }
  }

  // Simple angle calculation
  const calculateAngles = (landmarks: any[]) => {
    const calculateAngle = (p1: any, p2: any, p3: any): number | null => {
      try {
        if (!p1 || !p2 || !p3) return null
        
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y }
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y }

        const dot = v1.x * v2.x + v1.y * v2.y
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)

        if (mag1 === 0 || mag2 === 0) return null

        const cosAngle = dot / (mag1 * mag2)
        const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI)
        return Math.round(angle * 10) / 10
      } catch (error) {
        return null
      }
    }

    if (landmarks.length < 29) return { hipFlexion: null, kneeFlexion: null }

    return {
      hipFlexion: calculateAngle(landmarks[11], landmarks[23], landmarks[25]), // shoulder -> hip -> knee  
      kneeFlexion: calculateAngle(landmarks[23], landmarks[25], landmarks[27])  // hip -> knee -> ankle
    }
  }

  // Draw pose
  const drawPose = (landmarks: any[], angles: any, confidence: number) => {
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
      if (landmark && landmark.visibility > 0.5) {
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
      
      if (startPoint?.visibility > 0.5 && endPoint?.visibility > 0.5) {
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
    if (angles.hipFlexion !== null) {
      const text = `股関節: ${angles.hipFlexion}°`
      ctx.strokeText(text, 30, yPos)
      ctx.fillText(text, 30, yPos)
      yPos += 40
    }
    if (angles.kneeFlexion !== null) {
      const text = `膝関節: ${angles.kneeFlexion}°`
      ctx.strokeText(text, 30, yPos)
      ctx.fillText(text, 30, yPos)
      yPos += 40
    }
    
    const confText = `信頼度: ${(confidence * 100).toFixed(0)}%`
    ctx.strokeText(confText, 30, yPos)
    ctx.fillText(confText, 30, yPos)
  }

  const drawCurrentFrame = useCallback(() => {
    if (results.length > 0 && results[currentFrame]) {
      const result = results[currentFrame]
      drawPose(result.landmarks, result.angles, result.confidence)
    }
  }, [results, currentFrame])

  // ANALYSIS WITH AGGRESSIVE VIDEO LOADING
  const analyzeVideo = async () => {
    if (!poseLandmarker.current || !videoRef.current || !videoFile) {
      setError('準備が完了していません')
      return
    }

    setIsAnalyzing(true)
    setResults([])
    setError(null)
    console.log('解析開始')
    
    try {
      const video = videoRef.current
      
      console.log(`初期動画状態: ${video.videoWidth}x${video.videoHeight}, duration=${video.duration}`)
      
      // FORCE VIDEO LOADING IF NEEDED
      if (video.videoWidth === 0 || isNaN(video.duration)) {
        console.log('動画強制読み込み開始...')
        
        // Try multiple loading strategies
        const loadAttempts = [
          () => video.load(),
          () => {
            video.muted = true
            return video.play().then(() => {
              video.pause()
              video.currentTime = 0
            }).catch(() => {})
          },
          () => {
            video.currentTime = 0.1
            return new Promise(resolve => setTimeout(resolve, 500))
          }
        ]
        
        for (let attempt = 0; attempt < loadAttempts.length; attempt++) {
          console.log(`読み込み試行 ${attempt + 1}/${loadAttempts.length}`)
          
          try {
            await loadAttempts[attempt]()
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            console.log(`試行後: ${video.videoWidth}x${video.videoHeight}, duration=${video.duration}`)
            
            if (video.videoWidth > 0 && !isNaN(video.duration)) {
              console.log('動画読み込み成功!')
              break
            }
          } catch (e) {
            console.log(`試行 ${attempt + 1} 失敗:`, e)
          }
          
          // Last attempt - wait longer
          if (attempt === loadAttempts.length - 1) {
            console.log('最終待機...')
            await new Promise(resolve => setTimeout(resolve, 3000))
          }
        }
      }
      
      // Final check
      console.log(`最終動画状態: ${video.videoWidth}x${video.videoHeight}, duration=${video.duration}`)
      
      if (video.videoWidth === 0) {
        setError('動画の読み込みに失敗しました。ブラウザで動画を手動で再生してから再試行してください。')
        return
      }

      // Use actual duration or fallback
      let duration = video.duration
      if (isNaN(duration) || duration <= 0) {
        duration = 10
        console.log('動画長さ不明 - 10秒と仮定')
      }
      
      const frameCount = 3
      const analysisResults: AnalysisResult[] = []

      for (let i = 0; i < frameCount; i++) {
        const time = (i / (frameCount - 1)) * Math.min(duration, 10)
        
        console.log(`フレーム ${i + 1}/${frameCount}: ${time.toFixed(1)}秒`)
        
        try {
          // Seek with retry
          video.currentTime = time
          
          // Wait for seek to complete
          await new Promise<void>((resolve) => {
            let resolved = false
            const timeout = setTimeout(() => {
              if (!resolved) {
                console.log(`フレーム ${i + 1}: シークタイムアウト`)
                resolved = true
                resolve()
              }
            }, 3000)
            
            const onSeeked = () => {
              if (!resolved) {
                clearTimeout(timeout)
                video.removeEventListener('seeked', onSeeked)
                console.log(`フレーム ${i + 1}: シーク完了`)
                resolved = true
                resolve()
              }
            }
            
            video.addEventListener('seeked', onSeeked, { once: true })
            
            // If already at correct time
            if (Math.abs(video.currentTime - time) < 0.1) {
              if (!resolved) {
                clearTimeout(timeout)
                console.log(`フレーム ${i + 1}: 既に正しい時間位置`)
                resolved = true
                resolve()
              }
            }
          })
          
          // Additional wait for stability
          await new Promise(resolve => setTimeout(resolve, 500))
          
          console.log(`フレーム ${i + 1}: MediaPipe解析実行 (${video.videoWidth}x${video.videoHeight})`)
          
          // Check video state before analysis
          if (video.videoWidth === 0) {
            console.warn(`フレーム ${i + 1}: 動画次元エラー`)
            continue
          }
          
          // MediaPipe analysis
          const result = poseLandmarker.current.detectForVideo(video, time * 1000)
          
          const landmarks = result.landmarks[0] || []
          
          if (landmarks.length > 0) {
            const confidence = landmarks.reduce((sum: number, lm: any) => sum + (lm.visibility || 0), 0) / landmarks.length
            const angles = calculateAngles(landmarks)

            analysisResults.push({
              frame: i,
              timestamp: time,
              landmarks,
              angles,
              confidence
            })

            console.log(`フレーム ${i + 1}: 完了, 股関節=${angles.hipFlexion}°, 膝=${angles.kneeFlexion}°`)
          } else {
            console.log(`フレーム ${i + 1}: ランドマーク検出なし`)
          }

          setAnalysisProgress((i + 1) / frameCount * 100)
          
        } catch (error) {
          console.error(`フレーム ${i + 1} エラー:`, error)
        }
      }

      setResults(analysisResults)
      setCurrentFrame(0)
      console.log(`解析完了: ${analysisResults.length}フレーム`)
      
      if (analysisResults.length > 0) {
        video.currentTime = 0
        setTimeout(drawCurrentFrame, 500)
      } else {
        setError('姿勢検出できませんでした。動画形式を確認するか、別の動画で試してください。')
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
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">シンプル動画姿勢解析</h1>
        <p className="text-gray-600">手動再生による確実な動画解析</p>
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
              </div>
              
              {!userPlayedVideo && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-yellow-800 font-medium text-sm">
                    ⚠️ 重要: 下の動画を一度手動で再生してください
                  </div>
                  <div className="text-yellow-700 text-xs mt-1">
                    動画を再生することで、ブラウザが動画データを正しく読み込みます
                  </div>
                  <button
                    onClick={() => {
                      console.log('手動で動画再生状態を強制設定')
                      setUserPlayedVideo(true)
                      setError(null)
                    }}
                    className="mt-2 px-3 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
                  >
                    🚀 強制的に解析を有効化
                  </button>
                </div>
              )}
              
              {userPlayedVideo && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-green-800 font-medium text-sm">
                    ✅ 動画再生確認済み - 解析可能
                  </div>
                </div>
              )}
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
              controls={true}
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
              {isAnalyzing ? `🔄 解析中... ${analysisProgress.toFixed(0)}%` : 
               '🔍 解析開始 (3フレーム)'}
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
          <h2 className="text-lg font-semibold mb-4">📊 解析結果</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
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
                {results.length > 0 ? (results.reduce((sum, r) => sum + r.confidence, 0) / results.length * 100).toFixed(1) : 0}%
              </div>
              <div className="text-sm text-purple-600">平均信頼度</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}