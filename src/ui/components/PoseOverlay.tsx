// src/ui/components/PoseOverlay.tsx (MediaPipe版・位置ずれ修正)

import React from 'react';
import { Landmark } from '../../types';

interface PoseOverlayProps {
  landmarks: Landmark[];
  videoWidth: number;
  videoHeight: number;
  containerWidth?: number;
  containerHeight?: number;
  isMirrored?: boolean;
}

export const PoseOverlay: React.FC<PoseOverlayProps> = ({
  landmarks,
  videoWidth,
  videoHeight,
  containerWidth,
  containerHeight,
  isMirrored = false,
}) => {
  if (!landmarks || landmarks.length === 0 || videoWidth === 0 || videoHeight === 0) {
    return null;
  }

  // 表示サイズの正確な計算（位置ずれ修正）
  const displayWidth = containerWidth || videoWidth;
  const displayHeight = containerHeight || videoHeight;

  console.log('🎯 MediaPipe PoseOverlay:', {
    videoSize: { width: videoWidth, height: videoHeight },
    displaySize: { width: displayWidth, height: displayHeight },
    landmarksCount: landmarks.length
  });

  // ランドマーク座標変換（MediaPipe用）
  const transformLandmark = (landmark: Landmark) => {
    // MediaPipeは正規化座標（0-1）を返すので、表示サイズでスケール
    let x = landmark.x * displayWidth;
    let y = landmark.y * displayHeight;
    
    // NaN値の修正
    if (isNaN(x) || !isFinite(x)) x = 0;
    if (isNaN(y) || !isFinite(y)) y = 0;
    
    // ミラーリング対応
    if (isMirrored) {
      x = displayWidth - x;
    }
    
    return { x, y, visibility: landmark.visibility };
  };

  // MediaPipe BlazePose 33点のランドマーク
  const mediapipeLandmarks = Array.from({ length: 33 }, (_, i) => i);

  // MediaPipe用接続線定義
  const connections = [
    // 顔
    [0, 1], [1, 2], [2, 3], [3, 7], [7, 4], [4, 5], [5, 6],
    [0, 9], [9, 10],
    
    // 体幹
    [11, 12], // 肩
    [11, 23], [12, 24], // 肩-腰
    [23, 24], // 腰
    
    // 左腕
    [11, 13], [13, 15], // 肩-肘-手首
    [15, 17], [15, 19], [15, 21], // 手首-手指
    [17, 19], [19, 21], // 手指間
    
    // 右腕  
    [12, 14], [14, 16], // 肩-肘-手首
    [16, 18], [16, 20], [16, 22], // 手首-手指
    [18, 20], [20, 22], // 手指間
    
    // 左脚
    [23, 25], [25, 27], // 腰-膝-足首
    [27, 29], [27, 31], // 足首-かかと/つま先
    [29, 31], // かかと-つま先
    
    // 右脚
    [24, 26], [26, 28], // 腰-膝-足首
    [28, 30], [28, 32], // 足首-かかと/つま先
    [30, 32], // かかと-つま先
  ];

  // MediaPipe用可視性閾値
  const visibilityThreshold = 0.1;

  const visibleLandmarks = landmarks.filter((landmark, index) => 
    landmark && 
    typeof landmark.visibility === 'number' && 
    landmark.visibility > visibilityThreshold &&
    mediapipeLandmarks.includes(index) &&
    !isNaN(landmark.x) && !isNaN(landmark.y)
  );

  console.log(`👀 MediaPipe可視ランドマーク: ${visibleLandmarks.length}/33`);

  // レスポンシブサイズ
  const isMobile = displayWidth < 768;
  const pointRadius = isMobile ? 4 : 6;
  const lineWidth = isMobile ? 2 : 3;
  const fontSize = isMobile ? 12 : 14;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${displayWidth} ${displayHeight}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {/* 接続線 */}
        {connections.map(([startIdx, endIdx], idx) => {
          const start = landmarks[startIdx];
          const end = landmarks[endIdx];
          
          if (!start || !end || 
              start.visibility < visibilityThreshold || 
              end.visibility < visibilityThreshold) {
            return null;
          }
          
          const startPoint = transformLandmark(start);
          const endPoint = transformLandmark(end);
          
          return (
            <line
              key={`line-${idx}`}
              x1={startPoint.x}
              y1={startPoint.y}
              x2={endPoint.x}
              y2={endPoint.y}
              stroke="#00ff00"
              strokeWidth={lineWidth}
              opacity="0.8"
            />
          );
        })}
        
        {/* ランドマークポイント */}
        {visibleLandmarks.map((landmark, index) => {
          const originalIndex = mediapipeLandmarks.find(idx => landmarks[idx] === landmark);
          if (originalIndex === undefined) return null;
          
          const point = transformLandmark(landmark);
          
          // MediaPipe用色分け
          let color = '#ff0000'; // デフォルト赤
          if (originalIndex >= 0 && originalIndex <= 10) color = '#ffff00'; // 顔：黄
          if ([11, 12].includes(originalIndex)) color = '#ff6600'; // 肩：オレンジ
          if ([13, 14].includes(originalIndex)) color = '#ff0000'; // 肘：赤
          if ([15, 16].includes(originalIndex)) color = '#ffaa00'; // 手首：明るいオレンジ
          if (originalIndex >= 17 && originalIndex <= 22) color = '#ffdd00'; // 手指：明るい黄
          if ([23, 24].includes(originalIndex)) color = '#0066ff'; // 腰：青
          if ([25, 26].includes(originalIndex)) color = '#ff00ff'; // 膝：マゼンタ
          if ([27, 28].includes(originalIndex)) color = '#00ffff'; // 足首：シアン
          if ([29, 30].includes(originalIndex)) color = '#aa00ff'; // かかと：紫
          if ([31, 32].includes(originalIndex)) color = '#00ff88'; // つま先：緑
          
          return (
            <circle
              key={`point-${originalIndex}`}
              cx={point.x}
              cy={point.y}
              r={pointRadius}
              fill={color}
              opacity={Math.max(0.7, landmark.visibility)}
              stroke="#000000"
              strokeWidth="1"
            />
          );
        })}
        
        {/* MediaPipe情報表示 */}
        <text
          x={10}
          y={25}
          fill="#ffffff"
          fontSize={fontSize}
          fontWeight="bold"
          stroke="#000000"
          strokeWidth="1"
        >
          📡 MediaPipe: {visibleLandmarks.length}/33pts
        </text>
        
        <text
          x={10}
          y={45}
          fill="#ffffff"
          fontSize={fontSize - 2}
          stroke="#000000"
          strokeWidth="1"
        >
          🎯 {displayWidth}×{displayHeight} | 閾値: {visibilityThreshold}
        </text>
      </svg>
    </div>
  );
};
