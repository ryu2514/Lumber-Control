// src/ui/components/PoseOverlay.tsx (最終版)

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

  // より多くの重要なランドマークのインデックス
  const importantLandmarks = [
    0,   // 鼻
    11, 12, // 肩
    13, 14, // 肘
    15, 16, // 手首
    23, 24, // 腰
    25, 26, // 膝
    27, 28, // 足首
    29, 30, // かかと
    31, 32, // つま先
  ];

  // 接続線の定義
  const connections = [
    // 体幹
    [11, 12], // 肩
    [11, 23], // 左肩-左腰
    [12, 24], // 右肩-右腰
    [23, 24], // 腰
    
    // 左腕
    [11, 13], // 左肩-左肘
    [13, 15], // 左肘-左手首
    
    // 右腕
    [12, 14], // 右肩-右肘
    [14, 16], // 右肘-右手首
    
    // 左脚
    [23, 25], // 左腰-左膝
    [25, 27], // 左膝-左足首
    [27, 29], // 左足首-左かかと
    [29, 31], // 左かかと-左つま先
    
    // 右脚
    [24, 26], // 右腰-右膝
    [26, 28], // 右膝-右足首
    [28, 30], // 右足首-右かかと
    [30, 32], // 右かかと-右つま先
    
    // 頭部
    [0, 11],  // 鼻-左肩
    [0, 12],  // 鼻-右肩
  ];

  const visibleLandmarks = landmarks.filter((landmark, index) => 
    landmark && 
    typeof landmark.visibility === 'number' && 
    landmark.visibility > 0.3 && // しきい値を下げてより多く表示
    importantLandmarks.includes(index)
  );

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 10, // 適切なz-index
        pointerEvents: 'none',
      }}
      viewBox={`0 0 ${displayWidth} ${displayHeight}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 接続線を描画 */}
      {connections.map(([startIdx, endIdx], connectionIndex) => {
        const startLandmark = landmarks[startIdx];
        const endLandmark = landmarks[endIdx];
        
        if (!startLandmark || !endLandmark ||
            startLandmark.visibility < 0.3 || endLandmark.visibility < 0.3) {
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
            strokeWidth="3"
            opacity="0.8"
          />
        );
      })}
      
      {/* ランドマークポイントを描画 */}
      {visibleLandmarks.map((landmark) => {
        const originalIndex = importantLandmarks.find(idx => landmarks[idx] === landmark);
        if (originalIndex === undefined) return null;
        
        const point = transformLandmark(landmark);
        const radius = Math.max(4, Math.min(displayWidth, displayHeight) * 0.01);
        
        // ランドマークの種類に応じて色を変更
        let color = '#ff0000'; // デフォルト：赤
        if ([11, 12].includes(originalIndex)) color = '#ff6600'; // 肩：オレンジ
        if ([13, 14].includes(originalIndex)) color = '#ffaa00'; // 肘：明るいオレンジ
        if ([15, 16].includes(originalIndex)) color = '#ffdd00'; // 手首：黄色
        if ([23, 24].includes(originalIndex)) color = '#0066ff'; // 腰：青
        if ([25, 26].includes(originalIndex)) color = '#ff00ff'; // 膝：マゼンタ
        if ([27, 28].includes(originalIndex)) color = '#00ffff'; // 足首：シアン
        if ([29, 30].includes(originalIndex)) color = '#aa00ff'; // かかと：紫
        if ([31, 32].includes(originalIndex)) color = '#00ff88'; // つま先：緑
        if (originalIndex === 0) color = '#ffff00'; // 鼻：黄色
        
        return (
          <circle
            key={`landmark-${originalIndex}`}
            cx={point.x}
            cy={point.y}
            r={radius}
            fill={color}
            opacity="0.9"
            stroke="#ffffff"
            strokeWidth="1"
          />
        );
      })}
      
      {/* 軽量なデバッグ情報 */}
      <text
        x={10}
        y={20}
        fill="#ffffff"
        fontSize="12"
        opacity="0.7"
        stroke="#000000"
        strokeWidth="0.5"
      >
        {visibleLandmarks.length} points
      </text>
    </svg>
  );
};
