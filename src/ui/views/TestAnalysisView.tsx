// src/ui/views/TestAnalysisView.tsx (モバイル対応版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraView } from '../components/CameraView';
import { PoseOverlay } from '../components/PoseOverlay';
import { TestType } from '../../types';
import { usePoseAnalysis } from '../hooks/usePoseAnalysis';
import { useAppStore } from '../../state/store';

const testTypeLabels: Record<TestType, string> = {
  [TestType.STANDING_HIP_FLEXION]: "立位股関節屈曲",
  [TestType.ROCK_BACK]: "ロックバック",
  [TestType.SITTING_KNEE_EXTENSION]: "座位膝関節伸展",
};

const testInstructions: Record<TestType, string> = {
  [TestType.STANDING_HIP_FLEXION]: "立位姿勢の状態で前屈をして、腰椎屈曲のコントロールを評価します。膝を曲げずに股関節から前屈してください。",
  [TestType.ROCK_BACK]: "四つ這いの姿勢で体重を後方に移動させて腰椎屈曲と伸展のコントロールを評価します。ゆっくりと後方に体重を移動してください。",
  [TestType.SITTING_KNEE_EXTENSION]: "座位姿勢で膝関節を伸展した際の腰椎屈曲のコントロールを評価します。背筋を伸ばした状態で片脚の膝を伸ばしてください。",
};

const testDetails: Record<TestType, string[]> = {
  [TestType.STANDING_HIP_FLEXION]: [
    "股関節を軸とした前屈動作",
    "腰椎の過度な屈曲を避ける",
    "膝関節は伸展位を保持",
    "体幹の一体性を維持"
  ],
  [TestType.ROCK_BACK]: [
    "四つ這い位から後方への体重移動",
    "腰椎の分節的な屈曲・伸展",
    "上肢での支持性維持",
    "頭頸部の安定性保持"
  ],
  [TestType.SITTING_KNEE_EXTENSION]: [
    "座位での体幹安定性維持",
    "膝関節伸展時の腰椎制御",
    "骨盤ニュートラル位置保持",
    "代償動作の最小化"
  ]
};

export const TestAnalysisView: React.FC = () => {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const videoRefForUpload = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isVideoFileMode, setIsVideoFileMode] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setIsVideoFileMode(true);
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

  // 動画サイズの更新
  useEffect(() => {
    if (videoElement) {
      const updateVideoSize = () => {
        const videoWidth = videoElement.videoWidth;
        const videoHeight = videoElement.videoHeight;
        
        setVideoSize({ width: videoWidth, height: videoHeight });
        
        // 表示サイズを計算（コンテナサイズに基づく）
        if (videoContainerRef.current && videoWidth && videoHeight) {
          const container = videoContainerRef.current;
          const containerWidth = container.clientWidth;
          const containerHeight = container.clientHeight;
          const aspectRatio = videoWidth / videoHeight;
          
          let displayWidth = containerWidth;
          let displayHeight = containerWidth / aspectRatio;
          
          if (displayHeight > containerHeight) {
            displayHeight = containerHeight;
            displayWidth = containerHeight * aspectRatio;
          }
          
          setDisplaySize({ width: displayWidth, height: displayHeight });
        }
      };
      
      const updateDisplaySize = () => {
        if (videoSize.width && videoSize.height && videoContainerRef.current) {
          const container = videoContainerRef.current;
          const containerWidth = container.clientWidth;
          const containerHeight = container.clientHeight;
          const aspectRatio = videoSize.width / videoSize.height;
          
          let displayWidth = containerWidth;
          let displayHeight = containerWidth / aspectRatio;
          
          if (displayHeight > containerHeight) {
            displayHeight = containerHeight;
            displayWidth = containerHeight * aspectRatio;
          }
          
          setDisplaySize({ width: displayWidth, height: displayHeight });
        }
      };
      
      videoElement.addEventListener('loadedmetadata', updateVideoSize);
      videoElement.addEventListener('resize', updateVideoSize);
      window.addEventListener('resize', updateDisplaySize);
      
      if (videoElement.videoWidth) {
        updateVideoSize();
      }
      
      return () => {
        videoElement.removeEventListener('loadedmetadata', updateVideoSize);
        videoElement.removeEventListener('resize', updateVideoSize);
        window.removeEventListener('resize', updateDisplaySize);
      };
    }
  }, [videoElement, videoSize.width, videoSize.height]);

  const handleVideoElement = useCallback((video: HTMLVideoElement) => {
    console.log('Setting video element:', video);
    setVideoElement(video);
  }, []);

  const handleStartTest = () => {
    if (isVideoFileMode && videoRefForUpload.current) {
      videoRefForUpload.current.currentTime = 0;
      videoRefForUpload.current.play().then(() => {
        console.log('Video file started playing');
        setVideoElement(videoRefForUpload.current);
        startTest();
      }).catch(err => {
        console.error('Failed to play video:', err);
      });
    } else if (!isVideoFileMode && videoElement) {
      console.log('Starting webcam test');
      startTest();
    }
  };

  const handleReset = () => {
    resetTest();
    if (isVideoFileMode && videoRefForUpload.current) {
      videoRefForUpload.current.currentTime = 0;
      videoRefForUpload.current.pause();
    }
  };

  const handleBackToCamera = () => {
    resetTest();
    if (videoSrc) {
      URL.revokeObjectURL(videoSrc);
    }
    setVideoSrc(null);
    setIsVideoFileMode(false);
    setVideoElement(null);
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
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-xl font-bold text-red-600 mb-4">エラーが発生しました</h2>
          <p className="text-gray-700 mb-6 text-sm">{error}</p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 text-sm"
            >
              リロード
            </button>
            <button 
              onClick={handleBackToCamera}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm"
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-6 rounded-lg shadow-lg text-center max-w-sm w-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold mb-2">
            {isInitializing ? 'MediaPipeを初期化中...' : 'モデルを読み込み中...'}
          </h2>
          <p className="text-gray-600 text-sm">しばらくお待ちください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="test-analysis-view min-h-screen bg-gray-50">
      <header className="app-header bg-white shadow-sm p-4 md:p-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">腰椎コントロール評価システム</h1>
        <div className="test-selector">
          <h2 className="text-lg md:text-xl font-semibold mb-3">評価項目選択:</h2>
          <div className="flex flex-wrap gap-2 md:gap-3">
            {Object.values(TestType).map((type) => (
              <button
                key={type}
                className={`px-3 md:px-6 py-2 md:py-3 rounded-lg font-medium transition-colors text-xs md:text-sm ${
                  currentTest === type 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } ${testStatus === 'running' ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => setCurrentTest(type)}
                disabled={testStatus === 'running'}
              >
                {testTypeLabels[type]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 md:mt-6 flex flex-col md:flex-row gap-3">
          <label
            htmlFor="video-upload"
            className="inline-block bg-green-500 text-white font-bold py-2 px-4 rounded cursor-pointer hover:bg-green-600 transition-colors text-sm text-center"
          >
            📁 動画ファイルを選択して解析
          </label>
          <input
            id="video-upload"
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={testStatus === 'running'}
          />
          {isVideoFileMode && (
            <button
              onClick={handleBackToCamera}
              className="bg-gray-500 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 transition-colors text-sm"
              disabled={testStatus === 'running'}
            >
              📷 カメラに戻る
            </button>
          )}
        </div>
        
        {videoSrc && (
          <p className="mt-2 text-sm text-green-600">✅ 動画ファイルが選択されました</p>
        )}
      </header>

      <main className="test-content p-4 md:p-6">
        <div className="camera-section w-full max-w-4xl mx-auto mb-6">
          <div 
            ref={videoContainerRef}
            className="video-container relative w-full bg-black rounded-lg overflow-hidden"
            style={{ aspectRatio: '16/9', minHeight: '300px' }}
          >
            {isVideoFileMode ? (
              <video
                ref={videoRefForUpload}
                src={videoSrc || undefined}
                className="w-full h-full object-contain"
                controls
                playsInline
                webkit-playsinline="true"
                onLoadedData={() => setVideoElement(videoRefForUpload.current)}
                style={{ 
                  width: '100%', 
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <CameraView onVideoElement={handleVideoElement} />
            )}
            
            {landmarks && displaySize.width > 0 && displaySize.height > 0 && (
              <PoseOverlay
                landmarks={landmarks}
                videoWidth={videoSize.width}
                videoHeight={videoSize.height}
                containerWidth={displaySize.width}
                containerHeight={displaySize.height}
                isMirrored={!isVideoFileMode}
              />
            )}
            
            {testStatus === 'running' && (
              <div className="absolute top-2 md:top-4 left-2 md:left-4 bg-red-500 text-white px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium">
                🔴 解析中...
              </div>
            )}
          </div>
          
          <div className="test-controls mt-4 text-center">
            {testStatus === 'idle' && (
              <button
                className="bg-blue-500 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg font-semibold text-sm md:text-base hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleStartTest}
                disabled={!currentTest || !isModelReady}
              >
                解析開始
              </button>
            )}
            {testStatus === 'running' && (
              <div className="text-blue-600 font-semibold text-sm md:text-base">解析中...</div>
            )}
            {testStatus === 'completed' && (
              <button 
                className="bg-gray-500 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg font-semibold text-sm md:text-base hover:bg-gray-600 transition-colors"
                onClick={handleReset}
              >
                リセット
              </button>
            )}
          </div>
        </div>
        
        <div className="results-section bg-white rounded-lg shadow-lg p-4 md:p-6">
          {currentTest && currentTestResult ? (
            <div className="test-results">
              <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">{testTypeLabels[currentTest]} 結果</h3>
              <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                <div className="score-display flex justify-center">
                  <div 
                    className="score-circle w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center relative"
                    style={{ 
                      background: `conic-gradient(#4CAF50 0%, #4CAF50 ${currentTestResult.score}%, #f3f3f3 ${currentTestResult.score}%, #f3f3f3 100%)` 
                    }}
                  >
                    <div className="bg-white w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center">
                      <span className="text-xl md:text-2xl font-bold text-gray-800">{Math.round(currentTestResult.score)}</span>
                    </div>
                  </div>
                </div>
                <div className="metrics-list flex-1">
                  <h4 className="font-semibold text-gray-800 mb-3">詳細測定値:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(currentTestResult.metrics).map(([key, value]) => (
                      <div key={key} className="bg-gray-50 p-3 rounded flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">{key}:</span>
                        <span className="text-sm font-bold text-gray-900">
                          {typeof value === 'number' ? 
                            (key.includes('角度') ? `${value.toFixed(1)}°` : value.toFixed(1)) : 
                            value
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="feedback mt-6">
                <h4 className="font-semibold text-gray-800 mb-3">評価結果:</h4>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-line">{currentTestResult.feedback}</p>
                </div>
              </div>
            </div>
          ) : currentTest ? (
            <div className="test-instructions">
              <h3 className="text-xl md:text-2xl font-bold mb-4">{testTypeLabels[currentTest]}</h3>
              <div className="mb-6 p-4 bg-gray-100 rounded-lg text-center">
                <svg width="160" height="120" viewBox="0 0 200 150" className="mx-auto mb-3 max-w-full h-auto">
                  {currentTest === TestType.STANDING_HIP_FLEXION && (
                    <g>
                      <circle cx="100" cy="25" r="12" fill="#007bff" />
                      <line x1="100" y1="37" x2="100" y2="80" stroke="#007bff" strokeWidth="4" />
                      <line x1="100" y1="60" x2="80" y2="45" stroke="#007bff" strokeWidth="3" />
                      <line x1="100" y1="60" x2="120" y2="45" stroke="#007bff" strokeWidth="3" />
                      <line x1="100" y1="80" x2="85" y2="120" stroke="#007bff" strokeWidth="3" />
                      <line x1="100" y1="80" x2="115" y2="120" stroke="#007bff" strokeWidth="3" />
                      <path d="M 120 55 L 140 75 L 135 70 M 140 75 L 135 80" stroke="#ff4444" strokeWidth="2" fill="none" />
                      <text x="100" y="140" textAnchor="middle" fontSize="10" fill="#666">立位前屈</text>
                    </g>
                  )}
                  {currentTest === TestType.ROCK_BACK && (
                    <g>
                      <circle cx="60" cy="40" r="10" fill="#28a745" />
                      <line x1="60" y1="50" x2="60" y2="80" stroke="#28a745" strokeWidth="3" />
                      <line x1="60" y1="65" x2="40" y2="55" stroke="#28a745" strokeWidth="2" />
                      <line x1="60" y1="65" x2="80" y2="55" stroke="#28a745" strokeWidth="2" />
                      <line x1="60" y1="80" x2="80" y2="110" stroke="#28a745" strokeWidth="3" />
                      <line x1="60" y1="80" x2="100" y2="110" stroke="#28a745" strokeWidth="3" />
                      <circle cx="120" cy="60" r="8" fill="#28a745" fillOpacity="0.5" />
                      <path d="M 80 85 Q 100 95 120 60" stroke="#ff4444" strokeWidth="2" fill="none" strokeDasharray="3,3" />
                      <text x="100" y="140" textAnchor="middle" fontSize="10" fill="#666">四つ這いロックバック</text>
                    </g>
                  )}
                  {currentTest === TestType.SITTING_KNEE_EXTENSION && (
                    <g>
                      <circle cx="100" cy="30" r="10" fill="#ffc107" />
                      <line x1="100" y1="40" x2="100" y2="70" stroke="#ffc107" strokeWidth="3" />
                      <line x1="100" y1="55" x2="85" y2="45" stroke="#ffc107" strokeWidth="2" />
                      <line x1="100" y1="55" x2="115" y2="45" stroke="#ffc107" strokeWidth="2" />
                      <rect x="85" y="70" width="30" height="10" fill="#8B4513" />
                      <line x1="100" y1="70" x2="100" y2="90" stroke="#ffc107" strokeWidth="3" />
                      <line x1="100" y1="90" x2="130" y2="95" stroke="#ffc107" strokeWidth="3" />
                      <line x1="100" y1="90" x2="85" y2="110" stroke="#ffc107" strokeWidth="2" strokeDasharray="2,2" />
                      <text x="100" y="140" textAnchor="middle" fontSize="10" fill="#666">座位膝伸展</text>
                    </g>
                  )}
                </svg>
                <p className="text-xs md:text-sm text-gray-600 font-medium">評価動作の例</p>
              </div>
              
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-2">📋 実行方法:</h4>
                <p className="text-sm text-gray-600 leading-relaxed mb-3">
                  {testInstructions[currentTest]}
                </p>
                
                <h5 className="font-medium text-gray-700 mb-2">評価ポイント:</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {testDetails[currentTest].map((detail, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-blue-500 mr-2 flex-shrink-0">•</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2">⚠️ 注意事項:</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li className="flex items-start">
                    <span className="mr-2 flex-shrink-0">•</span>
                    <span>全身がカメラに映るように調整してください</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 flex-shrink-0">•</span>
                    <span>十分な照明を確保してください</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 flex-shrink-0">•</span>
                    <span>動作はゆっくりと行ってください</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 flex-shrink-0">•</span>
                    <span>痛みを感じた場合は中止してください</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 flex-shrink-0">•</span>
                    <span>安全な場所で実施してください</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="no-results">
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🏥</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">評価項目を選択してください</h3>
                <p className="text-sm text-gray-500 mb-4">
                  上部のボタンから実施したい評価項目を選択してください。
                </p>
                <div className="bg-blue-50 p-4 rounded-lg text-left">
                  <h4 className="font-semibold text-blue-800 mb-2">システム概要:</h4>
                  <p className="text-sm text-blue-700 leading-relaxed">
                    このシステムは理学療法士向けの腰椎コントロール評価ツールです。
                    各評価項目では、腰椎屈曲の制御能力を定量的に評価し、
                    改善点や運動指導のポイントを提供します。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
