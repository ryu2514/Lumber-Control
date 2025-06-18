import { useEffect, useRef } from 'react'
import { PoseAnalysisResult } from '@/lib/mediapipe/types'

interface PoseCanvasProps {
  poseResult: PoseAnalysisResult | null
  videoElement: HTMLVideoElement | null
}

export function PoseCanvas({ poseResult, videoElement }: PoseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !videoElement || !poseResult) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Canvas size to match video
    canvas.width = videoElement.videoWidth || 640
    canvas.height = videoElement.videoHeight || 480

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw pose landmarks
    const landmarks = poseResult.landmarks.landmarks[0]
    if (landmarks && landmarks.length > 0) {
      drawLandmarks(ctx, landmarks, canvas.width, canvas.height)
      drawConnections(ctx, landmarks, canvas.width, canvas.height)
    }
  }, [poseResult, videoElement])

  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    width: number,
    height: number
  ) => {
    landmarks.forEach((landmark, index) => {
      if (landmark.visibility > 0.5) {
        const x = landmark.x * width
        const y = landmark.y * height

        ctx.beginPath()
        ctx.arc(x, y, 5, 0, 2 * Math.PI)
        ctx.fillStyle = getJointColor(index)
        ctx.fill()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })
  }

  const drawConnections = (
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    width: number,
    height: number
  ) => {
    const connections = [
      // Torso
      [11, 12], [11, 23], [12, 24], [23, 24],
      // Left arm
      [11, 13], [13, 15],
      // Right arm
      [12, 14], [14, 16],
      // Left leg
      [23, 25], [25, 27],
      // Right leg
      [24, 26], [26, 28]
    ]

    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start]
      const endPoint = landmarks[end]

      if (startPoint?.visibility > 0.5 && endPoint?.visibility > 0.5) {
        ctx.beginPath()
        ctx.moveTo(startPoint.x * width, startPoint.y * height)
        ctx.lineTo(endPoint.x * width, endPoint.y * height)
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'
        ctx.lineWidth = 3
        ctx.stroke()
      }
    })
  }

  const getJointColor = (index: number): string => {
    const colors = {
      // Core joints (red)
      23: '#FF0000', 24: '#FF0000', // Hips
      11: '#FF4444', 12: '#FF4444', // Shoulders
      // Knees (blue)
      25: '#0000FF', 26: '#0000FF',
      // Ankles (green)
      27: '#00FF00', 28: '#00FF00',
      // Default (yellow)
    }
    return colors[index as keyof typeof colors] || '#FFFF00'
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
    />
  )
}