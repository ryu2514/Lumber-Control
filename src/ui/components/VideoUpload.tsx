import React, { useRef, useState, useCallback } from 'react';

interface VideoUploadProps {
  onVideoSelected: (video: HTMLVideoElement) => void;
  onVideoFile: (file: File) => void;
}

export const VideoUpload: React.FC<VideoUploadProps> = React.memo(({ onVideoSelected, onVideoFile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('動画ファイルを選択してください');
      return;
    }

    console.log('📁 動画ファイル選択:', file.name, file.type, file.size);
    setSelectedFile(file);
    onVideoFile(file);

    // ビデオ要素の準備を遅延実行
    setTimeout(() => {
      const videoElement = videoRef.current;
      if (videoElement) {
        const url = URL.createObjectURL(file);
        videoElement.src = url;
        videoElement.onloadedmetadata = () => {
          console.log('📹 動画メタデータ読み込み完了:', {
            duration: videoElement.duration,
            width: videoElement.videoWidth,
            height: videoElement.videoHeight
          });
          onVideoSelected(videoElement);
        };
        videoElement.onerror = (error) => {
          console.error('❌ 動画読み込みエラー:', error);
        };
      }
    }, 100);
  }, [onVideoSelected, onVideoFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    const file = files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="w-full">
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileInput}
          className="hidden"
        />
        
        {selectedFile ? (
          <div className="space-y-2">
            <div className="text-lg font-medium text-green-600">
              ✓ 動画が選択されました
            </div>
            <div className="text-sm text-gray-600">
              {selectedFile.name}
            </div>
            <div className="text-xs text-gray-500">
              別の動画を選択するにはここをクリック
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xl text-gray-400">📁</div>
            <div className="text-lg font-medium text-gray-700">
              動画ファイルをアップロード
            </div>
            <div className="text-sm text-gray-500">
              ドラッグ&ドロップまたはクリックして選択
            </div>
            <div className="text-xs text-gray-400">
              対応形式: MP4, MOV, AVI, WebM
            </div>
          </div>
        )}
      </div>

      {selectedFile && (
        <div className="mt-4">
          <video
            ref={videoRef}
            controls
            className="w-full max-h-64 rounded-lg"
            preload="metadata"
          />
        </div>
      )}
    </div>
  );
});