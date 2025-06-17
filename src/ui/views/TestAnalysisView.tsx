// src/ui/views/TestAnalysisView.tsx (完全版)

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

// 画像パスを修正（存在しないパスを削除）
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
      // 既存のURLをクリーンアップ
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

  // エラーハンドリング強化版のusePoseAnalysisを使用
  const { isModelReady, error, isInitializing, landmarkCount } = usePoseAnalysis(videoElement);

  // ビデオサイズの更新
  useEffect(() => {
    if (videoElement) {
      const updateSize = () => {
        setVideoSize({
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
        });
        console.log(`📏 Video size updated: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
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

  // ビデオ要素のコールバック（最適化）
  const handleVideoElement = useCallback((video: HTMLVideoElement) => {
    console.log('📹 Video element received:', !!video);
    setVideoElement(video);
  }, []);

  // テスト開始ハンドラ
  const handleStartTest = () => {
    console.log('🎬 Starting test...', { currentTest, videoSrc: !!videoSrc });
    
    // 動画ファイルが選択されている場合
    if (videoSrc && videoRefForUpload.current) {
      videoRefForUpload.current.currentTime = 0;
      videoRefForUpload.current.play().then(() => {
        setVideoElement(videoRefForUpload.current);
        startTest();
      }).catch(err => {
        console.error('Failed to play video:', err);
      });
    } else if (!videoSrc && videoElement) {
      // ウェブカメラの場合
      startTest();
    }
  };

  // リセットハンドラ
  const handleReset = () => {
    resetTest();
    if (videoSrc && videoRefForUpload.current) {
      videoRefForUpload.current.currentTime = 0;
      videoRefForUpload.current.pause();
    }
  };

  // URLのクリーンアップ
  useEffect(() => {
    return () => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  const currentTestResult = currentTest ? analysisResults[currentTest] : undefined;

  // エラー表示
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

  // ローディング表示
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
    <div className="test-analysis-view min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">理学療法士向け姿勢解析</h1>
        <div className="test-selector">
          <h2 className="text-xl font-semibold mb-3">テスト選択:</h2>
          <div className="flex flex-wrap gap-3">
            {Object.values(TestType).map((type) => (
              <button
                key={type}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentTest === type 
                    ? 'bg-blue-500 text-white' 
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

        {/* ファイルアップロード */}
        <div className="mt-4">
          <label
            htmlFor="video-upload"
            className="inline-block bg-green-500 text-white font-bold py-2 px-4 rounded cursor-pointer hover:bg-green-600 transition-colors"
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
          {videoSrc && (
            <span className="ml-3 text-sm text-green-600">✅ 動画ファイルが選択されました</span>
          )}
        </div>
      </header>

      <main className="p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* カメラ・動画セクション */}
          <div className="lg:col-span-2">
                          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="relative aspect-video bg-black">
                  {videoSrc ? (
                    <video
                      ref={videoRefForUpload}
                      src={videoSrc}
                      className="w-full h-full object-contain"
                      controls
                      onLoadedData={() => {
                        console.log('📹 Video file loaded');
                        setVideoElement(videoRefForUpload.current);
                      }}
                      onError={(e) => {
                        console.error('Video error:', e);
                      }}
                    />
                  ) : (
                    <CameraView onVideoElement={handleVideoElement} />
                  )}
                  
                  {/* ポーズオーバーレイ */}
                  {landmarks && videoSize.width > 0 && videoSize.height > 0 && (
                    <PoseOverlay
                      landmarks={landmarks}
                      videoWidth={videoSize.width}
                      videoHeight={videoSize.height}
                      isMirrored={!videoSrc} // ウェブカメラの時だけ反転
                    />
                  )}
                  
                  {/* ステータス表示 */}
                  {testStatus === 'running' && (
                    <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      🔴 解析中... ({landmarkCount} フレーム)
                    </div>
                  )}
                  
                  {/* MediaPipe準備状況 */}
                  {!isModelReady && (
                    <div className="absolute bottom-4 left-4 bg-yellow-500 text-white px-3 py-1 rounded text-sm">
                      ⏳ MediaPipe準備中...
                    </div>
                  )}
                </div>
                
                {/* コントロールパネル */}
                <div className="p-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {testStatus === 'idle' && (
                        <button
                          className="bg-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={handleStartTest}
                          disabled={!currentTest || !isModelReady}
                        >
                          🎯 分析開始
                        </button>
                      )}
                      
                      {testStatus === 'running' && (
                        <div className="flex items-center gap-2 text-orange-600">
                          <div className="animate-pulse w-2 h-2 bg-orange-500 rounded-full"></div>
                          <span className="font-medium">分析中...</span>
                        </div>
                      )}
                      
                      {testStatus === 'completed' && (
                        <button 
                          className="bg-gray-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-600 transition-colors"
                          onClick={handleReset}
                        >
                          🔄 リセット
                        </button>
                      )}
                    </div>
                    
                    {/* 技術情報 */}
                    <div className="text-sm text-gray-500">
                      <div>📊 履歴: {landmarkCount} フレーム</div>
                      <div>📏 解像度: {videoSize.width}×{videoSize.height}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 結果・説明セクション */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6">
              {currentTest && currentTestResult ? (
                /* 結果表示 */
                <div className="test-results">
                  <h3 className="text-xl font-bold mb-4">{testTypeLabels[currentTest]} 結果</h3>
                  
                  {/* スコア表示 */}
                  <div className="text-center mb-6">
                    <div 
                      className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-2xl font-bold text-white mb-2"
                      style={{ 
                        background: `conic-gradient(#4CAF50 0%, #4CAF50 ${currentTestResult.score}%, #f3f3f3 ${currentTestResult.score}%, #f3f3f3 100%)` 
                      }}
                    >
                      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-gray-800">
                        {Math.round(currentTestResult.score)}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">総合スコア</div>
                  </div>
                  
                  {/* 詳細メトリクス */}
                  <div className="space-y-3 mb-6">
                    <h4 className="font-semibold text-gray-800">詳細データ:</h4>
                    {Object.entries(currentTestResult.metrics).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-600">{key}:</span>
                        <span className="font-medium">
                          {typeof value === 'number' ? `${value.toFixed(1)}°` : value}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {/* フィードバック */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">💡 フィードバック:</h4>
                    <p className="text-blue-700 text-sm leading-relaxed">{currentTestResult.feedback}</p>
                  </div>
                </div>
              ) : currentTest ? (
                /* テスト説明 */
                <div className="test-instructions">
                  <h3 className="text-xl font-bold mb-4">{testTypeLabels[currentTest]}</h3>
                  
                  {/* 説明図（SVGで代替） */}
                  <div className="mb-6 p-4 bg-gray-100 rounded-lg text-center">
                    <svg width="200" height="150" viewBox="0 0 200 150" className="mx-auto mb-3">
                      {currentTest === TestType.WAITERS_BOW && (
                        <g>
                          {/* 頭 */}
                          <circle cx="100" cy="30" r="15" fill="#007bff" />
                          {/* 体幹 */}
                          <line x1="100" y1="45" x2="100" y2="100" stroke="#007bff" strokeWidth="4" />
                          {/* 腕 */}
                          <line x1="100" y1="70" x2="80" y2="50" stroke="#007bff" strokeWidth="3" />
                          <line x1="100" y1="70" x2="120" y2="50" stroke="#007bff" strokeWidth="3" />
                          {/* 脚 */}
                          <line x1="100" y1="100" x2="80" y2="130" stroke="#007bff" strokeWidth="3" />
                          <line x1="100" y1="100" x2="120" y2="130" stroke="#007bff" strokeWidth="3" />
                          {/* 前傾の矢印 */}
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
                  
                  {/* 実行方法 */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-800 mb-2">📋 実行方法:</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {testInstructions[currentTest]}
                    </p>
                  </div>
                  
                  {/* 注意事項 */}
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
                /* テスト未選択 */
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🏥</div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">テストを選択してください</h3>
                  <p className="text-sm text-gray-500">
                    上部のボタンから実施したいテストを選択してください。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};