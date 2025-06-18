import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface CameraViewProps {
  onVideoReady: (video: HTMLVideoElement) => void
  isRecording: boolean
  onStartRecording: () => void
  onStopRecording: () => void
}

export function CameraView({ 
  onVideoReady, 
  isRecording, 
  onStartRecording, 
  onStopRecording 
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initializeCamera = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          setIsInitialized(true)
          onVideoReady(videoRef.current!)
        }
      }
    } catch (err) {
      setError('カメラへのアクセスに失敗しました。ブラウザの権限設定を確認してください。')
      console.error('Camera initialization error:', err)
    }
  }

  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>カメラ映像</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          {!isInitialized && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <p className="text-gray-600 mb-4">カメラを起動してください</p>
                <Button onClick={initializeCamera}>
                  カメラを開始
                </Button>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50">
              <div className="text-center p-4">
                <p className="text-red-600 text-sm">{error}</p>
                <Button onClick={initializeCamera} variant="outline" className="mt-2">
                  再試行
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {isInitialized && (
          <div className="flex gap-2">
            <Button
              onClick={isRecording ? onStopRecording : onStartRecording}
              variant={isRecording ? "destructive" : "default"}
              className="flex-1"
            >
              {isRecording ? '録画停止' : '録画開始'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}