// Camera component for video input
import React, { useEffect, useRef, useState } from 'react';

interface CameraViewProps {
  onVideoElement: (video: HTMLVideoElement) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onVideoElement }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const setupCamera = async () => {
      try {
        // Request camera permissions
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: false
        });

        // Set up video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play();
              onVideoElement(videoRef.current);
            }
          };
        }
      } catch (err) {
        setError('カメラへのアクセスが拒否されました。設定を確認してください。');
        console.error('Camera access error:', err);
      }
    };

    setupCamera();

    // Clean up
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, [onVideoElement]);

  return (
    <div className="camera-container">
      {error ? (
        <div className="error-message">{error}</div>
      ) : (
        <video
          ref={videoRef}
          className="camera-view"
          playsInline
          style={{ transform: 'rotateY(180deg)' }}
        />
      )}
    </div>
  );
};
