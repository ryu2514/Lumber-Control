// TestAnalysisView.tsx (正しい型対応版)

import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../../state/store';
import { usePoseAnalysis } from '../hooks/usePoseAnalysis';
import { useVideoAnalysis } from '../hooks/useVideoAnalysis';
import { PoseOverlay } from '../components/PoseOverlay';
import { CameraView } from '../components/CameraView';
import { VideoUpload } from '../components/VideoUpload';
import { TestType } from '../../types';

export const TestAnalysisView: React.FC = () => {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'camera' | 'video'>('camera');
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);

  const {
    currentTest,
    testStatus,
    resetTest,
    setCurrentTest,
    startTest,
    stopTest,
  } = useAppStore();

  const { landmarks, isAnalyzing, error, testResult, startAnalysis, stopAnalysis, initializeMediaPipe } = usePoseAnalysis();
  const [isInitialized, setIsInitialized] = useState(false);
  const { 
    landmarks: videoLandmarks, 
    isAnalyzing: isVideoAnalyzing, 
    error: videoError, 
    progress: videoProgress,
    testResult: videoTestResult,
    analyzeVideo, 
    stopAnalysis: stopVideoAnalysis,
    initializeMediaPipe: initializeVideoMediaPipe 
  } = useVideoAnalysis();
  const [isVideoInitialized, setIsVideoInitialized] = useState(false);

  // テスト名のマッピング
  const getTestName = (testType: TestType) => {
    switch (testType) {
      case TestType.STANDING_HIP_FLEXION:
        return '立位股関節屈曲テスト';
      case TestType.ROCK_BACK:
        return 'ロックバックテスト';
      case TestType.SITTING_KNEE_EXTENSION:
        return '座位膝伸展テスト';
      default:
        return 'ポーズ解析テスト';
    }
  };

  const getTestDescription = (testType: TestType) => {
    switch (testType) {
      case TestType.STANDING_HIP_FLEXION:
        return '立った状態で股関節の屈曲動作を解析します';
      case TestType.ROCK_BACK:
        return '後方への体重移動動作を解析します';
      case TestType.SITTING_KNEE_EXTENSION:
        return '座った状態での膝伸展動作を解析します';
      default:
        return 'MediaPipeを使用したポーズ解析';
    }
  };

  // カメラビデオ要素を受け取る
  const handleVideoElement = (video: HTMLVideoElement) => {
    setVideoElement(video);
    setVideoSize({ width: 640, height: 480 });
    console.log('📹 カメラ要素受信完了', video);
  };

  // MediaPipe初期化を手動実行
  const handleInitializeMediaPipe = async () => {
    console.log('🚀 手動MediaPipe初期化開始');
    const success = await initializeMediaPipe();
    setIsInitialized(success);
    if (success) {
      console.log('✅ MediaPipe初期化成功');
    } else {
      console.error('❌ MediaPipe初期化失敗');
    }
  };

  // 動画用MediaPipe初期化を手動実行
  const handleInitializeVideoMediaPipe = async () => {
    console.log('🚀 動画用MediaPipe初期化開始');
    const success = await initializeVideoMediaPipe();
    setIsVideoInitialized(success);
    if (success) {
      console.log('✅ 動画用MediaPipe初期化成功');
    } else {
      console.error('❌ 動画用MediaPipe初期化失敗');
    }
  };

  // 動画ファイル選択時の処理
  const handleVideoSelected = (video: HTMLVideoElement) => {
    console.log('📹 動画要素受信:', video, {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      readyState: video.readyState
    });
    
    setVideoElement(video);
    setVideoSize({ 
      width: video.videoWidth || 640, 
      height: video.videoHeight || 480 
    });
    
    console.log('📹 動画ファイル選択完了、要素設定済み');
  };

  const handleVideoFile = (file: File) => {
    console.log('📁 動画ファイル設定:', file.name);
    setUploadedVideo(file);
  };

  // 動画解析開始
  const handleStartVideoAnalysis = async () => {
    console.log('🎬 動画解析開始ボタンクリック:', {
      hasVideoElement: !!videoElement,
      analysisMode,
      currentTest,
      uploadedVideo: uploadedVideo?.name
    });

    if (videoElement && analysisMode === 'video' && currentTest && uploadedVideo) {
      console.log('🚀 動画解析開始');
      startTest();
      try {
        await analyzeVideo(videoElement, currentTest);
        console.log('✅ 動画解析完了');
      } catch (error) {
        console.error('❌ 動画解析エラー:', error);
      }
      stopTest();
    } else {
      console.warn('⚠️ 動画解析開始条件不足:', {
        videoElement: !!videoElement,
        analysisMode,
        currentTest,
        uploadedVideo: !!uploadedVideo
      });
    }
  };

  // 解析開始/停止
  useEffect(() => {
    console.log('🔍 解析状態チェック:', {
      testStatus,
      hasVideoElement: !!videoElement,
      analysisMode,
      isAnalyzing,
      currentTest
    });

    if (testStatus === 'running' && videoElement && analysisMode === 'camera' && !isAnalyzing && currentTest) {
      console.log('🎯 カメラテスト開始 - MediaPipe解析開始');
      startAnalysis(videoElement, currentTest);
    } else if (testStatus === 'idle' && isAnalyzing) {
      console.log('⏹️ テスト停止 - MediaPipe解析停止');
      stopAnalysis();
    }
  }, [testStatus, videoElement, isAnalyzing, startAnalysis, stopAnalysis, analysisMode, currentTest]);

  // デフォルトテストを設定
  useEffect(() => {
    if (!currentTest) {
      setCurrentTest(TestType.STANDING_HIP_FLEXION);
    }
  }, [currentTest, setCurrentTest]);

  if (!currentTest) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">テストを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">{getTestName(currentTest)}</h2>
        <p className="text-gray-600 mb-6">{getTestDescription(currentTest)}</p>

        {/* 解析モード選択 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            解析モード
          </label>
          <div className="flex space-x-4">
            <button
              onClick={() => setAnalysisMode('camera')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                analysisMode === 'camera'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              disabled={testStatus === 'running'}
            >
              📹 リアルタイムカメラ
            </button>
            <button
              onClick={() => setAnalysisMode('video')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                analysisMode === 'video'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              disabled={testStatus === 'running'}
            >
              📁 動画ファイル
            </button>
          </div>
        </div>

        {/* 動画アップロード */}
        {analysisMode === 'video' && (
          <div className="mb-6">
            <VideoUpload 
              onVideoSelected={handleVideoSelected}
              onVideoFile={handleVideoFile}
            />
          </div>
        )}

        {/* 動画表示エリア */}
        <div className="relative mb-6">
          <div 
            ref={videoContainerRef}
            className="relative w-full bg-black rounded-lg overflow-hidden"
            style={{ aspectRatio: '4/3', minHeight: '400px' }}
          >
            {/* カメラビュー */}
            {analysisMode === 'camera' && (
              <CameraView onVideoElement={handleVideoElement} />
            )}
            
            {/* MediaPipe ポーズオーバーレイ */}
            <PoseOverlay
              landmarks={analysisMode === 'camera' ? landmarks : videoLandmarks}
              videoWidth={videoSize.width}
              videoHeight={videoSize.height}
              containerWidth={videoContainerRef.current?.clientWidth}
              containerHeight={videoContainerRef.current?.clientHeight}
              isMirrored={analysisMode === 'camera'}
            />
          </div>

          {/* ステータス表示 */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg">
            {(analysisMode === 'camera' && isAnalyzing) || (analysisMode === 'video' && isVideoAnalyzing) ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>📡 解析中...</span>
                {analysisMode === 'video' && (
                  <span>({Math.round(videoProgress)}%)</span>
                )}
              </div>
            ) : testStatus === 'completed' ? (
              <span>✅ 解析完了</span>
            ) : (
              <span>📡 準備完了</span>
            )}
          </div>

          {/* エラー表示 */}
          {(error || videoError) && (
            <div className="absolute bottom-4 left-4 bg-red-600 text-white px-3 py-2 rounded-lg max-w-md">
              ❌ {error || videoError}
            </div>
          )}

          {/* ランドマーク情報 */}
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg">
            🎯 検出: {(analysisMode === 'camera' ? landmarks : videoLandmarks).length}/33 点
          </div>
        </div>

        {/* テスト選択 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            テスト選択
          </label>
          <select
            value={currentTest}
            onChange={(e) => setCurrentTest(e.target.value as TestType)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            disabled={testStatus === 'running'}
          >
            <option value={TestType.STANDING_HIP_FLEXION}>立位股関節屈曲テスト</option>
            <option value={TestType.ROCK_BACK}>ロックバックテスト</option>
            <option value={TestType.SITTING_KNEE_EXTENSION}>座位膝伸展テスト</option>
          </select>
        </div>

        {/* デバッグ情報 */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-4 bg-gray-100 rounded-lg text-sm">
            <h4 className="font-bold mb-2">🔧 デバッグ情報</h4>
            <div className="grid grid-cols-3 gap-2">
              {analysisMode === 'camera' ? (
                <>
                  <div>カメラ: {videoElement ? '✅' : '❌'}</div>
                  <div>MediaPipe: {isInitialized ? '✅' : '❌'}</div>
                  <div>解析中: {isAnalyzing ? '✅' : '❌'}</div>
                  <div>ランドマーク: {landmarks.length}/33</div>
                </>
              ) : (
                <>
                  <div>動画ファイル: {uploadedVideo ? '✅' : '❌'}</div>
                  <div>動画要素: {videoElement ? '✅' : '❌'}</div>
                  <div>MediaPipe: {isVideoInitialized ? '✅' : '❌'}</div>
                  <div>解析中: {isVideoAnalyzing ? '✅' : '❌'}</div>
                  <div>進捗: {Math.round(videoProgress)}%</div>
                  <div>ランドマーク: {videoLandmarks.length}/33</div>
                </>
              )}
              <div>テスト: {currentTest || '未選択'}</div>
              <div>モード: {analysisMode}</div>
            </div>
          </div>
        )}

        {/* コントロールボタン */}
        <div className="flex space-x-4">
          {/* MediaPipe初期化ボタン */}
          {analysisMode === 'camera' && !isInitialized && (
            <button
              onClick={handleInitializeMediaPipe}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              📦 MediaPipe初期化
            </button>
          )}
          
          {/* 動画用MediaPipe初期化ボタン */}
          {analysisMode === 'video' && !isVideoInitialized && (
            <button
              onClick={handleInitializeVideoMediaPipe}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              📦 動画用MediaPipe初期化
            </button>
          )}

          <button
            onClick={resetTest}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            disabled={testStatus === 'running'}
          >
            リセット
          </button>
          
          {testStatus === 'idle' && (
            <>
              {analysisMode === 'camera' && (
                <button
                  onClick={() => {
                    console.log('🚀 解析開始ボタンクリック', { videoElement, currentTest });
                    if (videoElement && currentTest) {
                      startTest();
                    } else {
                      console.warn('⚠️ 開始条件不足:', { videoElement: !!videoElement, currentTest });
                    }
                  }}
                  disabled={!videoElement || !currentTest || !isInitialized}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  リアルタイム解析開始
                </button>
              )}
              {analysisMode === 'video' && (
                <button
                  onClick={handleStartVideoAnalysis}
                  disabled={!videoElement || !uploadedVideo || !currentTest || !isVideoInitialized}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                >
                  動画解析開始
                </button>
              )}
            </>
          )}
          
          {testStatus === 'running' && (
            <button
              onClick={() => {
                stopTest();
                if (analysisMode === 'video') {
                  stopVideoAnalysis();
                }
              }}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              解析停止
            </button>
          )}
        </div>

        {/* テスト結果表示 */}
        {(testResult || videoTestResult) && (
          <div className="mt-6 p-6 bg-gray-50 rounded-lg">
            <h3 className="text-xl font-bold mb-4">📊 解析結果</h3>
            {(() => {
              const result = analysisMode === 'camera' ? testResult : videoTestResult;
              if (!result) return null;
              
              return (
                <div className="space-y-4">
                  {/* スコア表示 */}
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl font-bold">
                      総合スコア: {Math.round(result.score)}/100
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      result.score >= 80 ? 'bg-green-100 text-green-800' :
                      result.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {result.score >= 80 ? '良好' : result.score >= 60 ? '要改善' : '要注意'}
                    </div>
                  </div>

                  {/* 詳細メトリクス */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(result.metrics).map(([key, value]) => (
                      <div key={key} className="bg-white p-3 rounded-lg">
                        <div className="text-sm text-gray-600">{key}</div>
                        <div className="text-lg font-semibold">
                          {typeof value === 'number' ? Math.round(value) : value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* フィードバック */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">💡 改善提案</h4>
                    <p className="text-blue-800">{result.feedback}</p>
                  </div>

                  {/* 実行時間 */}
                  <div className="text-sm text-gray-500">
                    解析実行時刻: {new Date(result.timestamp).toLocaleString()}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
