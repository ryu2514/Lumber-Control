// src/ui/components/CameraView.tsx (完成版)

import React, { useEffect, useRef } from 'react';

interface CameraViewProps {
  onVideoElement: (video: HTMLVideoElement) => void;
}

// React.memoでコンポーネントを囲みます
export const CameraView: React.FC<CameraViewProps> = React.memo(({ onVideoElement }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // カメラのセットアップ
    let stream: MediaStream | null = null;
    const setupCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }, // 前面カメラを使用
          audio: false,
        });
        videoElement.srcObject = stream;
        videoElement.onloadedmetadata = () => {
          videoElement.play();
          onVideoElement(videoElement); // 準備完了を親に通知
        };
      } catch (err) {
        console.error('Error accessing camera:', err);
      }
    };

    setupCamera();

    // クリーンアップ関数
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onVideoElement]); // onVideoElementは通常変わらないので、初回のみ実行される

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full h-auto transform scale-x-[-1]" // 左右反転
    />
  );
});