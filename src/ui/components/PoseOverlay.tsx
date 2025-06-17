// src/ui/components/PoseOverlay.tsx (完成版)

import React, { useEffect, useRef } from 'react';
// ...他のimport...

// ...interface PoseOverlayProps...

// React.memoでコンポーネントを囲みます
export const PoseOverlay: React.FC<PoseOverlayProps> = React.memo(({
  landmarks,
  videoWidth,
  videoHeight,
  isMirrored = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ...useEffectの中身はそのまま...

  return (
    <canvas
      ref={canvasRef}
      width={videoWidth}
      height={videoHeight}
      style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
    />
  );
});