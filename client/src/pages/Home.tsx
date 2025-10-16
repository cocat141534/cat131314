import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  GameResult, 
  predictWithScores, 
  savePredictionRecord, 
  updatePredictionResult,
  getPredictionStats,
  PredictionRecord
} from "@/lib/predictor";
import { APP_TITLE } from "@/const";
import { CheckCircle2, XCircle } from "lucide-react";

export default function Home() {
  const [history, setHistory] = useState<GameResult[]>([]);
  const [prediction, setPrediction] = useState<GameResult[]>([]);
  const [currentPredictionTimestamp, setCurrentPredictionTimestamp] = useState<number | null>(null);
  const [scores, setScores] = useState<{
    markov: number;
    pattern: number;
    frequency: number;
    total: number;
  } | null>(null);
  const [stats, setStats] = useState(getPredictionStats());
  const [showFeedback, setShowFeedback] = useState(false);

  const addResult = (result: GameResult) => {
    const newHistory = [...history, result];
    setHistory(newHistory);
    
    // 自動生成新預測
    generatePrediction(newHistory);
  };

  const generatePrediction = (currentHistory: GameResult[]) => {
    if (currentHistory.length === 0) {
      setPrediction([]);
      setScores(null);
      setShowFeedback(false);
      return;
    }

    const result = predictWithScores(currentHistory, 7);
    setPrediction(result.prediction);
    setScores(result.scores);
    
    // 儲存預測記錄
    const timestamp = Date.now();
    const record: PredictionRecord = {
      history: [...currentHistory],
      prediction: result.prediction,
      timestamp,
      scores: result.scores,
    };
    savePredictionRecord(record);
    setCurrentPredictionTimestamp(timestamp);
    setShowFeedback(true);
  };

  const handleFeedback = (success: boolean) => {
    if (currentPredictionTimestamp) {
      updatePredictionResult(currentPredictionTimestamp, success);
      setStats(getPredictionStats());
      setShowFeedback(false);
      setCurrentPredictionTimestamp(null);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    setPrediction([]);
    setScores(null);
    setShowFeedback(false);
    setCurrentPredictionTimestamp(null);
  };

  const removeLastResult = () => {
    if (history.length > 0) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      generatePrediction(newHistory);
    }
  };

  // 計算統計數據
  const bankerCount = history.filter(r => r === 'B').length;
  const playerCount = history.filter(r => r === 'P').length;
  const tieCount = history.filter(r => r === 'T').length;

  useEffect(() => {
    setStats(getPredictionStats());
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container py-6">
          <h1 className="text-3xl font-bold text-primary">{APP_TITLE}</h1>
          <p className="text-muted-foreground mt-2">組合評分預測系統 - 三演算法智能分析</p>
        </div>
      </header>

      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Input & History */}
          <div className="space-y-6">
            {/* Input Section */}
            <Card className="border-primary/20 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl">輸入開牌記錄</CardTitle>
                <CardDescription>點擊按鈕記錄每一局的結果</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Button 
                    onClick={() => addResult('B')} 
                    className="h-16 text-lg font-bold bg-red-600 hover:bg-red-700 text-white"
                  >
                    莊 (B)
                  </Button>
                  <Button 
                    onClick={() => addResult('P')} 
                    className="h-16 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    閒 (P)
                  </Button>
                  <Button 
                    onClick={() => addResult('T')} 
                    className="h-16 text-lg font-bold bg-green-600 hover:bg-green-700 text-white"
                  >
                    和 (T)
                  </Button>
                </div>
                <div className="flex gap-3">
                  <Button 
                    onClick={removeLastResult} 
                    variant="outline" 
                    className="flex-1"
                    disabled={history.length === 0}
                  >
                    撤銷上一筆
                  </Button>
                  <Button 
                    onClick={clearHistory} 
                    variant="destructive" 
                    className="flex-1"
                    disabled={history.length === 0}
                  >
                    清除全部
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* History Display */}
            <Card className="border-primary/20 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl">歷史記錄</CardTitle>
                <CardDescription>
                  已記錄 {history.length} 局 
                  {history.length > 0 && (
                    <span className="ml-2">
                      (莊: {bankerCount} / 閒: {playerCount} / 和: {tieCount})
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    尚無記錄,請開始輸入開牌結果
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {history.map((result, index) => (
                      <div
                        key={index}
                        className={`
                          w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm text-white
                          ${result === 'B' ? 'bg-red-600' : result === 'P' ? 'bg-blue-600' : 'bg-green-600'}
                        `}
                      >
                        {result}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats Card */}
            {stats.total > 0 && (
              <Card className="border-primary/20 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">預測統計</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">總預測次數:</span>
                    <span className="font-bold">{stats.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">成功次數:</span>
                    <span className="font-bold text-green-500">{stats.success}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">失敗次數:</span>
                    <span className="font-bold text-red-500">{stats.failure}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">待回饋:</span>
                    <span className="font-bold text-yellow-500">{stats.pending}</span>
                  </div>
                  <div className="border-t border-border/50 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-semibold">準確率:</span>
                      <span className="font-bold text-primary text-lg">
                        {stats.successRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Predictions */}
          <div className="space-y-6">
            {/* Prediction Result */}
            <Card className="border-primary/20 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl">預測結果 (接下來7局)</CardTitle>
                <CardDescription>基於三種演算法的綜合評分</CardDescription>
              </CardHeader>
              <CardContent>
                {prediction.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    請先輸入至少一筆歷史記錄
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* 預測序列 */}
                    <div className="flex justify-center gap-3 flex-wrap">
                      {prediction.map((result, index) => (
                        <div
                          key={index}
                          className={`
                            w-16 h-16 rounded-lg flex flex-col items-center justify-center font-bold text-white shadow-lg
                            ${result === 'B' ? 'bg-red-600' : 'bg-blue-600'}
                          `}
                        >
                          <div className="text-xs opacity-70">第{index + 1}</div>
                          <div className="text-2xl">{result === 'B' ? '莊' : '閒'}</div>
                        </div>
                      ))}
                    </div>

                    {/* 回饋按鈕 */}
                    {showFeedback && (
                      <div className="border-t border-border/50 pt-4">
                        <p className="text-sm text-muted-foreground mb-3 text-center">
                          預測結果是否正確?
                        </p>
                        <div className="flex gap-3">
                          <Button
                            onClick={() => handleFeedback(true)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            預測成功
                          </Button>
                          <Button
                            onClick={() => handleFeedback(false)}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            預測失敗
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Algorithm Scores */}
            {scores && (
              <Card className="border-primary/20 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">演算法評分</CardTitle>
                  <CardDescription>三種演算法的詳細分數</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">馬可夫鏈 (40%)</span>
                      <span className="font-bold text-primary">
                        {scores.markov.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${scores.markov}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">模式延續 (35%)</span>
                      <span className="font-bold text-blue-500">
                        {scores.pattern.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${scores.pattern}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">頻率平衡 (25%)</span>
                      <span className="font-bold text-green-500">
                        {scores.frequency.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-600 transition-all duration-300"
                        style={{ width: `${scores.frequency}%` }}
                      />
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-3 mt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">綜合評分</span>
                      <span className="font-bold text-primary text-xl">
                        {scores.total.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>本系統僅供參考,不構成任何投注建議。請理性娛樂,謹慎決策。</p>
        </div>
      </main>
    </div>
  );
}

