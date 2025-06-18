import { TestAnalysis } from '@/lib/mediapipe/types'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface ResultsPanelProps {
  results: TestAnalysis | null
  isAnalyzing: boolean
}

export function ResultsPanel({ results, isAnalyzing }: ResultsPanelProps) {
  if (isAnalyzing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>解析中...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>評価結果</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            テストを実行すると、ここに結果が表示されます。
          </p>
        </CardContent>
      </Card>
    )
  }

  const getScoreColor = (score: number): string => {
    if (score >= 4) return 'text-green-600'
    if (score >= 3) return 'text-yellow-600'
    if (score >= 2) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreLabel = (score: number): string => {
    if (score >= 4) return '優秀'
    if (score >= 3) return '良好'
    if (score >= 2) return '要改善'
    return '要注意'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>評価結果</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">腰椎安定性</div>
            <div className={`text-2xl font-bold ${getScoreColor(results.lumbarStability)}`}>
              {getScoreLabel(results.lumbarStability)}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">体幹制御</div>
            <div className={`text-2xl font-bold ${getScoreColor(results.trunkControl)}`}>
              {getScoreLabel(results.trunkControl)}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">動作パターン</div>
            <div className={`text-2xl font-bold ${getScoreColor(results.movementPattern)}`}>
              {getScoreLabel(results.movementPattern)}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">代償動作</div>
            <div className={`text-2xl font-bold ${getScoreColor(results.compensatoryMovement)}`}>
              {getScoreLabel(results.compensatoryMovement)}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium">推奨事項</h4>
          <ul className="space-y-2">
            {results.recommendations.map((recommendation, index) => (
              <li key={index} className="text-sm text-muted-foreground flex items-start">
                <span className="text-primary mr-2">•</span>
                {recommendation}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}