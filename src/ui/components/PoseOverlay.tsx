// src/ui/components/PoseOverlay.tsx (表示強制版)

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

  // 表示サイズを計算
  const displayWidth = containerWidth || videoWidth;
  const displayHeight = containerHeight || videoHeight;

  // ランドマークの座標を変換する関数
  const transformLandmark = (landmark: Landmark) => {
    let x = landmark.x * displayWidth;
    let y = landmark.y * displayHeight;
    
    if (isMirrored) {
      x = displayWidth - x;
    }
    
    return { x, y, visibility: landmark.visibility };
  };

  // 重要なランドマークのインデックス
  const importantLandmarks = [
    0,   // 鼻
    11, 12, // 肩
    23, 24, // 腰
    25, 26, // 膝
    27, 28, // 足首
    15, 16, // 手首
  ];

  // 接続線の定義
  const connections = [
    [11, 12], // 肩
    [11, 23], // 左肩-左腰
    [12, 24], // 右肩-右腰
    [23, 24], // 腰
    [11, 13], // 左肩-左肘
    [13, 15], // 左肘-左手首
    [12, 14], // 右肩-右肘
    [14, 16], // 右肘-右手首
    [23, 25], // 左腰-左膝
    [25, 27], // 左膝-左足首
    [24, 26], // 右腰-右膝
    [26, 28], // 右膝-右足首
    [0, 11],  // 鼻-左肩
    [0, 12],  // 鼻-右肩
  ];

  const visibleLandmarks = landmarks.filter((landmark, index) => 
    landmark && 
    typeof landmark.visibility === 'number' && 
    landmark.visibility > 0.5 &&
    importantLandmarks.includes(index)
  );

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 999999, // 最前面に強制表示
        pointerEvents: 'none',
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,255,0,0.2)', // 緑の半透明背景で確認
        }}
        viewBox={`0 0 ${displayWidth} ${displayHeight}`}
        preserveAspectRatio="none"
      >
        {/* 強制表示テスト用の大きな円 */}
        <circle
          cx={displayWidth / 2}
          cy={displayHeight / 2}
          r="50"
          fill="red"
          opacity="1"
        />
        
        {/* デバッグテキスト */}
        <text
          x={displayWidth / 2}
          y={50}
          textAnchor="middle"
          fill="yellow"
          fontSize="24"
          fontWeight="bold"
          stroke="black"
          strokeWidth="1"
        >
          SVG OVERLAY VISIBLE! {visibleLandmarks.length} landmarks
        </text>
        
        {/* 接続線を描画 */}
        {connections.map(([startIdx, endIdx], connectionIndex) => {
          const startLandmark = landmarks[startIdx];
          const endLandmark = landmarks[endIdx];
          
          if (!startLandmark || !endLandmark ||
              startLandmark.visibility < 0.5 || endLandmark.visibility < 0.5) {
            return null;
          }
          
          const start = transformLandmark(startLandmark);
          const end = transformLandmark(endLandmark);
          
          return (
            <line
              key={`connection-${connectionIndex}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#00ff00"
              strokeWidth="4"
              opacity="1"
            />
          );
        })}
        
        {/* ランドマークポイントを描画 */}
        {visibleLandmarks.map((landmark) => {
          const originalIndex = importantLandmarks.find(idx => landmarks[idx] === landmark);
          if (originalIndex === undefined) return null;
          
          const point = transformLandmark(landmark);
          const radius = 8; // 固定サイズで大きく
          
          // ランドマークの種類に応じて色を変更
          let color = '#ff0000'; // デフォルト：赤
          if ([11, 12].includes(originalIndex)) color = '#ff6600'; // 肩：オレンジ
          if ([23, 24].includes(originalIndex)) color = '#0066ff'; // 腰：青
          if ([25, 26].includes(originalIndex)) color = '#ff00ff'; // 膝：マゼンタ
          if ([27, 28].includes(originalIndex)) color = '#00ffff'; // 足首：シアン
          if (originalIndex === 0) color = '#ffff00'; // 鼻：黄色
          
          return (
            <circle
              key={`landmark-${originalIndex}`}
              cx={point.x}
              cy={point.y}
              r={radius}
              fill={color}
              opacity="1"
              stroke="#ffffff"
              strokeWidth="2"
            />
          );
        })}
      </svg>
    </div>
  );
};
