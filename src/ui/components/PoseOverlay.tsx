// src/ui/components/PoseOverlay.tsx (修正版)

import React, { useEffect, useRef } from 'react';
import { Landmark } from '../../types';

interface PoseOverlayProps {
  landmarks: Landmark[];
  videoWidth: number;
  videoHeight: number;
  isMirrored?: boolean;
}

// React.memoでコンポーネントを囲みます
export const PoseOverlay: React.FC<PoseOverlayProps> = React.memo(({
  landmarks,
  videoWidth,
  videoHeight,
  isMirrored = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 独自の描画関数（MediaPipeの描画ユーティリティの代替）
  const drawConnectors = (
    ctx: CanvasRenderingContext2D,
    landmarks: Landmark[],
    connections: number[][],
    options: { color: string; lineWidth: number }
  ) => {
    ctx.strokeStyle = options.color;
    ctx.lineWidth = options.lineWidth;

    connections.forEach(([startIdx, endIdx]) => {
      const startLandmark = landmarks[startIdx];
      const endLandmark = landmarks[endIdx];

      if (startLandmark?.visibility > 0.5 && endLandmark?.visibility > 0.5) {
        const startX = startLandmark.x * videoWidth;
        const startY = startLandmark.y * videoHeight;
        const endX = endLandmark.x * videoWidth;
        const endY = endLandmark.y * videoHeight;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    });
  };

  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    landmarks: Landmark[],
    options: { color: string; radius: number }
  ) => {
    ctx.fillStyle = options.color;

    landmarks.forEach((landmark) => {
      if (landmark.visibility > 0.5) {
        const x = landmark.x * videoWidth;
        const y = landmark.y * videoHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, options.radius, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  // POSE_CONNECTIONSの定義（MediaPipeの代替）
  const POSE_CONNECTIONS = [
    // 顔
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    // 胴体
    [9, 10],
    [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
    [11, 23], [12, 24], [23, 24],
    // 左脚
    [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
    // 右脚
    [24, 26], [26, 28], [28, 30], [30, 32], [28, 32]
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !landmarks.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, videoWidth, videoHeight);

    try {
      // 描画を反転させるロジック
      if (isMirrored) {
        ctx.save();
        ctx.translate(videoWidth, 0);
        ctx.scale(-1, 1);
      }

      // Draw connectors
      drawConnectors(ctx, landmarks, POSE_CONNECTIONS, {
        color: '#00FF00',
        lineWidth: 2,
      });

      // Draw landmarks
      drawLandmarks(ctx, landmarks, {
        color: '#FF0000',
        radius: 3,
      });

      if (isMirrored) {
        ctx.restore();
      }
    } catch (error) {
      console.error('Error drawing pose overlay:', error);
    }
  }, [landmarks, videoWidth, videoHeight, isMirrored]);

  return (
    <canvas
      ref={canvasRef}
      width={videoWidth}
      height={videoHeight}
      style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
    />
  );
});