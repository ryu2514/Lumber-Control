import { TestType } from '../types'

interface TestProtocolProps {
  testType: TestType
  isActive: boolean
  onStartTest: () => void
  onStopTest: () => void
}

interface TestInstructions {
  name: string
  description: string
  duration: number
  instructions: string[]
  keyPoints: string[]
  evaluation: string[]
}

const TEST_PROTOCOLS: Record<TestType, TestInstructions> = {
  [TestType.STANDING_HIP_FLEXION]: {
    name: '立位股関節屈曲テスト',
    description: '立位で片脚を90度まで持ち上げ、腰椎安定性と体幹制御能力を評価します',
    duration: 15,
    instructions: [
      '足を肩幅に開いて立ってください',
      '両手を腰に当てます',
      '右足をゆっくり90度まで持ち上げます',
      '3秒間保持してください', 
      'ゆっくりと元の位置に戻します',
      '左足でも同様に実施します'
    ],
    keyPoints: [
      '腰椎の過度な屈曲を避ける',
      '骨盤の傾きを最小限に抑える',
      '体幹の安定性を維持する',
      '代償動作の有無を観察'
    ],
    evaluation: [
      '腰椎安定性: 腰椎屈曲角度の変化',
      '体幹制御: 肩・腰のアライメント',
      '動作品質: 動きの滑らかさ',
      '代償動作: 過度な体幹前傾・側屈'
    ]
  },
  
  [TestType.ROCK_BACK]: {
    name: '四つ這い後方移動テスト（ロックバック）',
    description: '四つ這い位から後方へ移動し、腰椎分離動作と深層筋の協調性を評価します',
    duration: 20,
    instructions: [
      '四つ這い位になってください',
      '手は肩の真下、膝は股関節の真下に配置',
      'お尻をかかとに向けてゆっくり後方移動',
      '腰椎のカーブを保ちながら実施',
      '最終ポジションで3秒保持',
      'ゆっくりと開始位置に戻ります',
      '5回繰り返します'
    ],
    keyPoints: [
      '腰椎屈曲の代償動作を避ける',
      '股関節主導の動作パターン',
      '肩甲骨の安定性維持',
      '呼吸パターンの観察'
    ],
    evaluation: [
      '腰椎安定性: 脊椎分離動作の質',
      '股関節可動性: 屈曲角度と制御',
      '体幹制御: 肩甲帯の安定性',
      '協調性: 動作の流暢性'
    ]
  },
  
  [TestType.SITTING_KNEE_EXTENSION]: {
    name: '座位膝関節伸展テスト',
    description: '座位で膝を伸展し、腰椎安定性と下肢の神経動態を評価します',
    duration: 12,
    instructions: [
      '椅子に背筋を伸ばして座ってください',
      '足は床にしっかりとつけます',
      '両手は太ももの上に置きます',
      '右膝をゆっくり伸ばします',
      '腰椎のカーブを保持してください',
      '3秒間保持後、ゆっくり戻します',
      '左膝でも同様に実施します'
    ],
    keyPoints: [
      '腰椎屈曲の代償を最小化',
      '骨盤の後傾を避ける',
      '膝伸展時の体幹姿勢維持',
      '神経症状の有無確認'
    ],
    evaluation: [
      '腰椎安定性: 座位姿勢の保持',
      '体幹制御: 代償動作の程度',
      '動作範囲: 膝伸展可動域',
      '神経動態: 症状誘発の有無'
    ]
  }
}

export function TestProtocol({ testType, isActive, onStartTest, onStopTest }: TestProtocolProps) {
  const protocol = TEST_PROTOCOLS[testType]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{protocol.name}</h2>
        <p className="text-gray-700 mb-4">{protocol.description}</p>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="bg-blue-100 px-3 py-1 rounded-full">
            実施時間: {protocol.duration}秒
          </span>
          <span className="bg-green-100 px-3 py-1 rounded-full">
            評価項目: {protocol.evaluation.length}項目
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Instructions */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-blue-100 text-blue-800 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                1
              </span>
              実施手順
            </h3>
            <ol className="space-y-3">
              {protocol.instructions.map((instruction, index) => (
                <li key={index} className="flex items-start">
                  <span className="bg-gray-100 text-gray-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5 flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-gray-700">{instruction}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-amber-100 text-amber-800 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                !
              </span>
              注意ポイント
            </h3>
            <ul className="space-y-2">
              {protocol.keyPoints.map((point, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-amber-500 mr-2 mt-1">•</span>
                  <span className="text-gray-700">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Evaluation & Controls */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-green-100 text-green-800 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                ✓
              </span>
              評価項目
            </h3>
            <ul className="space-y-3">
              {protocol.evaluation.map((item, index) => (
                <li key={index} className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-gray-900 font-medium">{item.split(':')[0]}:</span>
                  <span className="text-gray-700 ml-1">{item.split(':')[1]}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Test Controls */}
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">テスト実行</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <button
                  onClick={isActive ? onStopTest : onStartTest}
                  className={`flex-1 py-3 px-6 rounded-lg font-medium transition-colors ${
                    isActive
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isActive ? '📹 録画停止' : '▶️ テスト開始'}
                </button>
              </div>
              
              {isActive && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-3"></div>
                    <span className="text-red-700 font-medium">録画中...</span>
                  </div>
                  <p className="text-red-600 text-sm mt-2">
                    {protocol.duration}秒間のテストを実行してください
                  </p>
                </div>
              )}

              <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                <p className="font-medium mb-2">🎯 テスト成功のポイント:</p>
                <ul className="space-y-1">
                  <li>• カメラに全身が映るように立ってください</li>
                  <li>• 明るい場所で実施してください</li>
                  <li>• 動作はゆっくり、正確に行ってください</li>
                  <li>• 痛みがある場合は無理をしないでください</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}