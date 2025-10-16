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
  const [isLocked, setIsLocked] = useState(false); // 鎖定輸入按鈕

  const addResult = (result: GameResult) => {
    if (isLocked) return; // 如果鎖定,不允許輸入
    
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
      setIsLocked(false);
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
    setIsLocked(true); // 鎖定輸入按鈕
  };

  const handleFeedback = (success: boolean) => {
    if (currentPredictionTimestamp) {
      updatePredictionResult(currentPredictionTimestamp, success);
      setStats(getPredictionStats());
      setShowFeedback(false);
      setIsLocked(false); // 解鎖輸入按鈕
      
      // 清空歷史,準備下一輪
      setHistory([]);
      setPrediction([]);
      setScores(null);
      setCurrentPredictionTimestamp(null);
    }
  };

  const clearHistory = () => {
    if (isLocked) return; // 鎖定時不允許清除
    
    setHistory([]);
    setPrediction([]);
    setScores(null);
    setShowFeedback(false);
    setCurrentPredictionTimestamp(null);
  };

  const removeLastResult = () => {
    if (isLocked || history.length === 0) return; // 鎖定時不允許撤銷
    
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    generatePrediction(newHistory);
  };

  // 計算統計數據
  const bankerCount = history.filter(r => r === 'B').length;
  const playerCount = history.filter(r => r === 'P').length;
  const tieCount = history.filter(r => r === 'T').length;

  useEffect(() => {
    setStats(getPredictionStats());
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30">
        <div className="container py-6">
          <h1 className="text-4xl font-bold text-primary">{APP_TITLE}</h1>
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
                    disabled={isLocked}
                    className="h-16 text-lg font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    莊 (B)
                  </Button>
                  <Button 
                    onClick={() => addResult('P')} 
                    disabled={isLocked}
                    className="h-16 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    閒 (P)
                  </Button>
                  <Button 
                    onClick={() => addResult('T')} 
                    disabled={isLocked}
                    className="h-16 text-lg font-bold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    和 (T)
                  </Button>
                </div>
                <div className="flex gap-3">
                  <Button 
                    onClick={removeLastResult} 
                    variant="outline" 
                    className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLocked || history.length === 0}
                  >
                    撤銷上一筆
                  </Button>
                  <Button 
                    onClick={clearHistory} 
                    variant="destructive" 
                    className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLocked}
                  >
                    清除全部
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* History Section */}
            <Card className="border-primary/20 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl">歷史記錄</CardTitle>
                <CardDescription>
                  已記錄 {history.length} 局 (莊: {bankerCount} / 閒: {playerCount} / 和: {tieCount})
                </CardDescription>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">尚無記錄,請開始輸入開牌結果</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {history.map((result, index) => (
                      <div
                        key={index}
                        className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md ${
                          result === 'B' ? 'bg-red-600' : result === 'P' ? 'bg-blue-600' : 'bg-green-600'
                        }`}
                      >
                        {result}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Prediction & Stats */}
          <div className="space-y-6">
            {/* Prediction Section */}
            <Card className="border-primary/20 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl">預測結果 (接下來7局)</CardTitle>
                <CardDescription>基於三種演算法的綜合評分</CardDescription>
              </CardHeader>
              <CardContent>
                {prediction.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">請先輸入至少一筆歷史記錄</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {prediction.map((result, index) => (
                        <div
                          key={index}
                          className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center text-white font-bold shadow-lg ${
                            result === 'B' ? 'bg-red-600' : result === 'P' ? 'bg-blue-600' : 'bg-green-600'
                          }`}
                        >
                          <div className="text-xs opacity-75">第{index + 1}</div>
                          <div className="text-2xl">{result}</div>
                        </div>
                      ))}
                    </div>

                    {showFeedback && (
                      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                        <p className="text-center text-sm mb-3">預測結果是否正確?</p>
                        <div className="flex gap-3">
                          <Button
                            onClick={() => handleFeedback(true)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            預測成功
                          </Button>
                          <Button
                            onClick={() => handleFeedback(false)}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
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
                  <CardTitle className="text-xl">演算法評分</CardTitle>
                  <CardDescription>三種演算法的詳細分數</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">馬可夫鏈 (40%)</span>
                      <span className="text-sm font-bold text-yellow-500">{scores.markov.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-yellow-500 h-2 rounded-full transition-all" 
                        style={{ width: `${scores.markov}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">模式延續 (35%)</span>
                      <span className="text-sm font-bold text-blue-500">{scores.pattern.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all" 
                        style={{ width: `${scores.pattern}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">頻率平衡 (25%)</span>
                      <span className="text-sm font-bold text-green-500">{scores.frequency.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all" 
                        style={{ width: `${scores.frequency}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border">
                    <div className="flex justify-between">
                      <span className="font-bold">綜合評分</span>
                      <span className="font-bold text-primary text-lg">{scores.total.toFixed(1)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats Section */}
            <Card className="border-primary/20 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl">預測統計</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>總預測次數:</span>
                  <span className="font-bold">{stats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span>成功次數:</span>
                  <span className="font-bold text-green-500">{stats.success}</span>
                </div>
                <div className="flex justify-between">
                  <span>失敗次數:</span>
                  <span className="font-bold text-red-500">{stats.failure}</span>
                </div>
                <div className="flex justify-between">
                  <span>待回饋:</span>
                  <span className="font-bold text-yellow-500">{stats.pending}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="font-bold">準確率:</span>
                  <span className="font-bold text-primary text-lg">
                    {stats.total > 0 ? `${stats.successRate.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40 mt-12 py-6">
        <div className="container text-center text-sm text-muted-foreground">
          本系統僅供參考,不構成任何投注建議。請理性娛樂,謹慎決策。
        </div>
      </footer>
    </div>
  );
}

