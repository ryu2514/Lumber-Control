// src/ui/components/PoseOverlay.tsx (33点高精度版)

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

  const displayWidth = containerWidth || videoWidth;
  const displayHeight = containerHeight || videoHeight;

  // ランドマークの座標を変換する関数
  const transformLandmark = (landmark: Landmark) => {
    let x = landmark.x * displayWidth;
    let y = landmark.y * displayHeight;
    
    if (isNaN(x) || !isFinite(x)) x = 0;
    if (isNaN(y) || !isFinite(y)) y = 0;
    
    if (isMirrored) {
      x = displayWidth - x;
    }
    
    return { x, y, visibility: landmark.visibility };
  };

  // BlazePose 33点すべてのランドマーク定義
  const allLandmarks = [
    0,   // 鼻
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, // 顔・目・口
    11, 12, // 肩
    13, 14, // 肘
    15, 16, // 手首
    17, 18, 19, 20, 21, 22, // 手指
    23, 24, // 腰
    25, 26, // 膝
    27, 28, // 足首
    29, 30, // かかと
    31, 32, // つま先
  ];

  // より詳細な接続線の定義（33点フル活用）
  const connections = [
    // 顔の輪郭
    [1, 2], [2, 3], [3, 7], [7, 4], [4, 5], [5, 6], [6, 8], [8, 9], [9, 10], [10, 1],
    
    // 体幹
    [11, 12], // 肩
    [11, 23], // 左肩-左腰
    [12, 24], // 右肩-右腰
    [23, 24], // 腰
    
    // 左腕
    [11, 13], // 左肩-左肘
    [13, 15], // 左肘-左手首
    [15, 17], // 左手首-左手指1
    [15, 19], // 左手首-左手指2
    [15, 21], // 左手首-左手指3
    [17, 19], [19, 21], // 手指接続
    
    // 右腕
    [12, 14], // 右肩-右肘
    [14, 16], // 右肘-右手首
    [16, 18], // 右手首-右手指1
    [16, 20], // 右手首-右手指2
    [16, 22], // 右手首-右手指3
    [18, 20], [20, 22], // 手指接続
    
    // 左脚
    [23, 25], // 左腰-左膝
    [25, 27], // 左膝-左足首
    [27, 29], // 左足首-左かかと
    [29, 31], // 左かかと-左つま先
    [27, 31], // 左足首-左つま先
    
    // 右脚
    [24, 26], // 右腰-右膝
    [26, 28], // 右膝-右足首
    [28, 30], // 右足首-右かかと
    [30, 32], // 右かかと-右つま先
    [28, 32], // 右足首-右つま先
    
    // 頭部-体幹接続
    [0, 11], [0, 12], // 鼻-肩
  ];

  // 可視性閾値を大幅に下げる（ほぼすべてのポイントを表示）
  const visibilityThreshold = 0.01; // 0.1 → 0.01

  const visibleLandmarks = landmarks.filter((landmark, index) => 
    landmark && 
    typeof landmark.visibility === 'number' && 
    landmark.visibility > visibilityThreshold &&
    allLandmarks.includes(index) &&
    !isNaN(landmark.x) && !isNaN(landmark.y)
  );

  console.log('🎯 高精度ランドマーク表示:', {
    全ランドマーク数: landmarks.length,
    可視ランドマーク数: visibleLandmarks.length,
    可視性閾値: visibilityThreshold,
    検出率: `${((visibleLandmarks.length / 33) * 100).toFixed(1)}%`
  });

  // ランドマークの可視性詳細ログ
  landmarks.forEach((landmark, index) => {
    if (landmark && landmark.visibility > visibilityThreshold) {
      console.log(`✅ ランドマーク${index}: visibility=${landmark.visibility.toFixed(3)}`);
    } else if (landmark && landmark.visibility <= visibilityThreshold) {
      console.log(`❌ ランドマーク${index}: visibility=${landmark.visibility.toFixed(3)} (閾値以下)`);
    }
  });

  // デバイスに応じたサイズ調整
  const isMobile = displayWidth < 768;
  const baseRadius = isMobile ? 4 : 6;
  const strokeWidth = isMobile ? 2 : 3;
  const fontSize = isMobile ? 10 : 14;

  return (
    <div
      className="absolute inset-0 w-full h-full pointer-events-none"
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
        className="w-full h-full"
        viewBox={`0 0 ${displayWidth} ${displayHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* 接続線を描画 */}
        {connections.map(([startIdx, endIdx], connectionIndex) => {
          const startLandmark = landmarks[startIdx];
          const endLandmark = landmarks[endIdx];
          
          if (!startLandmark || !endLandmark ||
              startLandmark.visibility < visibilityThreshold || 
              endLandmark.visibility < visibilityThreshold ||
              isNaN(startLandmark.x) || isNaN(startLandmark.y) ||
              isNaN(endLandmark.x) || isNaN(endLandmark.y)) {
            return null;
          }
          
          const start = transformLandmark(startLandmark);
          const end = transformLandmark(endLandmark);
          
          if (isNaN(start.x) || isNaN(start.y) || isNaN(end.x) || isNaN(end.y)) {
            return null;
          }
          
          // 線の透明度を可視性に応じて調整
          const opacity = Math.min(startLandmark.visibility, endLandmark.visibility) * 0.8;
          
          return (
            <line
              key={`connection-${connectionIndex}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#00ff00"
              strokeWidth={strokeWidth}
              opacity={opacity}
            />
          );
        })}
        
        {/* ランドマークポイントを描画 */}
        {visibleLandmarks.map((landmark) => {
          const originalIndex = allLandmarks.find(idx => landmarks[idx] === landmark);
          if (originalIndex === undefined) return null;
          
          const point = transformLandmark(landmark);
          
          if (isNaN(point.x) || isNaN(point.y)) {
            return null;
          }
          
          // より詳細な色分け（33点対応）
          let color = '#ffffff'; // デフォルト：白
          
          // 顔・頭部（0-10）
          if (originalIndex >= 0 && originalIndex <= 10) color = '#ffff00'; // 黄色
          
          // 肩（11-12）
          if ([11, 12].includes(originalIndex)) color = '#ff6600'; // オレンジ
          
          // 腕（13-16）
          if ([13, 14].includes(originalIndex)) color = '#ff0000'; // 肘：赤
          if ([15, 16].includes(originalIndex)) color = '#ffaa00'; // 手首：明るいオレンジ
          
          // 手指（17-22）
          if (originalIndex >= 17 && originalIndex <= 22) color = '#ffdd00'; // 手指：明るい黄色
          
          // 腰（23-24）
          if ([23, 24].includes(originalIndex)) color = '#0066ff'; // 青
          
          // 脚（25-32）
          if ([25, 26].includes(originalIndex)) color = '#ff00ff'; // 膝：マゼンタ
          if ([27, 28].includes(originalIndex)) color = '#00ffff'; // 足首：シアン
          if ([29, 30].includes(originalIndex)) color = '#aa00ff'; // かかと：紫
          if ([31, 32].includes(originalIndex)) color = '#00ff88'; // つま先：緑
          
          // ポイントの透明度を可視性に応じて調整
          const opacity = Math.max(0.5, landmark.visibility);
          
          return (
            <circle
              key={`landmark-${originalIndex}`}
              cx={point.x}
              cy={point.y}
              r={baseRadius}
              fill={color}
              opacity={opacity}
              stroke="#000000"
              strokeWidth="1"
            />
          );
        })}
        
        {/* 高精度デバッグ情報 */}
        <text
          x={10}
          y={25}
          fill="#ffffff"
          fontSize={fontSize}
          fontWeight="bold"
          opacity="1.0"
          stroke="#000000"
          strokeWidth="1"
        >
          🎯 {visibleLandmarks.length}/33pts ({((visibleLandmarks.length / 33) * 100).toFixed(0)}%)
        </text>
        
        <text
          x={10}
          y={45}
          fill="#ffffff"
          fontSize={fontSize - 2}
          opacity="1.0"
          stroke="#000000"
          strokeWidth="1"
        >
          📊 閾値: {visibilityThreshold} | 高精度モード
        </text>
      </svg>
    </div>
  );
};
