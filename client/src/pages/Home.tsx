import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GameResult, predictNextN, PredictionResult } from "@/lib/predictor";
import { APP_TITLE } from "@/const";

export default function Home() {
  const [history, setHistory] = useState<GameResult[]>([]);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);

  const addResult = (result: GameResult) => {
    const newHistory = [...history, result];
    setHistory(newHistory);
    
    // 自動更新預測
    const newPredictions = predictNextN(newHistory, 5);
    setPredictions(newPredictions);
  };

  const clearHistory = () => {
    setHistory([]);
    setPredictions([]);
  };

  const removeLastResult = () => {
    if (history.length > 0) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      
      if (newHistory.length > 0) {
        const newPredictions = predictNextN(newHistory, 5);
        setPredictions(newPredictions);
      } else {
        setPredictions([]);
      }
    }
  };

  // 計算統計數據
  const bankerCount = history.filter(r => r === 'B').length;
  const playerCount = history.filter(r => r === 'P').length;
  const tieCount = history.filter(r => r === 'T').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container py-6">
          <h1 className="text-3xl font-bold text-primary">{APP_TITLE}</h1>
          <p className="text-muted-foreground mt-2">基於歷史記錄的智能預測系統</p>
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
          </div>

          {/* Right Column - Predictions */}
          <div>
            <Card className="border-primary/20 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl">預測結果</CardTitle>
                <CardDescription>接下來五局的機率預測</CardDescription>
              </CardHeader>
              <CardContent>
                {predictions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    請先輸入至少一筆歷史記錄
                  </div>
                ) : (
                  <div className="space-y-4">
                    {predictions.map((pred, index) => {
                      const maxProb = Math.max(pred.banker, pred.player, pred.tie);
                      const tendency = 
                        pred.banker === maxProb ? '傾向莊' :
                        pred.player === maxProb ? '傾向閒' : '傾向和';
                      
                      return (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                              第 {index + 1} 局
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {tendency}
                            </span>
                          </div>
                          
                          {/* Banker Probability Bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">莊家</span>
                              <span className="font-bold text-red-500">
                                {(pred.banker * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-red-600 transition-all duration-300"
                                style={{ width: `${pred.banker * 100}%` }}
                              />
                            </div>
                          </div>

                          {/* Player Probability Bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">閒家</span>
                              <span className="font-bold text-blue-500">
                                {(pred.player * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-600 transition-all duration-300"
                                style={{ width: `${pred.player * 100}%` }}
                              />
                            </div>
                          </div>

                          {/* Tie Probability Bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">和局</span>
                              <span className="font-bold text-green-500">
                                {(pred.tie * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-600 transition-all duration-300"
                                style={{ width: `${pred.tie * 100}%` }}
                              />
                            </div>
                          </div>

                          {index < predictions.length - 1 && (
                            <div className="border-t border-border/50 pt-2" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statistics Card */}
            {history.length > 0 && (
              <Card className="border-primary/20 shadow-lg mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">統計資訊</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">總局數:</span>
                    <span className="font-bold">{history.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">莊家勝率:</span>
                    <span className="font-bold text-red-500">
                      {((bankerCount / history.length) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">閒家勝率:</span>
                    <span className="font-bold text-blue-500">
                      {((playerCount / history.length) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">和局機率:</span>
                    <span className="font-bold text-green-500">
                      {((tieCount / history.length) * 100).toFixed(1)}%
                    </span>
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

