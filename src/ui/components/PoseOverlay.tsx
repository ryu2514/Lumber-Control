// src/ui/components/PoseOverlay.tsx (動画直上描写版)

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
    console.log('🚫 PoseOverlay: 基本条件が満たされていません', { 
      landmarksLength: landmarks?.length, 
      videoWidth, 
      videoHeight 
    });
    return null;
  }

  // 実際の表示サイズを計算
  const displayWidth = containerWidth || videoWidth;
  const displayHeight = containerHeight || videoHeight;

  console.log('🎯 PoseOverlay size calculation:', {
    videoSize: { width: videoWidth, height: videoHeight },
    displaySize: { width: displayWidth, height: displayHeight },
    landmarksLength: landmarks.length,
    firstLandmark: landmarks[0]
  });

  // ランドマークの座標を変換する関数（NaN回避）
  const transformLandmark = (landmark: Landmark) => {
    // TensorFlow.jsは既に正規化された座標（0-1）を返すので、直接使用
    let x = landmark.x * displayWidth;
    let y = landmark.y * displayHeight;
    
    // NaN値をチェックして修正
    if (isNaN(x) || !isFinite(x)) {
      console.warn('🚨 Invalid x coordinate:', landmark.x, '-> setting to 0');
      x = 0;
    }
    if (isNaN(y) || !isFinite(y)) {
      console.warn('🚨 Invalid y coordinate:', landmark.y, '-> setting to 0');
      y = 0;
    }
    
    if (isMirrored) {
      x = displayWidth - x;
    }
    
    return { x, y, visibility: landmark.visibility };
  };

  // より多くの重要なランドマークのインデックス（TensorFlow.js BlazePose 33点）
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

  // 可視性の閾値を下げる（0.3 → 0.1）
  const visibilityThreshold = 0.1;

  const visibleLandmarks = landmarks.filter((landmark, index) => 
    landmark && 
    typeof landmark.visibility === 'number' && 
    landmark.visibility > visibilityThreshold &&
    importantLandmarks.includes(index) &&
    !isNaN(landmark.x) && !isNaN(landmark.y) // NaN値を除外
  );

  // より詳細なログ
  console.log('👀 可視ランドマーク詳細:', {
    全体数: landmarks.length,
    重要ランドマーク数: importantLandmarks.length,
    可視ランドマーク数: visibleLandmarks.length,
    閾値: visibilityThreshold
  });

  // デバイスに応じたサイズ調整（より大きく）
  const isMobile = displayWidth < 768;
  const baseRadius = isMobile ? 5 : 8;
  const strokeWidth = isMobile ? 3 : 5;
  const fontSize = isMobile ? 12 : 16;

  return (
    <div
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 9999, // 最高優先度で動画の直上に配置
        pointerEvents: 'none',
      }}
    >
      <svg
        className="w-full h-full"
        style={{
          width: '100%',
          height: '100%',
        }}
        viewBox={`0 0 ${displayWidth} ${displayHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* テスト用固定ポイント（必ず表示される） */}
        <circle cx={displayWidth * 0.5} cy={displayHeight * 0.3} r="10" fill="#ff0000" opacity="0.8" />
        <circle cx={displayWidth * 0.3} cy={displayHeight * 0.5} r="10" fill="#00ff00" opacity="0.8" />
        <circle cx={displayWidth * 0.7} cy={displayHeight * 0.5} r="10" fill="#0000ff" opacity="0.8" />
        <circle cx={displayWidth * 0.5} cy={displayHeight * 0.7} r="10" fill="#ffff00" opacity="0.8" />

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
          
          // 変換後の座標もチェック
          if (isNaN(start.x) || isNaN(start.y) || isNaN(end.x) || isNaN(end.y)) {
            return null;
          }
          
          return (
            <line
              key={`connection-${connectionIndex}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#00ff00"
              strokeWidth={strokeWidth}
              opacity="0.8"
            />
          );
        })}
        
        {/* ランドマークポイントを描画 */}
        {visibleLandmarks.map((landmark) => {
          const originalIndex = importantLandmarks.find(idx => landmarks[idx] === landmark);
          if (originalIndex === undefined) return null;
          
          const point = transformLandmark(landmark);
          
          // 変換後の座標をチェック
          if (isNaN(point.x) || isNaN(point.y)) {
            return null;
          }
          
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
              r={baseRadius}
              fill={color}
              opacity="0.9"
              stroke="#ffffff"
              strokeWidth="2"
            />
          );
        })}
        
        {/* デバッグ情報 */}
        <text
          x={10}
          y={30}
          fill="#ffffff"
          fontSize={fontSize}
          fontWeight="bold"
          opacity="1.0"
          stroke="#000000"
          strokeWidth="1"
        >
          🎯 {visibleLandmarks.length}/{landmarks.length}pts | {Math.round(displayWidth)}x{Math.round(displayHeight)} TF.js
        </text>
        
        <text
          x={10}
          y={55}
          fill="#ffffff"
          fontSize={fontSize - 2}
          opacity="1.0"
          stroke="#000000"
          strokeWidth="1"
        >
          📊 閾値: {visibilityThreshold} | 動画直上描写
        </text>
      </svg>
    </div>
  );
};
