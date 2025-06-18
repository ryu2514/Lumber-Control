// TestAnalysisView.tsx (正しい型対応版)

import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../../state/store';
import { usePoseAnalysis } from '../hooks/usePoseAnalysis';
import { useVideoAnalysis } from '../hooks/useVideoAnalysis';
import { PoseOverlay } from '../components/PoseOverlay';
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

  const { landmarks, isAnalyzing, error, startAnalysis, stopAnalysis } = usePoseAnalysis();
  const { 
    landmarks: videoLandmarks, 
    isAnalyzing: isVideoAnalyzing, 
    error: videoError, 
    progress: videoProgress,
    analyzeVideo, 
    stopAnalysis: stopVideoAnalysis 
  } = useVideoAnalysis();

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

  // カメラ初期化
  useEffect(() => {
    if (analysisMode === 'camera') {
      const initCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
          });
          
          const video = document.createElement('video');
          video.srcObject = stream;
          video.autoplay = true;
          video.playsInline = true;
          video.muted = true;
          
          // ビデオコンテナに追加
          if (videoContainerRef.current) {
            videoContainerRef.current.innerHTML = '';
            videoContainerRef.current.appendChild(video);
          }
          
          setVideoElement(video);
          setVideoSize({ width: 640, height: 480 });
          
          console.log('📹 カメラ初期化完了');
        } catch (error) {
          console.error('❌ カメラ初期化エラー:', error);
        }
      };

      initCamera();
    }

    return () => {
      // クリーンアップ
      if (videoElement?.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [analysisMode]);

  // 動画ファイル選択時の処理
  const handleVideoSelected = (video: HTMLVideoElement) => {
    // ビデオコンテナに追加
    if (videoContainerRef.current) {
      videoContainerRef.current.innerHTML = '';
      videoContainerRef.current.appendChild(video);
    }
    
    setVideoElement(video);
    setVideoSize({ width: video.videoWidth || 640, height: video.videoHeight || 480 });
    
    console.log('📹 動画ファイル選択完了');
  };

  const handleVideoFile = (file: File) => {
    setUploadedVideo(file);
  };

  // 動画解析開始
  const handleStartVideoAnalysis = async () => {
    if (videoElement && analysisMode === 'video') {
      startTest();
      await analyzeVideo(videoElement);
      stopTest();
    }
  };

  // 解析開始/停止
  useEffect(() => {
    if (testStatus === 'running' && videoElement && analysisMode === 'camera' && !isAnalyzing) {
      console.log('🎯 カメラテスト開始 - MediaPipe解析開始');
      startAnalysis(videoElement);
    } else if (testStatus === 'idle' && isAnalyzing) {
      console.log('⏹️ テスト停止 - MediaPipe解析停止');
      stopAnalysis();
    }
  }, [testStatus, videoElement, isAnalyzing, startAnalysis, stopAnalysis, analysisMode]);

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

        {/* コントロールボタン */}
        <div className="flex space-x-4">
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
                  onClick={startTest}
                  disabled={!videoElement}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  リアルタイム解析開始
                </button>
              )}
              {analysisMode === 'video' && (
                <button
                  onClick={handleStartVideoAnalysis}
                  disabled={!videoElement || !uploadedVideo}
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
      </div>
    </div>
  );
};
