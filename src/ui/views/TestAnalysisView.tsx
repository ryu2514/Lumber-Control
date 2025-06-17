// src/ui/views/TestAnalysisView.tsx (最終完成版)

import { useState, useEffect, useRef } from 'react';
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

// テストごとのお手本画像のパスを定義
const exampleImages: Partial<Record<TestType, string>> = {
  [TestType.WAITERS_BOW]: '/images/waiters-bow-example.png', // このパスはpublicフォルダからの相対パスです
  [TestType.PELVIC_TILT]: '/images/pelvic-tilt-example.png',
  // 他のテストのお手本画像もここに追加できます
};

export const TestAnalysisView: React.FC = () => {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const videoRefForUpload = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
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

  const { isModelReady } = usePoseAnalysis({
    videoElement,
    loop: !videoSrc,
  });

  useEffect(() => {
    if (videoElement) {
      const updateSize = () => {
        setVideoSize({
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
        });
      };
      videoElement.addEventListener('loadedmetadata', updateSize);
      if (videoElement.videoWidth) {
        updateSize();
      }
      return () => {
        videoElement.removeEventListener('loadedmetadata', updateSize);
      };
    }
  }, [videoElement]);

  const handleVideoElement = (video: HTMLVideoElement) => {
    setVideoElement(video);
  };

  const handleStartTest = () => {
    if (videoSrc && videoRefForUpload.current) {
      videoRefForUpload.current.play();
      setVideoElement(videoRefForUpload.current);
    }
    startTest();
  };

  const currentTestResult = currentTest ? analysisResults[currentTest] : undefined;
  const exampleImageSrc = currentTest ? exampleImages[currentTest] : null;

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
      </header>

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
      </div>

      <main className="test-content">
        {/* --- ↓↓↓ ここが【左側の動画・解析エリア】です ↓↓↓ --- */}
        <div className="camera-section">
          <div className="video-container" style={{ position: 'relative' }}>
            {/* 映像表示ロジック */}
            {videoSrc ? (
              <video
                ref={videoRefForUpload}
                src={videoSrc}
                className="w-full h-auto"
                controls
                onLoadedData={() => setVideoElement(videoRefForUpload.current)}
              />
            ) : (
              <CameraView onVideoElement={handleVideoElement} />
            )}

            {/* ★★★【最重要】骨格の線（PoseOverlay）をここに配置します！ ★★★ */}
            {landmarks && videoSize.width > 0 && (
              <PoseOverlay
                landmarks={landmarks}
                videoWidth={videoSize.width}
                videoHeight={videoSize.height}
              />
            )}
          </div>

          <div className="test-controls">
            {/* ボタン類 */}
            {testStatus === 'idle' && (
              <button className="start-button" onClick={handleStartTest} disabled={!currentTest || !isModelReady}>
                分析開始
              </button>
            )}
            {testStatus === 'running' && <div className="status-running">分析中...</div>}
            {testStatus === 'completed' && <button className="reset-button" onClick={resetTest}>リセット</button>}
          </div>
        </div>

        {/* --- ↓↓↓ ここが【右側の結果・お手本エリア】です ↓↓↓ --- */}
        <div className="results-section">
          {/* テスト結果がある場合は、結果を表示 */}
          {currentTest && currentTestResult ? (
            <div className="test-results">
              <h3>{testTypeLabels[currentTest]} 結果</h3>
              <div className="score-display">
                <div className="score-circle" style={{ background: `conic-gradient(#4CAF50 0%, #4CAF50 ${currentTestResult.score}%, #f3f3f3 ${currentTestResult.score}%, #f3f3f3 100%)` }}>
                  <span className="score-value">{Math.round(currentTestResult.score)}</span>
                </div>
              </div>
              <div className="metrics-list">
                {Object.entries(currentTestResult.metrics).map(([key, value]) => (
                  <div key={key} className="metric-item">
                    <span className="metric-label">{key}:</span>
                    <span className="metric-value">{typeof value === 'number' ? value.toFixed(2) : value}</span>
                  </div>
                ))}
              </div>
              <div className="feedback">
                <h4>フィードバック:</h4>
                <p>{currentTestResult.feedback}</p>
              </div>
            </div>
          ) : exampleImageSrc ? (
            // 結果がなく、お手本画像がある場合は、お手本画像を表示
            <div className="example-image-container">
              <img src={exampleImageSrc} alt="テストのお手本" className="w-full h-auto" />
            </div>
          ) : (
            // それ以外の場合は、プロンプトメッセージを表示
            <div className="no-results">
              {currentTest ? <p>テストを開始してください。</p> : <p>テストを選択してください。</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};