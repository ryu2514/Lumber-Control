import { useState, useRef, useCallback } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

interface BlazePoseLandmark {
  x: number
  y: number
  z: number
  visibility: number
}

interface AnalysisResult {
  frame: number
  timestamp: number
  landmarks: BlazePoseLandmark[]
  worldLandmarks: BlazePoseLandmark[]
  confidence: number
  angles: {
    hipFlexion: number | null
    kneeFlexion: number | null
    ankleFlexion: number | null
    spinalAlignment: number | null
  }
}

export function VideoAnalyzerFileReader() {
  const [isReady, setIsReady] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [videoReady, setVideoReady] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const processingCanvasRef = useRef<HTMLCanvasElement>(null)
  const poseLandmarker = useRef<PoseLandmarker | null>(null)

  const log = (message: string) => {
    const time = new Date().toLocaleTimeString()
    const logMsg = `[${time}] ${message}`
    console.log(logMsg)
    setLogs(prev => [...prev.slice(-30), logMsg])
  }

  // Initialize MediaPipe
  const initializeMediaPipe = async () => {
    try {
      setError(null)
      log('MediaPipe FileReader方式初期化開始')
      
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm'
      )

      poseLandmarker.current = await PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
          delegate: 'GPU'
        },
        runningMode: 'IMAGE',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false
      })

      log('MediaPipe FileReader方式初期化完了')
      setIsReady(true)
    } catch (error) {
      log(`MediaPipe初期化失敗: ${error}`)
      setError(`MediaPipe初期化失敗: ${error}`)
    }
  }

  // Create video from File using FileReader and data URL
  const createVideoFromFile = async (file: File): Promise<HTMLVideoElement> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        log(`FileReader完了: ${dataUrl.substring(0, 50)}...`)
        
        // Create video element
        const video = document.createElement('video')
        video.muted = true
        video.playsInline = true
        video.crossOrigin = 'anonymous'
        
        let resolved = false
        
        const onLoadedMetadata = () => {
          if (resolved) return
          resolved = true
          
          log(`動画メタデータ取得成功: ${video.videoWidth}x${video.videoHeight}, ${video.duration?.toFixed(1)}s`)
          
          // Remove listeners
          video.removeEventListener('loadedmetadata', onLoadedMetadata)
          video.removeEventListener('error', onError)
          
          resolve(video)
        }
        
        const onError = (err: Event) => {
          if (resolved) return
          resolved = true
          
          log(`動画読み込みエラー: ${err}`)
          video.removeEventListener('loadedmetadata', onLoadedMetadata)
          video.removeEventListener('error', onError)
          
          reject(new Error('動画読み込み失敗'))
        }
        
        video.addEventListener('loadedmetadata', onLoadedMetadata)
        video.addEventListener('error', onError)
        
        // Set data URL
        video.src = dataUrl
        log('動画データURL設定完了')
        
        // Timeout fallback
        setTimeout(() => {
          if (!resolved) {
            log('メタデータ読み込みタイムアウト - フォールバック')
            resolved = true
            video.removeEventListener('loadedmetadata', onLoadedMetadata)
            video.removeEventListener('error', onError)
            resolve(video)
          }
        }, 5000)
      }
      
      reader.onerror = () => {
        log('FileReader エラー')
        reject(new Error('FileReader失敗'))
      }
      
      log('FileReader開始')
      reader.readAsDataURL(file)
    })
  }

  // Handle video upload with FileReader approach
  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('video/')) {
      setError('動画ファイルを選択してください')
      return
    }

    log(`動画選択: ${file.name} (${(file.size/1024/1024).toFixed(1)}MB)`)
    setVideoFile(file)
    setResults([])
    setCurrentFrame(0)
    setError(null)
    setLogs([])
    setVideoReady(false)
    
    try {
      // Create video using FileReader
      const video = await createVideoFromFile(file)
      
      // Set to video element for display
      if (videoRef.current) {
        if (videoRef.current.src) {
          URL.revokeObjectURL(videoRef.current.src)
        }
        videoRef.current.src = video.src
        videoRef.current.muted = true
        videoRef.current.playsInline = true
        videoRef.current.controls = true
      }
      
      setVideoReady(true)
      log('FileReader動画準備完了')
    } catch (error) {
      log(`FileReader動画準備失敗: ${error}`)
      setError(`動画準備失敗: ${error}`)
    }
  }

  // Extract frame from video using canvas
  const extractVideoFrame = async (video: HTMLVideoElement, targetTime: number): Promise<ImageData | null> => {
    return new Promise((resolve) => {
      const canvas = processingCanvasRef.current
      if (!canvas) {
        resolve(null)
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }

      let resolved = false

      const captureFrame = () => {
        if (resolved) return
        resolved = true

        try {
          const width = Math.max(video.videoWidth, 640)
          const height = Math.max(video.videoHeight, 480)
          
          canvas.width = width
          canvas.height = height
          
          ctx.drawImage(video, 0, 0, width, height)
          const imageData = ctx.getImageData(0, 0, width, height)
          
          log(`フレーム抽出成功: ${width}x${height}`)
          resolve(imageData)
        } catch (e) {
          log(`フレーム抽出失敗: ${e}`)
          resolve(null)
        }
      }

      // Set video time and capture
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked)
        setTimeout(captureFrame, 200)
      }

      video.addEventListener('seeked', onSeeked, { once: true })
      video.currentTime = targetTime
      
      // Timeout fallback
      setTimeout(() => {
        if (!resolved) {
          log('フレーム抽出タイムアウト')
          captureFrame()
        }
      }, 2000)
    })
  }

  // Angle calculations
  const calculateLumbarAngles = (worldLandmarks: BlazePoseLandmark[]) => {
    const calculateAngle = (p1: BlazePoseLandmark, p2: BlazePoseLandmark, p3: BlazePoseLandmark): number | null => {
      try {
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z }
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z }

        const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z)
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z)

        if (mag1 === 0 || mag2 === 0) return null

        const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)))
        const angle = Math.acos(cosAngle) * (180 / Math.PI)
        return Math.round(angle * 10) / 10
      } catch (error) {
        return null
      }
    }

    if (worldLandmarks.length < 33) {
      return { hipFlexion: null, kneeFlexion: null, ankleFlexion: null, spinalAlignment: null }
    }

    const leftShoulder = worldLandmarks[11]
    const leftHip = worldLandmarks[23]
    const leftKnee = worldLandmarks[25]
    const leftAnkle = worldLandmarks[27]
    const leftToe = worldLandmarks[31]

    return {
      hipFlexion: calculateAngle(leftShoulder, leftHip, leftKnee),
      kneeFlexion: calculateAngle(leftHip, leftKnee, leftAnkle),
      ankleFlexion: calculateAngle(leftKnee, leftAnkle, leftToe),
      spinalAlignment: leftShoulder && leftHip ? 
        Math.abs(leftShoulder.x - leftHip.x) * 180 / Math.PI : null
    }
  }

  // Draw pose visualization
  const drawBlazePose = (landmarks: BlazePoseLandmark[], angles: any, confidence: number) => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = Math.max(videoRef.current.videoWidth, 640)
    canvas.height = Math.max(videoRef.current.videoHeight, 480)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!landmarks || landmarks.length === 0) return

    // Draw landmarks with color coding
    landmarks.forEach((landmark, index) => {
      if (landmark.visibility > 0.01) {
        const x = landmark.x * canvas.width
        const y = landmark.y * canvas.height
        
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, 2 * Math.PI)
        
        // Body part color coding
        if ([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(index)) {
          ctx.fillStyle = '#FF0000' // Face
        } else if ([11, 12, 13, 14, 15, 16].includes(index)) {
          ctx.fillStyle = '#00FF00' // Arms
        } else if ([17, 18, 19, 20, 21, 22].includes(index)) {
          ctx.fillStyle = '#0000FF' // Hands
        } else if ([23, 24].includes(index)) {
          ctx.fillStyle = '#FFD700' // Hips
        } else if ([25, 26, 27, 28].includes(index)) {
          ctx.fillStyle = '#FF69B4' // Legs
        } else {
          ctx.fillStyle = '#00FFFF' // Feet
        }
        
        ctx.fill()
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })

    // Draw key connections
    const connections = [
      [11, 12], [11, 13], [12, 14], [13, 15], [14, 16],
      [11, 23], [12, 24], [23, 24],
      [23, 25], [24, 26], [25, 27], [26, 28],
      [27, 29], [28, 30], [29, 31], [30, 32]
    ]

    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start]
      const endPoint = landmarks[end]
      
      if (startPoint?.visibility > 0.01 && endPoint?.visibility > 0.01) {
        ctx.beginPath()
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height)
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height)
        ctx.strokeStyle = '#00FF00'
        ctx.lineWidth = 3
        ctx.stroke()
      }
    })

    // Draw analysis info
    ctx.font = 'bold 18px Arial'
    ctx.fillStyle = '#FFFF00'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    
    let yPos = 35
    if (angles.hipFlexion !== null) {
      const text = `股関節屈曲: ${angles.hipFlexion}°`
      ctx.strokeText(text, 15, yPos)
      ctx.fillText(text, 15, yPos)
      yPos += 25
    }
    if (angles.kneeFlexion !== null) {
      const text = `膝関節屈曲: ${angles.kneeFlexion}°`
      ctx.strokeText(text, 15, yPos)
      ctx.fillText(text, 15, yPos)
      yPos += 25
    }
    if (angles.ankleFlexion !== null) {
      const text = `足関節背屈: ${angles.ankleFlexion}°`
      ctx.strokeText(text, 15, yPos)
      ctx.fillText(text, 15, yPos)
      yPos += 25
    }
    
    const confText = `検出精度: ${(confidence * 100).toFixed(0)}%`
    ctx.strokeText(confText, 15, yPos)
    ctx.fillText(confText, 15, yPos)
  }

  const drawCurrentFrame = useCallback(() => {
    if (results.length > 0 && results[currentFrame]) {
      const result = results[currentFrame]
      drawBlazePose(result.landmarks, result.angles, result.confidence)
    }
  }, [results, currentFrame])

  // FILEREADER-BASED ANALYSIS
  const analyzeVideo = async () => {
    if (!poseLandmarker.current || !videoFile || !videoReady) {
      setError('準備が完了していません')
      return
    }

    setIsAnalyzing(true)
    setResults([])
    setError(null)
    log('FileReader腰椎モーターコントロール解析開始')
    
    try {
      // Create video from file data
      const video = await createVideoFromFile(videoFile)
      
      // Get video duration (with fallback)
      const duration = video.duration && !isNaN(video.duration) ? video.duration : 10
      log(`解析対象: ${duration.toFixed(1)}秒, ${video.videoWidth}x${video.videoHeight}`)
      
      const frameCount = 5
      const analysisResults: AnalysisResult[] = []

      for (let i = 0; i < frameCount; i++) {
        const time = (i / (frameCount - 1)) * Math.min(duration, 15)
        
        log(`フレーム ${i + 1}/${frameCount}: ${time.toFixed(1)}s`)
        
        try {
          // Extract frame from video
          const imageData = await extractVideoFrame(video, time)
          
          if (!imageData) {
            log(`フレーム ${i + 1}: 画像抽出失敗`)
            continue
          }

          // Create canvas for MediaPipe
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = imageData.width
          tempCanvas.height = imageData.height
          const tempCtx = tempCanvas.getContext('2d')!
          tempCtx.putImageData(imageData, 0, 0)
          
          log(`フレーム ${i + 1}: MediaPipe解析実行`)
          const result = poseLandmarker.current.detect(tempCanvas)
          
          const landmarks: BlazePoseLandmark[] = result.landmarks[0] || []
          const worldLandmarks: BlazePoseLandmark[] = result.worldLandmarks[0] || []
          
          if (landmarks.length > 0) {
            const confidence = landmarks.reduce((sum, lm) => sum + (lm.visibility || 0), 0) / landmarks.length
            const angles = calculateLumbarAngles(worldLandmarks)

            analysisResults.push({
              frame: i,
              timestamp: time,
              landmarks,
              worldLandmarks,
              angles,
              confidence
            })

            log(`フレーム ${i + 1}: 成功 - ${landmarks.length}点検出, 股関節=${angles.hipFlexion}°`)
          } else {
            log(`フレーム ${i + 1}: ポーズ検出なし`)
          }

          setAnalysisProgress((i + 1) / frameCount * 100)
          
        } catch (error) {
          log(`フレーム ${i + 1} エラー: ${error}`)
        }
      }

      setResults(analysisResults)
      setCurrentFrame(0)
      log(`FileReader解析完了: ${analysisResults.length}フレーム`)
      
      if (analysisResults.length > 0) {
        setTimeout(drawCurrentFrame, 300)
      } else {
        setError('FileReader方式でもポーズ検出できませんでした')
      }
    } catch (error) {
      log(`FileReader解析失敗: ${error}`)
      setError(`FileReader解析失敗: ${error}`)
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
        <h1 className="text-3xl font-bold mb-2">FileReader動画解析システム</h1>
        <p className="text-gray-600">ブラウザ制限完全回避・FileReaderデータURL方式</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-medium">⚠️ {error}</div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <h3 className="font-medium mb-2">🔍 FileReader解析ログ</h3>
          <div className="bg-black text-green-400 p-3 rounded text-sm font-mono max-h-40 overflow-y-auto">
            {logs.map((log, index) => (
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
            🚀 FileReader MediaPipe初期化
          </button>
        </div>
      )}

      {/* Video Upload */}
      {isReady && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">📁 動画アップロード (FileReader方式)</h2>
          <input
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          
          {videoFile && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm space-y-2">
                <div>📁 {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)</div>
                
                {!videoReady ? (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <div className="text-blue-800 font-medium text-sm">
                      🔄 FileReader動画準備中...
                    </div>
                    <div className="text-blue-700 text-xs mt-1">
                      FileReaderでデータURL作成中
                    </div>
                  </div>
                ) : (
                  <div className="text-green-600">
                    ✅ FileReader準備完了 - ブラウザ制限回避済み
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Analysis */}
      {videoFile && videoReady && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">🎥 FileReader腰椎モーターコントロール解析</h2>
          
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

          <canvas ref={processingCanvasRef} style={{ display: 'none' }} />

          <div className="space-y-4">
            <button
              onClick={analyzeVideo}
              disabled={isAnalyzing}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-lg"
            >
              {isAnalyzing ? `🔄 FileReader解析中... ${analysisProgress.toFixed(0)}%` : 
               '🔍 FileReader腰椎モーターコントロール解析開始'}
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
                    <div className="text-sm text-gray-600 mt-1 grid grid-cols-2 gap-2">
                      <div>股関節: {results[currentFrame].angles.hipFlexion || 'N/A'}°</div>
                      <div>膝関節: {results[currentFrame].angles.kneeFlexion || 'N/A'}°</div>
                      <div>足関節: {results[currentFrame].angles.ankleFlexion || 'N/A'}°</div>
                      <div>精度: {(results[currentFrame].confidence * 100).toFixed(0)}%</div>
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
          <h2 className="text-lg font-semibold mb-4">📊 FileReader解析結果</h2>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{results.length}</div>
              <div className="text-sm text-blue-600">解析フレーム数</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {(results.reduce((sum, r) => sum + (r.angles.hipFlexion || 0), 0) / results.length).toFixed(1)}°
              </div>
              <div className="text-sm text-green-600">平均股関節屈曲</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {(results.reduce((sum, r) => sum + (r.angles.kneeFlexion || 0), 0) / results.length).toFixed(1)}°
              </div>
              <div className="text-sm text-purple-600">平均膝関節屈曲</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {(results.reduce((sum, r) => sum + r.confidence, 0) / results.length * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-orange-600">平均検出精度</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}