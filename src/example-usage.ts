// Example usage of useMetrics with OneEuroFilter

import { useMetrics } from './useMetrics'

// In your React component:
export function ExampleComponent() {
  const { angles, filteredAngles, updateAngles, resetFilters } = useMetrics()

  // Example: Update angles from pose detection
  const handlePoseDetection = (poseResult: any) => {
    if (poseResult?.worldLandmarks?.[0]) {
      const landmarks = poseResult.worldLandmarks[0]
      
      // Calculate raw angles (example)
      const rawAngles = [
        calculateLumbarFlexion(landmarks),    // 腰椎屈曲角
        calculateHipFlexionLeft(landmarks),   // 左股関節屈曲角
        calculateHipFlexionRight(landmarks),  // 右股関節屈曲角
        calculateKneeAngleLeft(landmarks),    // 左膝関節角
        calculateKneeAngleRight(landmarks)    // 右膝関節角
      ]

      // Apply OneEuroFilter (freq=60, minCutoff=1, beta=0)
      updateAngles(rawAngles, Date.now())
    }
  }

  // Reset filters when starting new test
  const startNewTest = () => {
    resetFilters()
  }

  return (
    <div>
      <h3>Raw Angles:</h3>
      <p>{angles.map(a => a.toFixed(1)).join(', ')}</p>
      
      <h3>Filtered Angles (OneEuroFilter):</h3>
      <p>{filteredAngles.map(a => a.toFixed(1)).join(', ')}</p>
      
      <button onClick={startNewTest}>Reset Filters</button>
    </div>
  )
}

// Helper functions (simplified examples)
function calculateLumbarFlexion(landmarks: any[]): number {
  // Simplified lumbar flexion calculation
  const shoulder = { x: (landmarks[11].x + landmarks[12].x) / 2, y: (landmarks[11].y + landmarks[12].y) / 2 }
  const hip = { x: (landmarks[23].x + landmarks[24].x) / 2, y: (landmarks[23].y + landmarks[24].y) / 2 }
  return Math.atan2(hip.y - shoulder.y, hip.x - shoulder.x) * 180 / Math.PI
}

function calculateHipFlexionLeft(landmarks: any[]): number {
  const hip = landmarks[23]
  const knee = landmarks[25]
  const ankle = landmarks[27]
  // Calculate angle between hip-knee and knee-ankle vectors
  return calculateAngle(hip, knee, ankle)
}

function calculateHipFlexionRight(landmarks: any[]): number {
  const hip = landmarks[24]
  const knee = landmarks[26]
  const ankle = landmarks[28]
  return calculateAngle(hip, knee, ankle)
}

function calculateKneeAngleLeft(landmarks: any[]): number {
  return calculateAngle(landmarks[23], landmarks[25], landmarks[27])
}

function calculateKneeAngleRight(landmarks: any[]): number {
  return calculateAngle(landmarks[24], landmarks[26], landmarks[28])
}

function calculateAngle(p1: any, p2: any, p3: any): number {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y }
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y }
  const dot = v1.x * v2.x + v1.y * v2.y
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)
  return Math.acos(dot / (mag1 * mag2)) * 180 / Math.PI
}