// Pose landmarks overlay component
import React, { useEffect, useRef } from 'react';
import { Landmark } from '../../types';

// MediaPipe Pose connections (pairs of landmark indices that should be connected)
const POSE_CONNECTIONS = [
  // Torso
  [11, 12], [12, 24], [24, 23], [23, 11],
  // Right arm
  [12, 14], [14, 16],
  // Left arm
  [11, 13], [13, 15],
  // Right leg
  [24, 26], [26, 28],
  // Left leg
  [23, 25], [25, 27],
  // Shoulders to ears
  [11, 9], [12, 10]
];

interface PoseOverlayProps {
  landmarks?: Landmark[];
  videoWidth: number;
  videoHeight: number;
}

export const PoseOverlay: React.FC<PoseOverlayProps> = ({
  landmarks,
  videoWidth,
  videoHeight
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !landmarks || landmarks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw connections
    ctx.strokeStyle = 'rgb(0, 255, 0)';
    ctx.lineWidth = 2;

    POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const startPoint = landmarks[startIdx];
      const endPoint = landmarks[endIdx];
      
      if (startPoint && endPoint && 
          startPoint.visibility && endPoint.visibility && 
          startPoint.visibility > 0.5 && endPoint.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
        ctx.stroke();
      }
    });

    // Draw landmarks
    landmarks.forEach((landmark) => {
      if (landmark.visibility && landmark.visibility > 0.5) {
        ctx.fillStyle = 'rgb(255, 0, 0)';
        ctx.beginPath();
        ctx.arc(
          landmark.x * canvas.width,
          landmark.y * canvas.height,
          4,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
    });
  }, [landmarks, videoWidth, videoHeight]);

  return (
    <canvas
      ref={canvasRef}
      className="pose-overlay"
      width={videoWidth}
      height={videoHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        transform: 'rotateY(180deg)'
      }}
    />
  );
};
