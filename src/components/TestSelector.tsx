import { TestType } from '@/lib/mediapipe/types'
import { TEST_PROTOCOLS } from '@/lib/tests/protocols'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'

interface TestSelectorProps {
  onTestSelect: (testType: TestType) => void
  selectedTest?: TestType
}

export function TestSelector({ onTestSelect, selectedTest }: TestSelectorProps) {
  const tests = Object.entries(TEST_PROTOCOLS)

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {tests.map(([testType, protocol]) => (
        <Card 
          key={testType}
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedTest === testType ? 'ring-2 ring-primary' : ''
          }`}
          onClick={() => onTestSelect(testType as TestType)}
        >
          <CardHeader>
            <CardTitle className="text-lg">{protocol.name}</CardTitle>
            <CardDescription>{protocol.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                実施時間: {protocol.duration}秒
              </p>
              <div className="space-y-1">
                <p className="text-sm font-medium">手順:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {protocol.instructions.slice(0, 3).map((instruction, index) => (
                    <li key={index}>• {instruction}</li>
                  ))}
                  {protocol.instructions.length > 3 && (
                    <li className="italic">... 他{protocol.instructions.length - 3}項目</li>
                  )}
                </ul>
              </div>
            </div>
            <Button 
              className="w-full mt-4" 
              variant={selectedTest === testType ? "default" : "outline"}
            >
              {selectedTest === testType ? '選択中' : 'テストを選択'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}