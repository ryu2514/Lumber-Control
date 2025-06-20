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

export function VideoAnalyzerUltimate() {
  const [isReady, setIsReady] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [debugLog, setDebugLog] = useState<string[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const poseLandmarker = useRef<PoseLandmarker | null>(null)

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `[${timestamp}] ${message}`
    console.log(logMessage)
    setDebugLog(prev => [...prev.slice(-15), logMessage]) // Keep last 15 logs
  }

  // Initialize MediaPipe
  const initializeMediaPipe = async () => {
    try {
      setError(null)
      setStatus('MediaPipe初期化中...')
      
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

      setStatus('MediaPipe初期化完了')
      setIsReady(true)
    } catch (error) {
      setError(`MediaPipe初期化失敗: ${error}`)
      setStatus('初期化失敗')
    }
  }

  // Handle video upload with debug logging
  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('video/')) {
      setError('動画ファイルを選択してください')
      addDebugLog('ファイル選択エラー: 動画ファイルではない')
      return
    }

    setStatus(`動画ファイル選択: ${file.name}`)
    addDebugLog(`動画ファイル選択: ${file.name}, タイプ: ${file.type}, サイズ: ${(file.size/1024/1024).toFixed(1)}MB`)
    setVideoFile(file)
    setResults([])
    setCurrentFrame(0)
    setError(null)
    setDebugLog([]) // Clear previous logs
    
    if (videoRef.current) {
      // Clean up previous URL
      if (videoRef.current.src) {
        URL.revokeObjectURL(videoRef.current.src)
        addDebugLog('前回の動画URLをクリーンアップ')
      }
      
      const url = URL.createObjectURL(file)
      videoRef.current.src = url
      addDebugLog(`ObjectURL作成: ${url.substring(0, 50)}...`)
      
      // Set basic properties
      videoRef.current.muted = true
      videoRef.current.playsInline = true
      videoRef.current.controls = false
      videoRef.current.preload = 'auto'
      
      // Add event listeners for debugging
      videoRef.current.onloadstart = () => addDebugLog('動画読み込み開始')
      videoRef.current.onloadedmetadata = () => {
        const v = videoRef.current!
        addDebugLog(`メタデータ読み込み完了: ${v.videoWidth}x${v.videoHeight}, ${v.duration?.toFixed(1)}s`)
      }
      videoRef.current.oncanplay = () => addDebugLog('動画再生準備完了')
      videoRef.current.onerror = (e) => addDebugLog(`動画エラー: ${e}`)
      
      setStatus('動画ファイル準備完了 - 解析可能')
      addDebugLog('動画ファイル準備完了')
    }
  }

  // Calculate hip angle
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

    // Draw key landmarks
    const keyPoints = [11, 12, 23, 24, 25, 26, 27, 28]
    keyPoints.forEach(index => {
      const landmark = landmarks[index]
      if (landmark && landmark.visibility > 0.3) {
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
      
      if (startPoint?.visibility > 0.3 && endPoint?.visibility > 0.3) {
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
    if (angles.hip !== null) {
      const text = `膝角度: ${angles.hip}°`
      ctx.strokeText(text, 30, yPos)
      ctx.fillText(text, 30, yPos)
      yPos += 40
    }
    
    const confText = `信頼度: ${(confidence * 100).toFixed(0)}%`
    ctx.strokeText(confText, 30, yPos)
    ctx.fillText(confText, 30, yPos)
    
    const frameText = `${currentFrame + 1}/${results.length}`
    ctx.strokeText(frameText, canvas.width - 150, 50)
    ctx.fillText(frameText, canvas.width - 150, 50)
  }

  const drawCurrentFrame = useCallback(() => {
    if (results.length > 0 && results[currentFrame]) {
      const result = results[currentFrame]
      drawPoseOverlay(result.landmarks, result.angles, result.confidence)
    }
  }, [results, currentFrame])

  // DETAILED DEBUG ANALYSIS
  const analyzeVideo = async () => {
    if (!poseLandmarker.current || !videoRef.current || !videoFile) {
      setError('準備が完了していません')
      addDebugLog('分析失敗: 必要な要素が不足')
      return
    }

    setIsAnalyzing(true)
    setResults([])
    setError(null)
    setDebugLog([]) // Clear previous logs
    setStatus('動画検証と解析開始...')
    addDebugLog('解析開始')
    
    try {
      const video = videoRef.current
      addDebugLog(`動画ファイル: ${videoFile.name}, サイズ: ${(videoFile.size/1024/1024).toFixed(1)}MB`)
      
      // FORCE VIDEO LOADING FIRST
      setStatus('動画強制読み込み中...')
      addDebugLog('動画強制読み込み開始')
      
      // Ensure video is loaded by trying to play it briefly
      video.muted = true
      video.playsInline = true
      try {
        addDebugLog('動画再生テスト開始')
        await video.play()
        addDebugLog('動画再生成功')
        video.pause()
        addDebugLog('動画一時停止')
        video.currentTime = 0
        await new Promise(resolve => setTimeout(resolve, 1000))
        addDebugLog('動画再生テスト完了')
      } catch (playError) {
        addDebugLog(`動画再生テスト失敗: ${playError}`)
        setStatus('動画再生テスト失敗 - 続行します')
      }
      
      // Check video state
      addDebugLog(`動画状態: readyState=${video.readyState}, networkState=${video.networkState}`)
      
      // Wait for video dimensions to be available
      let attempts = 0
      while ((video.videoWidth === 0 || video.videoHeight === 0) && attempts < 15) {
        setStatus(`動画次元待機中... 試行${attempts + 1}/15`)
        addDebugLog(`次元チェック ${attempts + 1}: ${video.videoWidth}x${video.videoHeight}`)
        await new Promise(resolve => setTimeout(resolve, 500))
        attempts++
        
        // Try to force metadata loading
        if (attempts % 5 === 0) {
          try {
            video.load()
            addDebugLog(`強制リロード実行 (試行${attempts})`)
          } catch (e) {
            addDebugLog(`強制リロード失敗: ${e}`)
          }
        }
      }
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        const errorMsg = `動画の次元を取得できません: ${video.videoWidth}x${video.videoHeight}`
        setError(errorMsg)
        addDebugLog(errorMsg)
        return
      }
      
      const dimensions = `${video.videoWidth}x${video.videoHeight}`
      setStatus(`動画次元確認: ${dimensions}`)
      addDebugLog(`動画次元確認: ${dimensions}`)
      
      // Determine duration - use actual or estimate
      let duration = video.duration
      if (!duration || isNaN(duration) || duration <= 0) {
        duration = 10 // Fallback to 10 seconds
        setStatus('動画長さ不明 - 10秒と仮定')
        addDebugLog('動画長さ不明 - 10秒と仮定')
      } else {
        setStatus(`動画長さ確認: ${duration.toFixed(1)}秒`)
        addDebugLog(`動画長さ確認: ${duration.toFixed(1)}秒`)
      }
      
      const frameCount = 5 // Further reduced for debugging
      const analysisResults: AnalysisResult[] = []
      addDebugLog(`解析予定フレーム数: ${frameCount}`)

      for (let i = 0; i < frameCount; i++) {
        const time = (i / (frameCount - 1)) * Math.min(duration, 20) // Cap at 20s
        
        setStatus(`フレーム ${i + 1}/${frameCount} 解析中 (${time.toFixed(1)}s)`)
        addDebugLog(`フレーム ${i + 1} 開始: 時間=${time.toFixed(1)}s`)
        
        try {
          // Set video time
          addDebugLog(`フレーム ${i + 1}: 時間設定 ${time.toFixed(1)}s`)
          video.currentTime = time
          
          // Wait for seek completion with timeout
          await new Promise<void>((resolve) => {
            let resolved = false
            const timeout = setTimeout(() => {
              if (!resolved) {
                addDebugLog(`フレーム ${i + 1}: シークタイムアウト`)
                resolved = true
                resolve()
              }
            }, 3000)
            
            const onSeeked = () => {
              if (!resolved) {
                clearTimeout(timeout)
                video.removeEventListener('seeked', onSeeked)
                addDebugLog(`フレーム ${i + 1}: シーク完了`)
                resolved = true
                resolve()
              }
            }
            
            video.addEventListener('seeked', onSeeked, { once: true })
            
            // If already at correct time
            if (Math.abs(video.currentTime - time) < 0.1) {
              if (!resolved) {
                clearTimeout(timeout)
                addDebugLog(`フレーム ${i + 1}: 既に正しい時間位置`)
                resolved = true
                resolve()
              }
            }
          })
          
          // Additional wait for frame to be ready
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // Check video state before analysis
          addDebugLog(`フレーム ${i + 1}: 分析前チェック - 次元=${video.videoWidth}x${video.videoHeight}, currentTime=${video.currentTime.toFixed(2)}`)
          
          // Double-check video dimensions before analysis
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            addDebugLog(`フレーム ${i + 1}: 動画次元エラー - スキップ`)
            continue
          }
          
          // Analyze frame
          addDebugLog(`フレーム ${i + 1}: MediaPipe解析実行`)
          const result = poseLandmarker.current.detectForVideo(video, time * 1000)
          addDebugLog(`フレーム ${i + 1}: MediaPipe解析完了`)
          
          const landmarks = result.landmarks[0] || []
          const worldLandmarks = result.worldLandmarks[0] || []
          addDebugLog(`フレーム ${i + 1}: ランドマーク=${landmarks.length}, ワールド=${worldLandmarks.length}`)
          
          const confidence = landmarks.length > 0 
            ? landmarks.reduce((sum: number, lm: any) => sum + (lm.visibility || 0), 0) / landmarks.length
            : 0
            
          const hipAngle = calculateHipAngle(worldLandmarks)
          addDebugLog(`フレーム ${i + 1}: 信頼度=${(confidence*100).toFixed(1)}%, 角度=${hipAngle || 'N/A'}`)

          analysisResults.push({
            frame: i,
            timestamp: time,
            landmarks,
            worldLandmarks,
            angles: { hip: hipAngle },
            confidence
          })

          setAnalysisProgress((i + 1) / frameCount * 100)
          addDebugLog(`フレーム ${i + 1}: 完了 (進捗: ${((i + 1) / frameCount * 100).toFixed(1)}%)`)
          
        } catch (error) {
          const errorMsg = `フレーム ${i + 1} エラー: ${error}`
          setStatus(errorMsg + ' - 続行')
          addDebugLog(errorMsg)
          console.error(`Frame ${i} analysis error:`, error)
        }
      }

      setResults(analysisResults)
      setCurrentFrame(0)
      const completionMsg = `解析完了: ${analysisResults.length}フレーム取得`
      setStatus(completionMsg)
      addDebugLog(completionMsg)
      
      if (analysisResults.length > 0) {
        video.currentTime = 0
        setTimeout(drawCurrentFrame, 300)
        addDebugLog('結果描画開始')
      } else {
        const errorMsg = '姿勢検出できませんでした - 動画形式を確認してください'
        setError(errorMsg)
        addDebugLog(errorMsg)
      }
    } catch (error) {
      const errorMsg = `解析失敗: ${error}`
      setError(errorMsg)
      setStatus('解析失敗')
      addDebugLog(errorMsg)
      console.error('Analysis error:', error)
    } finally {
      setIsAnalyzing(false)
      addDebugLog('解析処理終了')
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
        <h1 className="text-3xl font-bold mb-2">動画姿勢解析ツール（究極版）</h1>
        <p className="text-gray-600">メタデータ完全バイパス・強制解析モード</p>
      </div>

      {/* Status */}
      {status && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-blue-800">ℹ️ {status}</div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-medium">⚠️ {error}</div>
        </div>
      )}

      {/* Debug Log */}
      {debugLog.length > 0 && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <h3 className="font-medium mb-2">🔍 デバッグログ</h3>
          <div className="bg-black text-green-400 p-3 rounded text-xs font-mono max-h-48 overflow-y-auto">
            {debugLog.map((log, index) => (
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
              <div className="text-sm space-y-1">
                <div>📁 {videoFile.name}</div>
                <div>📏 {(videoFile.size / 1024 / 1024).toFixed(1)} MB</div>
                <div className="text-green-600">✅ メタデータ不要モード - 即座に解析可能</div>
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
              {isAnalyzing ? `🔄 解析中... ${analysisProgress.toFixed(0)}%` : '🔍 強制解析開始 (8フレーム・メタデータ不要)'}
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
                        <span>膝角度: {results[currentFrame].angles.hip}° | </span>
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
                {(results.reduce((sum, r) => sum + (r.angles.hip || 0), 0) / results.length).toFixed(1)}°
              </div>
              <div className="text-sm text-green-600">平均膝角度</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(results.filter(r => r.landmarks.length > 0).length / results.length * 100)}%
              </div>
              <div className="text-sm text-purple-600">姿勢検出率</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}