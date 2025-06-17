// src/ui/components/PoseOverlay.tsx (最終完成版)

import React, { useEffect, useRef } from 'react';
import { Landmark } from '../../types';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { POSE_CONNECTIONS } from '@mediapipe/pose';

// interfaceがなかったので追加します
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, videoWidth, videoHeight);

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