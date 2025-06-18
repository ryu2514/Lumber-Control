// この内容をPoseOverlay.tsxの124行目付近に一時的に追加

console.log('🔍 ランドマーク詳細分析:');
console.log('最初の10個のランドマーク:', landmarks.slice(0, 10));
console.log('重要ランドマークの可視性:');
importantLandmarks.forEach(index => {
  const landmark = landmarks[index];
  if (landmark) {
    console.log(`ランドマーク${index}: visibility=${landmark.visibility}, x=${landmark.x}, y=${landmark.y}`);
  }
});
