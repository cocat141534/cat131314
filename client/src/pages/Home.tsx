import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  GameResult, 
  predictWithScores, 
  savePredictionRecord, 
  updatePredictionResult,
  getPredictionStats,
  PredictionRecord
} from "@/lib/predictor";
import { APP_TITLE } from "@/const";
import { CheckCircle2, XCircle, Wallet, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

// 本金比例調整策略
function calculateBetsBasedOnBankroll(remainingBankroll: number, initialBankroll: number): number[] {
  // 標準本金為16,000元,對應激進前置策略
  const standardBankroll = 16000;
  const standardBets = [4000, 4000, 4000, 1000, 1000, 1000, 1000];
  
  // 計算本金比例(相對於標準本金)
  const bankrollRatio = remainingBankroll / standardBankroll;
  
  // 根據本金比例調整賭注
  if (bankrollRatio >= 1.0) {
    // 本金充足(≥16,000),維持激進策略
    return standardBets;
  } else if (bankrollRatio >= 0.5) {
    // 本金8,000-15,999,賭注減半
    return standardBets.map(b => Math.floor(b * 0.5));
  } else if (bankrollRatio >= 0.25) {
    // 本金4,000-7,999,賭注減至1/4
    return standardBets.map(b => Math.floor(b * 0.25));
  } else if (bankrollRatio >= 0.125) {
    // 本金2,000-3,999,賭注減至1/8
    return standardBets.map(b => Math.floor(b * 0.125));
  } else {
    // 本金不足2,000,最保守策略
    const minBet = Math.max(100, Math.floor(remainingBankroll / 20));
    return [minBet, minBet, minBet, minBet, minBet, minBet, minBet];
  }
}

// 獲取風險等級
function getRiskLevel(ratio: number): { level: string; color: string; icon: any } {
  if (ratio >= 1.0) {
    return { level: "安全", color: "text-green-500", icon: TrendingUp };
  } else if (ratio >= 0.5) {
    return { level: "注意", color: "text-yellow-500", icon: AlertTriangle };
  } else if (ratio >= 0.25) {
    return { level: "警告", color: "text-orange-500", icon: TrendingDown };
  } else {
    return { level: "危險", color: "text-red-500", icon: AlertTriangle };
  }
}

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
  const [isLocked, setIsLocked] = useState(false);
  
  // 本金管理
  const [initialBankroll, setInitialBankroll] = useState<number>(16000);
  const [remainingBankroll, setRemainingBankroll] = useState<number>(16000);
  const [bankrollInput, setBankrollInput] = useState<string>("16000");
  const [recommendedBets, setRecommendedBets] = useState<number[]>([4000, 4000, 4000, 1000, 1000, 1000, 1000]);

  const addResult = (result: GameResult) => {
    if (isLocked) return;
    
    const newHistory = [...history, result];
    setHistory(newHistory);
    
    generatePrediction(newHistory);
  };

  const generatePrediction = (currentHistory: GameResult[]) => {
    if (currentHistory.length < 7) {
      setPrediction([]);
      setScores(null);
      setShowFeedback(false);
      setIsLocked(false);
      return;
    }

    const result = predictWithScores(currentHistory, 7);
    setPrediction(result.prediction);
    setScores(result.scores);
    
    // 生成預測記錄
    const timestamp = Date.now();
    setCurrentPredictionTimestamp(timestamp);
    savePredictionRecord({
      timestamp,
      history: currentHistory,
      prediction: result.prediction,
      scores: result.scores,
      success: undefined,
    });
    
    setShowFeedback(true);
    setIsLocked(true);
    
    // 更新推薦賭注
    const newBets = calculateBetsBasedOnBankroll(remainingBankroll, initialBankroll);
    setRecommendedBets(newBets);
  };

  const handleFeedback = (success: boolean) => {
    if (currentPredictionTimestamp) {
      updatePredictionResult(currentPredictionTimestamp, success);
      setStats(getPredictionStats());
    }
    
    // 更新本金
    if (success) {
      // 假設在第1局命中(最常見情況)
      const profit = recommendedBets[0];
      setRemainingBankroll(prev => prev + profit);
    } else {
      // 失敗,虧損全部投入
      const totalLoss = recommendedBets.reduce((sum, bet) => sum + bet, 0);
      setRemainingBankroll(prev => Math.max(0, prev - totalLoss));
    }
    
    // 清空歷史並解鎖
    setHistory([]);
    setPrediction([]);
    setScores(null);
    setShowFeedback(false);
    setIsLocked(false);
    setCurrentPredictionTimestamp(null);
  };

  const undoLast = () => {
    if (isLocked) return;
    if (history.length === 0) return;
    
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    generatePrediction(newHistory);
  };

  const clearAll = () => {
    if (isLocked) return;
    setHistory([]);
    setPrediction([]);
    setScores(null);
    setShowFeedback(false);
    setCurrentPredictionTimestamp(null);
  };

  const handleBankrollUpdate = () => {
    const value = parseInt(bankrollInput);
    if (!isNaN(value) && value > 0) {
      setInitialBankroll(value);
      setRemainingBankroll(value);
      const newBets = calculateBetsBasedOnBankroll(value, value);
      setRecommendedBets(newBets);
    }
  };

  const resetBankroll = () => {
    setRemainingBankroll(initialBankroll);
    const newBets = calculateBetsBasedOnBankroll(initialBankroll, initialBankroll);
    setRecommendedBets(newBets);
  };

  const getResultLabel = (result: GameResult) => {
    switch (result) {
      case 'B': return '莊';
      case 'P': return '閒';
      case 'T': return '和';
    }
  };

  const getResultColor = (result: GameResult) => {
    switch (result) {
      case 'B': return 'bg-red-500';
      case 'P': return 'bg-blue-500';
      case 'T': return 'bg-green-500';
    }
  };

  const bankerCount = history.filter(r => r === 'B').length;
  const playerCount = history.filter(r => r === 'P').length;
  const tieCount = history.filter(r => r === 'T').length;
  
  const bankrollRatio = remainingBankroll / initialBankroll;
  const riskInfo = getRiskLevel(bankrollRatio);
  const RiskIcon = riskInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto py-8 px-4">
        {/* 標題 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-yellow-400 mb-2">{APP_TITLE}</h1>
          <p className="text-gray-400">組合評分預測系統 - 三演算法智能分析</p>
        </div>

        {/* 本金管理區塊 */}
        <Card className="mb-6 bg-gray-800/50 border-yellow-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <Wallet className="w-5 h-5" />
              本金管理系統
            </CardTitle>
            <CardDescription className="text-gray-400">
              根據本金比例動態調整策略 - 智能風險控制
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 本金設定 */}
            <div className="flex gap-2">
              <Input
                type="number"
                value={bankrollInput}
                onChange={(e) => setBankrollInput(e.target.value)}
                placeholder="輸入起始本金"
                className="bg-gray-700 border-gray-600 text-white"
                disabled={isLocked}
              />
              <Button 
                onClick={handleBankrollUpdate}
                disabled={isLocked}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                設定本金
              </Button>
              <Button 
                onClick={resetBankroll}
                variant="outline"
                disabled={isLocked}
                className="border-gray-600"
              >
                重置
              </Button>
            </div>

            {/* 本金狀態 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">起始本金</div>
                <div className="text-2xl font-bold text-white">
                  {initialBankroll.toLocaleString()}元
                </div>
              </div>
              
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">剩餘本金</div>
                <div className={`text-2xl font-bold ${remainingBankroll >= initialBankroll ? 'text-green-400' : remainingBankroll >= initialBankroll * 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {remainingBankroll.toLocaleString()}元
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {(bankrollRatio * 100).toFixed(1)}% 剩餘
                </div>
              </div>
              
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">風險等級</div>
                <div className={`text-2xl font-bold flex items-center gap-2 ${riskInfo.color}`}>
                  <RiskIcon className="w-6 h-6" />
                  {riskInfo.level}
                </div>
              </div>
            </div>

            {/* 推薦賭注 */}
            <div className="bg-gray-700/50 p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">建議賭注分配 (本輪)</div>
              <div className="flex flex-wrap gap-2">
                {recommendedBets.map((bet, index) => (
                  <div key={index} className="bg-gray-600 px-3 py-2 rounded">
                    <div className="text-xs text-gray-400">第{index + 1}局</div>
                    <div className="text-lg font-bold text-yellow-400">{bet.toLocaleString()}元</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                總投入: {recommendedBets.reduce((sum, bet) => sum + bet, 0).toLocaleString()}元
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左側:輸入區 */}
          <div className="space-y-6">
            {/* 輸入開牌記錄 */}
            <Card className="bg-gray-800/50 border-yellow-500/30">
              <CardHeader>
                <CardTitle className="text-yellow-400">輸入開牌記錄</CardTitle>
                <CardDescription className="text-gray-400">
                  點擊按鈕記錄每一局的結果
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    onClick={() => addResult('B')}
                    disabled={isLocked}
                    className="h-20 text-xl font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50"
                  >
                    莊 (B)
                  </Button>
                  <Button
                    onClick={() => addResult('P')}
                    disabled={isLocked}
                    className="h-20 text-xl font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    閒 (P)
                  </Button>
                  <Button
                    onClick={() => addResult('T')}
                    disabled={isLocked}
                    className="h-20 text-xl font-bold bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    和 (T)
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={undoLast}
                    disabled={isLocked || history.length === 0}
                    variant="outline"
                    className="flex-1 border-gray-600 disabled:opacity-50"
                  >
                    撤銷上一筆
                  </Button>
                  <Button
                    onClick={clearAll}
                    disabled={isLocked || history.length === 0}
                    variant="destructive"
                    className="flex-1 bg-red-800 hover:bg-red-900 disabled:opacity-50"
                  >
                    清除全部
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 歷史記錄 */}
            <Card className="bg-gray-800/50 border-yellow-500/30">
              <CardHeader>
                <CardTitle className="text-yellow-400">歷史記錄</CardTitle>
                <CardDescription className="text-gray-400">
                  已記錄 {history.length} 局 (莊: {bankerCount} / 閒: {playerCount} / 和: {tieCount})
                </CardDescription>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    尚無記錄,請開始輸入開牌結果
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {history.map((result, index) => (
                      <div
                        key={index}
                        className={`${getResultColor(result)} text-white px-3 py-2 rounded font-bold`}
                      >
                        {getResultLabel(result)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右側:預測結果 */}
          <div className="space-y-6">
            {/* 預測結果 */}
            <Card className="bg-gray-800/50 border-yellow-500/30">
              <CardHeader>
                <CardTitle className="text-yellow-400">預測結果 (接下來7局)</CardTitle>
                <CardDescription className="text-gray-400">
                  基於三種演算法綜合評分
                </CardDescription>
              </CardHeader>
              <CardContent>
                {prediction.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    請先輸入至少7筆歷史記錄才能生成預測
                    <br />
                    (已輸入 {history.length} / 7 筆)
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-7 gap-2">
                      {prediction.map((result, index) => (
                        <div key={index} className="text-center">
                          <div className="text-xs text-gray-400 mb-1">第{index + 1}局</div>
                          <div className={`${getResultColor(result)} text-white px-2 py-3 rounded font-bold text-lg`}>
                            {getResultLabel(result)}
                          </div>
                          <div className="text-xs text-yellow-400 mt-1">
                            {recommendedBets[index].toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>

                    {scores && (
                      <div className="bg-gray-700/50 p-3 rounded space-y-2">
                        <div className="text-sm text-gray-400">演算法評分:</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>馬可夫鏈: <span className="text-yellow-400 font-bold">{scores.markov.toFixed(1)}</span></div>
                          <div>模式延續: <span className="text-yellow-400 font-bold">{scores.pattern.toFixed(1)}</span></div>
                          <div>頻率平衡: <span className="text-yellow-400 font-bold">{scores.frequency.toFixed(1)}</span></div>
                          <div>綜合評分: <span className="text-yellow-400 font-bold">{scores.total.toFixed(1)}</span></div>
                        </div>
                      </div>
                    )}

                    {showFeedback && (
                      <div className="bg-gray-700/50 p-4 rounded space-y-3">
                        <div className="text-center text-gray-300 font-medium">
                          預測結果是否正確?
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            onClick={() => handleFeedback(true)}
                            className="bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            預測成功
                          </Button>
                          <Button
                            onClick={() => handleFeedback(false)}
                            className="bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2"
                          >
                            <XCircle className="w-5 h-5" />
                            預測失敗
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 預測統計 */}
            <Card className="bg-gray-800/50 border-yellow-500/30">
              <CardHeader>
                <CardTitle className="text-yellow-400">預測統計</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">總預測次數:</span>
                    <span className="text-white font-bold text-xl">{stats.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">成功次數:</span>
                    <span className="text-green-400 font-bold text-xl">{stats.success}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">失敗次數:</span>
                    <span className="text-red-400 font-bold text-xl">{stats.failure}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">待回饋:</span>
                    <span className="text-yellow-400 font-bold text-xl">{stats.pending}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">準確率:</span>
                      <span className="text-yellow-400 font-bold text-2xl">
                        {stats.successRate !== null ? `${stats.successRate}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 說明區塊 */}
        <Card className="mt-6 bg-gray-800/50 border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-yellow-400">說明 & 問題</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-300">
            <div>
              <h3 className="font-bold text-yellow-400 mb-2">網站製作出的預測結果可以相信嗎?</h3>
              <p className="text-red-400 font-bold">不能</p>
              <p className="text-sm text-gray-400">
                ,本網站僅提供數據分析後結果,並不保證100%的準確度及正確性,請自行評估,控制好風險。
              </p>
            </div>

            <div>
              <h3 className="font-bold text-yellow-400 mb-2">如何開始使用?</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>進入任何一局,等第一次開完獎後,利用上方按鈕把<span className="text-yellow-400 font-bold">前七次</span>的順序按出來。</li>
                <li>等待分析後,按照分析的<span className="text-yellow-400 font-bold">結果從左開始依序下注</span>並配合自己的注碼。</li>
                <li>遇到<span className="text-green-400 font-bold">和局重複下注</span>即可。</li>
                <li>只要有贏就是<span className="text-yellow-400 font-bold">換房再次進行分析</span>。</li>
                <li>請確認自己的<span className="text-yellow-400 font-bold">止損止盈</span>,小賭怡情。</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* 頁尾 */}
        <div className="text-center text-gray-500 text-sm mt-8">
          本系統僅供參考,不構成任何投注建議。請理性娛樂,謹慎決策。
        </div>
      </div>
    </div>
  );
}

