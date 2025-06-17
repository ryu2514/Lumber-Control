// src/ui/components/PoseOverlay.tsx (エラー修正版)

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
  console.log('🎨 PoseOverlay render:', {
    landmarksCount: landmarks?.length,
    videoSize: { width: videoWidth, height: videoHeight },
    containerSize: { width: containerWidth, height: containerHeight },
    isMirrored,
    firstLandmark: landmarks?.[0],
  });

  if (!landmarks || landmarks.length === 0 || videoWidth === 0 || videoHeight === 0) {
    console.log('❌ PoseOverlay: Missing data', {
      hasLandmarks: !!landmarks,
      landmarksLength: landmarks?.length,
      videoWidth,
      videoHeight,
    });
    return null;
  }

  // 表示サイズを計算（containerサイズが指定されている場合はそれを使用）
  const displayWidth = containerWidth || videoWidth;
  const displayHeight = containerHeight || videoHeight;
  
  console.log('📐 Display calculations:', {
    displayWidth,
    displayHeight,
    containerProvided: !!containerWidth,
  });

  // ランドマークの座標を変換する関数
  const transformLandmark = (landmark: Landmark) => {
    let x = landmark.x * displayWidth;
    let y = landmark.y * displayHeight;
    
    // ミラー表示の場合はX座標を反転
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
    // 体幹
    [11, 12], // 肩
    [11, 23], // 左肩-左腰
    [12, 24], // 右肩-右腰
    [23, 24], // 腰
    
    // 腕
    [11, 13], // 左肩-左肘
    [13, 15], // 左肘-左手首
    [12, 14], // 右肩-右肘
    [14, 16], // 右肘-右手首
    
    // 脚
    [23, 25], // 左腰-左膝
    [25, 27], // 左膝-左足首
    [24, 26], // 右腰-右膝
    [26, 28], // 右膝-右足首
    
    // 頭部
    [0, 11],  // 鼻-左肩
    [0, 12],  // 鼻-右肩
  ];

  const visibleLandmarks = landmarks.filter((landmark, index) => 
    landmark && 
    typeof landmark.visibility === 'number' && 
    landmark.visibility > 0.5 &&
    importantLandmarks.includes(index)
  );

  console.log('👁️ Visible landmarks:', {
    total: landmarks.length,
    important: importantLandmarks.length,
    visible: visibleLandmarks.length,
    visibleDetails: visibleLandmarks.map((landmark) => ({
      index: importantLandmarks.find(i => landmarks[i] === landmark),
      visibility: landmark.visibility,
      coords: { x: landmark.x, y: landmark.y }
    })),
  });

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        width: displayWidth,
        height: displayHeight,
        border: '2px solid red', // デバッグ用の境界線
        zIndex: 10, // 前面に表示
      }}
      viewBox={`0 0 ${displayWidth} ${displayHeight}`}
    >
      {/* デバッグ用の背景 */}
      <rect 
        width={displayWidth} 
        height={displayHeight} 
        fill="rgba(255,0,0,0.1)" 
      />
      
      {/* デバッグ情報テキスト */}
      <text
        x={10}
        y={30}
        fill="#ff0000"
        fontSize="14"
        fontWeight="bold"
      >
        Debug: {landmarks.length} landmarks, {visibleLandmarks.length} visible
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
        
        console.log(`🔗 Drawing connection ${connectionIndex}:`, { start, end });
        
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
        const radius = Math.max(5, Math.min(displayWidth, displayHeight) * 0.015); // より大きなサイズ
        
        console.log(`⭕ Drawing landmark ${originalIndex}:`, { point, radius });
        
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
      
      {/* 信頼度が低い場合の警告表示 */}
      {visibleLandmarks.length < 6 && (
        <text
          x={displayWidth / 2}
          y={60}
          textAnchor="middle"
          fill="#ff0000"
          fontSize="16"
          fontWeight="bold"
        >
          ⚠️ 姿勢検出の精度が低下しています
        </text>
      )}
      
      {/* ランドマーク数の表示（デバッグ用） */}
      <text
        x={10}
        y={displayHeight - 20}
        fill="#ffffff"
        fontSize="14"
        opacity="1"
        stroke="#000000"
        strokeWidth="1"
      >
        検出点: {visibleLandmarks.length}/{importantLandmarks.length}
      </text>
    </svg>
  );
};
