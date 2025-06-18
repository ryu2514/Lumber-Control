import { TestProtocol } from './types'
import { TestType, PoseLandmarkType } from '../mediapipe/types'

export const TEST_PROTOCOLS: Record<TestType, TestProtocol> = {
  [TestType.STANDING_HIP_FLEXION]: {
    name: '立位股関節屈曲テスト',
    description: '立位で片足を90度まで持ち上げ、腰椎の安定性を評価',
    instructions: [
      '足を肩幅に開いて立ってください',
      '手は腰に当てます',
      '右足をゆっくり90度まで持ち上げます',
      '3秒間保持してください',
      'ゆっくりと元の位置に戻します',
      '左足でも同様に行います'
    ],
    duration: 15,
    requiredLandmarks: [
      PoseLandmarkType.LEFT_SHOULDER,
      PoseLandmarkType.RIGHT_SHOULDER,
      PoseLandmarkType.LEFT_HIP,
      PoseLandmarkType.RIGHT_HIP,
      PoseLandmarkType.LEFT_KNEE,
      PoseLandmarkType.RIGHT_KNEE,
      PoseLandmarkType.LEFT_ANKLE,
      PoseLandmarkType.RIGHT_ANKLE
    ],
    evaluationCriteria: {
      lumbarStability: {
        weight: 0.4,
        thresholds: {
          excellent: 90,
          good: 75,
          fair: 60,
          poor: 45
        }
      },
      trunkControl: {
        weight: 0.3,
        thresholds: {
          excellent: 90,
          good: 75,
          fair: 60,
          poor: 45
        }
      },
      movementPattern: {
        weight: 0.2,
        thresholds: {
          excellent: 90,
          good: 75,
          fair: 60,
          poor: 45
        }
      },
      compensatoryMovement: {
        weight: 0.1,
        thresholds: {
          excellent: 90,
          good: 75,
          fair: 60,
          poor: 45
        }
      }
    }
  },
  
  [TestType.ROCK_BACK]: {
    name: '四つ這い後方移動テスト',
    description: '四つ這い位から後方へ移動し、腰椎の制御能力を評価',
    instructions: [
      '四つ這い位になってください',
      '手は肩の真下、膝は股関節の真下に置きます',
      'お尻をかかとに向けてゆっくり後方に移動します',
      '腰椎のカーブを保ちながら行います',
      '元の位置にゆっくり戻ります',
      '5回繰り返します'
    ],
    duration: 20,
    requiredLandmarks: [
      PoseLandmarkType.LEFT_SHOULDER,
      PoseLandmarkType.RIGHT_SHOULDER,
      PoseLandmarkType.LEFT_ELBOW,
      PoseLandmarkType.RIGHT_ELBOW,
      PoseLandmarkType.LEFT_WRIST,
      PoseLandmarkType.RIGHT_WRIST,
      PoseLandmarkType.LEFT_HIP,
      PoseLandmarkType.RIGHT_HIP,
      PoseLandmarkType.LEFT_KNEE,
      PoseLandmarkType.RIGHT_KNEE
    ],
    evaluationCriteria: {
      lumbarStability: {
        weight: 0.45,
        thresholds: {
          excellent: 90,
          good: 75,
          fair: 60,
          poor: 45
        }
      },
      trunkControl: {
        weight: 0.35,
        thresholds: {
          excellent: 90,
          good: 75,
          fair: 60,
          poor: 45
        }
      },
      movementPattern: {
        weight: 0.15,
        thresholds: {
          excellent: 90,
          good: 75,
          fair: 60,
          poor: 45
        }
      },
      compensatoryMovement: {
        weight: 0.05,
        thresholds: {
          excellent: 90,
          good: 75,
          fair: 60,
          poor: 45
        }
      }
    }
  },
  
  [TestType.SITTING_KNEE_EXTENSION]: {
    name: '座位膝伸展テスト',
    description: '座位で膝を伸展し、腰椎の安定性を評価',
    instructions: [
      '椅子に背筋を伸ばして座ってください',
      '足は床にしっかりつけます',
      '手は太ももの上に置きます',
      '右膝をゆっくり伸ばします',
      '腰椎のカーブを保ちながら行います',
      '3秒間保持してから戻します',
      '左膝でも同様に行います'
    ],
    duration: 12,
    requiredLandmarks: [
      PoseLandmarkType.LEFT_SHOULDER,
      PoseLandmarkType.RIGHT_SHOULDER,
      PoseLandmarkType.LEFT_HIP,
      PoseLandmarkType.RIGHT_HIP,
      PoseLandmarkType.LEFT_KNEE,
      PoseLandmarkType.RIGHT_KNEE,
      PoseLandmarkType.LEFT_ANKLE,
      PoseLandmarkType.RIGHT_ANKLE
    ],
    evaluationCriteria: {
      lumbarStability: {
        weight: 0.4,
        thresholds: {
          excellent: 90,
          good: 75,
          fair: 60,
          poor: 45
        }
      },
      trunkControl: {
        weight: 0.3,
        thresholds: {
          excellent: 90,
          good: 75,
          fair: 60,
          poor: 45
        }
      },
      movementPattern: {
        weight: 0.2,
        thresholds: {
          excellent: 90,
          good: 75,
          fair: 60,
          poor: 45
        }
      },
      compensatoryMovement: {
        weight: 0.1,
        thresholds: {
          excellent: 90,
          good: 75,
          fair: 60,
          poor: 45
        }
      }
    }
  }
}