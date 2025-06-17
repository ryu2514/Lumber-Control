// src/ui/components/PoseOverlay.tsx (完成版)

import React, { useEffect, useRef } from 'react';
import { Landmark } from '../../types';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { POSE_CONNECTIONS } from '@mediapipe/pose';

interface PoseOverlayProps {
  landmarks: Landmark[];
  videoWidth: number;
  videoHeight: number;
  isMirrored?: boolean; // ★★★ 1. isMirroredプロパティを追加 ★★★
}

export const PoseOverlay: React.FC<PoseOverlayProps> = ({
  landmarks,
  videoWidth,
  videoHeight,
  isMirrored = false, // デフォルトは反転しない
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, videoWidth, videoHeight);

    // ★★★ 2. 描画を反転させるロジックを追加 ★★★
    if (isMirrored) {
      ctx.save(); // 現在の状態を保存
      ctx.translate(videoWidth, 0); // X軸の原点を右端に移動
      ctx.scale(-1, 1); // X軸を反転
    }

    // Draw connectors (lines between landmarks)
    drawConnectors(ctx, landmarks, POSE_CONNECTIONS, {
      color: '#00FF00',
      lineWidth: 2,
    });

    // Draw landmarks (dots)
    drawLandmarks(ctx, landmarks, {
      color: '#FF0000',
      radius: 3,
    });

    // ★★★ 3. 反転した描画状態を元に戻す ★★★
    if (isMirrored) {
      ctx.restore(); // 保存した状態に戻す
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
};