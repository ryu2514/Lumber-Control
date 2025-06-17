// src/ui/views/TestAnalysisView.tsx (完全修正版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraView } from '../components/CameraView';
import { PoseOverlay } from '../components/PoseOverlay';
import { TestType } from '../../types';
import { usePoseAnalysis } from '../hooks/usePoseAnalysis';
import { useAppStore } from '../../state/store';

const testTypeLabels: Record<TestType, string> = {
  [TestType.WAITERS_BOW]: "前屈テスト（Waiter's Bow）",
  [TestType.PELVIC_TILT]: '骨盤傾斜テスト（Pelvic Tilt）',
  [TestType.SINGLE_LEG_STANCE]: '片足立ちテスト（Single Leg Stance）',
};

const testInstructions: Record<TestType, string> = {
  [TestType.WAITERS_BOW]: "足を肩幅に開き、膝を曲げずに前傾してください。股関節を軸とした動作を意識してください。",
  [TestType.PELVIC_TILT]: "直立した状態で、骨盤の前後傾を確認します。自然な立位を保ってください。",
  [TestType.SINGLE_LEG_STANCE]: "片足で立ち、バランスを保ってください。30秒間維持できるかテストします。",
};

export const TestAnalysisView: React.FC = () => {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const videoRefForUpload = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
    }
  };

  const {
    currentTest,
    testStatus,
    landmarks,
    analysisResults,
    setCurrentTest,
    startTest,
    resetTest,
  } = useAppStore();

  const { isModelReady, error, isInitializing } = usePoseAnalysis(videoElement);

  useEffect(() => {
    if (videoElement) {
      const updateSize = () => {
        setVideoSize({
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
        });
      };
      
      videoElement.addEventListener('loadedmetadata', updateSize);
      videoElement.addEventListener('resize', updateSize);
      
      if (videoElement.videoWidth) {
        updateSize();
      }
      
      return () => {
        videoElement.removeEventListener('loadedmetadata', updateSize);
        videoElement.removeEventListener('resize', updateSize);
      };
    }
  }, [videoElement]);

  const handleVideoElement = useCallback((video: HTMLVideoElement) => {
    setVideoElement(video);
  }, []);

  const handleStartTest = () => {
    if (videoSrc && videoRefForUpload.current) {
      videoRefForUpload.current.currentTime = 0;
      videoRefForUpload.current.play().then(() => {
        setVideoElement(videoRefForUpload.current);
        startTest();
      }).catch(err => {
        console.error('Failed to play video:', err);
      });
    } else if (!videoSrc && videoElement) {
      startTest();
    }
  };

  const handleReset = () => {
    resetTest();
    if (videoSrc && videoRefForUpload.current) {
      videoRefForUpload.current.currentTime = 0;
      videoRefForUpload.current.pause();
    }
  };

  useEffect(() => {
    return () => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  const currentTestResult = currentTest ? analysisResults[currentTest] : undefined;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">エラーが発生しました</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <div className="flex gap-4">
            <button 
              onClick={() => window.location.reload()}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              リロード
            </button>
            <button 
              onClick={() => setVideoSrc(null)}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              カメラに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isInitializing || !isModelReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">
            {isInitializing ? 'MediaPipeを初期化中...' : 'モデルを読み込み中...'}
          </h2>
          <p className="text-gray-600">しばらくお待ちください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="test-analysis-view">
      <header className="app-header">
        <h1>理学療法士向け姿勢解析</h1>
        <div className="test-selector">
          <h2>テスト選択:</h2>
          <div className="test-buttons">
            {Object.values(TestType).map((type) => (
              <button
                key={type}
                className={`test-button ${currentTest === type ? 'active' : ''}`}
                onClick={() => setCurrentTest(type)}
                disabled={testStatus === 'running'}
              >
                {testTypeLabels[type]}
              </button>
            ))}
          </div>
        </div>

        <div className="my-4 text-center">
          <label
            htmlFor="video-upload"
            className="bg-blue-500 text-white font-bold py-2 px-4 rounded cursor-pointer hover:bg-blue-700"
          >
            または、動画ファイルを選択して解析
          </label>
          <input
            id="video-upload"
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={testStatus === 'running'}
          />
          {videoSrc && (
            <span className="ml-3 text-sm text-green-600">✅ 動画ファイルが選択されました</span>
          )}
        </div>
      </header>

      <main className="test-content">
        <div className="camera-section w-full max-w-3xl mx-auto">
          <div className="video-container relative w-full aspect-video bg-black rounded-lg overflow-hidden">
            {videoSrc ? (
              <video
                ref={videoRefForUpload}
                src={videoSrc}
                className="w-full h-full object-contain"
                controls
                onLoadedData={() => setVideoElement(videoRefForUpload.current)}
              />
            ) : (
              <CameraView onVideoElement={handleVideoElement} />
            )}
            
            {landmarks && videoSize.width > 0 && (
              <PoseOverlay
                landmarks={landmarks}
                videoWidth={videoSize.width}
                videoHeight={videoSize.height}
                isMirrored={!videoSrc}
              />
            )}
          </div>
          
          <div className="test-controls">
            {testStatus === 'idle' && (
              <button
                className="start-button"
                onClick={handleStartTest}
                disabled={!currentTest || !isModelReady}
              >
                分析開始
              </button>
            )}
            {testStatus === 'running' && (
              <div className="status-running">分析中...</div>
            )}
            {testStatus === 'completed' && (
              <button className="reset-button" onClick={handleReset}>
                リセット
              </button>
            )}
          </div>
        </div>
        
        <div className="results-section">
          {currentTest && currentTestResult ? (
            <div className="test-results">
              <h3>{testTypeLabels[currentTest]} 結果</h3>
              <div className="score-display">
                <div 
                  className="score-circle" 
                  style={{ 
                    background: `conic-gradient(#4CAF50 0%, #4CAF50 ${currentTestResult.score}%, #f3f3f3 ${currentTestResult.score}%, #f3f3f3 100%)` 
                  }}
                >
                  <span className="score-value">{Math.round(currentTestResult.score)}</span>
                </div>
              </div>
              <div className="metrics-list">
                {Object.entries(currentTestResult.metrics).map(([key, value]) => (
                  <div key={key} className="metric-item">
                    <span className="metric-label">{key}:</span>
                    <span className="metric-value">
                      {typeof value === 'number' ? value.toFixed(2) : value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="feedback">
                <h4>フィードバック:</h4>
                <p>{currentTestResult.feedback}</p>
              </div>
            </div>
          ) : currentTest ? (
            <div className="test-instructions">
              <h3>{testTypeLabels[currentTest]}</h3>
              <div className="mb-6 p-4 bg-gray-100 rounded-lg text-center">
                <svg width="200" height="150" viewBox="0 0 200 150" className="mx-auto mb-3">
                  {currentTest === TestType.WAITERS_BOW && (
                    <g>
                      <circle cx="100" cy="30" r="15" fill="#007bff" />
                      <line x1="100" y1="45" x2="100" y2="100" stroke="#007bff" strokeWidth="4" />
                      <line x1="100" y1="70" x2="80" y2="50" stroke="#007bff" strokeWidth="3" />
                      <line x1="100" y1="70" x2="120" y2="50" stroke="#007bff" strokeWidth="3" />
                      <line x1="100" y1="100" x2="80" y2="130" stroke="#007bff" strokeWidth="3" />
                      <line x1="100" y1="100" x2="120" y2="130" stroke="#007bff" strokeWidth="3" />
                      <path d="M 120 60 L 140 80 L 135 75 M 140 80 L 135 85" stroke="#ff4444" strokeWidth="2" fill="none" />
                    </g>
                  )}
                  {currentTest === TestType.PELVIC_TILT && (
                    <g>
                      <circle cx="100" cy="30" r="12" fill="#28a745" />
                      <line x1="100" y1="42" x2="100" y2="90" stroke="#28a745" strokeWidth="4" />
                      <ellipse cx="100" cy="90" rx="20" ry="8" fill="#28a745" />
                      <line x1="100" y1="90" x2="85" y2="120" stroke="#28a745" strokeWidth="3" />
                      <line x1="100" y1="90" x2="115" y2="120" stroke="#28a745" strokeWidth="3" />
                    </g>
                  )}
                  {currentTest === TestType.SINGLE_LEG_STANCE && (
                    <g>
                      <circle cx="100" cy="30" r="12" fill="#ffc107" />
                      <line x1="100" y1="42" x2="100" y2="90" stroke="#ffc107" strokeWidth="4" />
                      <line x1="100" y1="90" x2="100" y2="120" stroke="#ffc107" strokeWidth="3" />
                      <line x1="100" y1="90" x2="115" y2="110" stroke="#ffc107" strokeWidth="2" strokeDasharray="3,3" />
                      <text x="125" y="115" fontSize="12" fill="#666">浮き足</text>
                    </g>
                  )}
                </svg>
                <p className="text-sm text-gray-600 font-medium">テストポーズの例</p>
              </div>
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-2">📋 実行方法:</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {testInstructions[currentTest]}
                </p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2">⚠️ 注意事項:</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• 全身がカメラに映るように調整してください</li>
                  <li>• 十分な照明を確保してください</li>
                  <li>• 動作はゆっくりと行ってください</li>
                  <li>• 安全な場所で実施してください</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="no-results">
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🏥</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">テストを選択してください</h3>
                <p className="text-sm text-gray-500">
                  上部のボタンから実施したいテストを選択してください。
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};