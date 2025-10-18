import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  GameResult, 
  savePredictionRecord, 
  updatePredictionResult,
  getPredictionStats,
  PredictionRecord
} from "@/lib/predictor";
import { predictHybrid } from "@/lib/hybrid-predictor";
import { APP_TITLE } from "@/const";
import { CheckCircle2, XCircle, Wallet, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

// 生存策略 - 固定倍數序列
// 使用保守的 0.95 賠率計算,確保每個位置都盈利
const BASE_MULTIPLIERS = [100, 110, 250, 500, 1020, 2200, 4800];
const BASE_TOTAL = 8980; // 基礎倍數序列的總和
const PAYOUT_RATE = 0.95; // 莊家投注賠率(扣除5%佣金)

function calculateScaledBets(userBankroll: number): number[] {
  // 根據用戶本金,按照基礎倍數序列的比例進行等比縮放
  // 縮放比例 = 用戶本金 / 基礎總額(8980)
  const ratio = userBankroll / BASE_TOTAL;
  
  // 按比例縮放每個倍數
  const scaledBets = BASE_MULTIPLIERS.map(base => {
    return Math.floor(base * ratio);
  });
  
  return scaledBets;
}



export default function Home() {
  const [history, setHistory] = useState<GameResult[]>([]);
  const [prediction, setPrediction] = useState<GameResult[]>([]);
  const [currentPredictionTimestamp, setCurrentPredictionTimestamp] = useState<number | null>(null);
  const [scores, setScores] = useState<{
    markov: number;
    pattern: number;
    frequency: number;
    dragon: number;
    jump: number;
    regularity: number;
    total: number;
  } | null>(null);
  const [stats, setStats] = useState(getPredictionStats());
  const [showFeedback, setShowFeedback] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [selectedRound, setSelectedRound] = useState<number | null>(null); // 選中的局數(0-6)
  
  // 本金管理
  const [initialBankroll, setInitialBankroll] = useState<number>(8980); // 基礎倍數序列的總和
  const [remainingBankroll, setRemainingBankroll] = useState<number>(8980);
  const [bankrollInput, setBankrollInput] = useState<string>("8980");
  const [recommendedBets, setRecommendedBets] = useState<number[]>(() => calculateScaledBets(8980));
  const [showProfitAlert, setShowProfitAlert] = useState(false); // 盈利提醒
  const [profitAlertLevel, setProfitAlertLevel] = useState<number>(0); // 盈利提醒等級 (0=未觸發, 1=10%, 2=20%, 3=40%, 4=80%, 5=100%)
  const [profitAlertMessage, setProfitAlertMessage] = useState<string>(''); // 盈利提醒訊息
  const [isPredicting, setIsPredicting] = useState(false); // 是否進入預測模式
  const [showConfirmDialog, setShowConfirmDialog] = useState(false); // 顯示確認對話框
  const [shouldRandomizeNext, setShouldRandomizeNext] = useState(false); // 下次預測是否使用隨機
  const [forcedRestEndTime, setForcedRestEndTime] = useState<number | null>(null); // 強制休息結束時間
  const [remainingRestTime, setRemainingRestTime] = useState<string>(''); // 剩餘休息時間

  // 檢查強制休息狀態
  useEffect(() => {
    const savedRestEndTime = localStorage.getItem('forcedRestEndTime');
    if (savedRestEndTime) {
      const endTime = parseInt(savedRestEndTime);
      if (endTime > Date.now()) {
        setForcedRestEndTime(endTime);
      } else {
        localStorage.removeItem('forcedRestEndTime');
      }
    }
  }, []);

  // 倒數計時
  useEffect(() => {
    if (!forcedRestEndTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = forcedRestEndTime - now;

      if (remaining <= 0) {
        setForcedRestEndTime(null);
        setRemainingRestTime('');
        localStorage.removeItem('forcedRestEndTime');
        clearInterval(interval);
      } else {
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        setRemainingRestTime(`${hours}小時 ${minutes}分 ${seconds}秒`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [forcedRestEndTime]);

  const addResult = (result: GameResult) => {
    if (isLocked) return;
    
    const newHistory = [...history, result];
    setHistory(newHistory);
    
    // 移除自動預測 - 需要手動點擊「開始預測」按鈕
  };

  const generatePrediction = (currentHistory: GameResult[]) => {
    // 檢查是否在強制休息中
    if (forcedRestEndTime && forcedRestEndTime > Date.now()) {
      alert(`你已經賺100%了！娘子快點跟牛魔王出來看上帝！\n強制休息中，剩餘時間：${remainingRestTime}`);
      return;
    }

    // 移除最少局數限制,允許任何局數預測
    if (currentHistory.length === 0) {
      setPrediction([]);
      setScores(null);
      setShowFeedback(false);
      setIsLocked(false);
      return;
    }

    const result = predictHybrid(currentHistory, 7);
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
    
    // 推薦賠注固定不變(根據初始本金縮放,不隨剩餘本金變化)
    // 這樣可以避免贏錢後風險放大,誤導用戶下更大的註
    const newBets = calculateScaledBets(initialBankroll);
    setRecommendedBets(newBets);
  };

  const handleFeedback = (success: boolean) => {
    if (currentPredictionTimestamp) {
      updatePredictionResult(currentPredictionTimestamp, success);
      setStats(getPredictionStats());
    }
    
    // 計算本金變化
    let newBankroll = remainingBankroll;
    
    if (success && selectedRound !== null) {
      // 成功:計算投入成本和獲利
      const totalInvested = recommendedBets.slice(0, selectedRound + 1).reduce((sum, bet) => sum + bet, 0);
      const betAmount = recommendedBets[selectedRound];
      const winnings = betAmount * PAYOUT_RATE; // 莊家投注獲利 = 投注額 × 0.95
      const totalReturn = betAmount + winnings; // 拿回總額 = 本金 + 獲利
      const netProfit = totalReturn - totalInvested; // 淨盈虧 = 拿回總額 - 總投入
      newBankroll = remainingBankroll + netProfit;
    } else if (!success) {
      // 失敗:虧損全部投入
      const totalLoss = recommendedBets.reduce((sum, bet) => sum + bet, 0);
      newBankroll = Math.max(0, remainingBankroll - totalLoss);
    }
    
    setRemainingBankroll(newBankroll);
    
    // 檢查多階段盈利提醒
    const profitRatio = (newBankroll - initialBankroll) / initialBankroll;
    let newLevel = profitAlertLevel;
    let message = '';
    
    if (profitRatio >= 1.0 && profitAlertLevel < 5) {
      newLevel = 5;
      message = '娘子快點跟牛魔王出來看上帝';
      // 設定6小時強制休息
      const restEndTime = Date.now() + 6 * 60 * 60 * 1000; // 6小時
      setForcedRestEndTime(restEndTime);
      localStorage.setItem('forcedRestEndTime', restEndTime.toString());
    } else if (profitRatio >= 0.8 && profitAlertLevel < 4) {
      newLevel = 4;
      message = '收手吧...阿祖...';
    } else if (profitRatio >= 0.4 && profitAlertLevel < 3) {
      newLevel = 3;
      message = '太狂了吧!!你要不要冷靜一下!!!?';
    } else if (profitRatio >= 0.2 && profitAlertLevel < 2) {
      newLevel = 2;
      message = '該知足了吧!? 你以為賭神嗎!!20%欸';
    } else if (profitRatio >= 0.1 && profitAlertLevel < 1) {
      newLevel = 1;
      message = '欸欸 賭10%很多了 快停手吧!!';
    }
    
    if (newLevel > profitAlertLevel) {
      setProfitAlertLevel(newLevel);
      setProfitAlertMessage(message);
      setShowProfitAlert(true);
      
      // 播放音效
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800 + newLevel * 100; // 等級越高音頻越高
        gainNode.gain.value = 0.3;
        
        // 播放次數隨等級增加
        const beeps = newLevel + 2;
        for (let i = 0; i < beeps; i++) {
          const startTime = audioContext.currentTime + i * 0.15;
          gainNode.gain.setValueAtTime(0.3, startTime);
          gainNode.gain.setValueAtTime(0, startTime + 0.1);
        }
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + beeps * 0.15);
      } catch (e) {
        console.log('無法播放音效:', e);
      }
    }
    
    // 推薦賠注固定不變(根據初始本金縮放,不隨剩餘本金變化)
    const newBets = calculateScaledBets(initialBankroll);
    setRecommendedBets(newBets);
    
    // 不清空歷史記錄,保持累積
    // 只清空預測結果和解鎖,讓用戶可以繼續輸入
    setPrediction([]);
    setScores(null);
    setShowFeedback(false);
    setIsLocked(false);
    setSelectedRound(null);
    setCurrentPredictionTimestamp(null);
    // 重置預測模式,讓「開始預測」按鈕重新顯示
    setIsPredicting(false);
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
    setIsPredicting(false);
  };

  const handleStartPrediction = () => {
    // 如果少於15局,顯示確認對話框
    if (history.length < 15) {
      setShowConfirmDialog(true);
    } else {
      startPrediction();
    }
  };

  const startPrediction = () => {
    setIsPredicting(true);
    setShowConfirmDialog(false);
    generatePrediction(history);
  };

  const handleBankrollUpdate = () => {
    const value = parseInt(bankrollInput);
    if (!isNaN(value) && value > 0) {
      setInitialBankroll(value);
      setRemainingBankroll(value);
      // 根據用戶設定的本金等比縮放
      const newBets = calculateScaledBets(value);
      setRecommendedBets(newBets);
      // 重置提醒狀態
      setShowProfitAlert(false);
      setProfitAlertLevel(0);
      setProfitAlertMessage('');
    }
  };

  const resetBankroll = () => {
    setRemainingBankroll(initialBankroll);
    // 根據初始本金等比縮放
    const newBets = calculateScaledBets(initialBankroll);
    setRecommendedBets(newBets);
    // 重置提醒狀態
    setShowProfitAlert(false);
    setProfitAlertLevel(0);
    setProfitAlertMessage('');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto py-8 px-4">
        {/* 標題 */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img src="https://raw.githubusercontent.com/cat135149/spinning-cat-baccarat/main/spinning-cat.gif" alt="Spinning Cat" className="w-20 h-20 object-contain" />
            <h1 className="text-4xl font-bold text-yellow-400">Spinning Cat 旋轉貓！百家預測器</h1>
            <img src="https://raw.githubusercontent.com/cat135149/spinning-cat-baccarat/main/spinning-cat.gif" alt="Spinning Cat" className="w-20 h-20 object-contain" />
          </div>
          <p className="text-gray-400 text-lg">轉轉賺~轉好運-演算法分析💰✨</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">起始本金</div>
                <div className="text-2xl font-bold text-white">
                  {initialBankroll.toLocaleString()}元
                </div>
              </div>
              
              <div className="bg-gray-700/50 p-4 rounded-lg relative">
                <div className="text-sm text-gray-400 mb-1">剩餘本金</div>
                <div className={`text-2xl font-bold ${remainingBankroll >= initialBankroll ? 'text-green-400' : remainingBankroll >= initialBankroll * 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {remainingBankroll.toLocaleString()}元
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {(bankrollRatio * 100).toFixed(1)}% 剩餘
                </div>
              </div>
            </div>

            {/* 10%盈利提醒 */}
            {showProfitAlert && (
              <div className={`border-2 p-4 rounded-lg relative ${
                profitAlertLevel === 5 ? 'bg-gradient-to-r from-yellow-400/40 to-yellow-600/40 border-yellow-400 border-4 animate-pulse' :
                profitAlertLevel === 4 ? 'bg-gradient-to-r from-red-600/30 to-purple-600/30 border-red-600 animate-pulse' :
                profitAlertLevel === 3 ? 'bg-gradient-to-r from-orange-500/30 to-red-500/30 border-orange-500 animate-pulse' :
                profitAlertLevel === 2 ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border-yellow-500 animate-pulse' :
                'bg-gradient-to-r from-yellow-500/20 to-red-500/20 border-yellow-500 animate-pulse'
              }`}>
                {profitAlertLevel !== 5 && (
                  <button
                    onClick={() => setShowProfitAlert(false)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
                <div className="text-center">
                  <div className={`text-2xl font-bold mb-2 ${
                    profitAlertLevel === 5 ? 'text-yellow-300 animate-bounce text-4xl' :
                    profitAlertLevel === 4 ? 'text-red-400 animate-bounce' :
                    profitAlertLevel === 3 ? 'text-orange-400 animate-bounce' :
                    profitAlertLevel === 2 ? 'text-yellow-400 animate-bounce' :
                    'text-yellow-400 animate-bounce'
                  }`}>
                    {profitAlertLevel === 5 ? '✨👑✨' : profitAlertLevel === 4 ? '🛑' : profitAlertLevel === 3 ? '😱' : profitAlertLevel === 2 ? '😬' : '🚨'} {profitAlertMessage} {profitAlertLevel === 5 ? '✨👑✨' : profitAlertLevel === 4 ? '🛑' : profitAlertLevel === 3 ? '😱' : profitAlertLevel === 2 ? '😬' : '🚨'}
                  </div>
                  <div className="text-sm text-gray-300">
                    你已經贏了 {((remainingBankroll - initialBankroll) / initialBankroll * 100).toFixed(1)}%，考慮見好就收吧！
                  </div>
                  {profitAlertLevel === 5 && (
                    <div className="mt-4 text-lg text-yellow-200 font-bold">
                      🚫 強制休息 6 小時！
                      <div className="text-base text-yellow-300 mt-2">
                        剩餘時間：{remainingRestTime}
                      </div>
                      <div className="text-sm text-gray-300 mt-2">
                        請好好休息，明天再來！😴
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 推薦賠注 */}
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
                  {history.length > 0 && history.length < 15 && (
                    <span className="text-yellow-400 ml-2">
                      • 建議至少輸入15局以上
                    </span>
                  )}
                  {history.length >= 15 && (
                    <span className="text-green-400 ml-2">
                      • 歷史記錄充足 ✓
                    </span>
                  )}
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
                
                {/* 開始預測按鈕 */}
                {!isPredicting && history.length > 0 && (
                  <div className="mt-4">
                    <Button
                      onClick={handleStartPrediction}
                      className={`w-full h-14 text-lg font-bold ${
                        history.length >= 15
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-yellow-600 hover:bg-yellow-700'
                      }`}
                    >
                      {history.length >= 15 ? (
                        <>✓ 開始預測</>
                      ) : (
                        <>⚠️ 開始預測 (建議至少15局)</>
                      )}
                    </Button>
                    {history.length < 15 && (
                      <div className="text-xs text-yellow-400 text-center mt-2">
                        目前只有 {history.length} 局，建議輸入15局以上以提高準確度
                      </div>
                    )}
                  </div>
                )}
                
                {/* 預測中提示 */}
                {isPredicting && (
                  <div className="mt-4 bg-green-600/20 border border-green-500 p-3 rounded text-center">
                    <div className="text-green-400 font-bold">✓ 預測模式已啟動</div>
                    <div className="text-xs text-gray-300 mt-1">輸入新結果後，點擊「開始預測」按鈕更新預測</div>
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
                  基於百家樂專業路單分析
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!isPredicting && prediction.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    {history.length === 0 ? (
                      <>
                        請先輸入歷史記錄
                        <br />
                        <span className="text-sm">（建議至少15局以上）</span>
                      </>
                    ) : (
                      <>
                        已輸入 {history.length} 局
                        <br />
                        <span className="text-sm text-yellow-400">點擊「開始預測」按鈕開始分析</span>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-7 gap-2">
                      {prediction.map((result, index) => (
                        <div key={index} className="text-center">
                          <div className="text-xs text-gray-400 mb-1">第{index + 1}局</div>
                          <button
                            onClick={() => setSelectedRound(index)}
                            disabled={!showFeedback}
                            className={`w-full ${getResultColor(result)} text-white px-2 py-3 rounded font-bold text-lg transition-all ${
                              selectedRound === index ? 'ring-4 ring-yellow-400 scale-110' : ''
                            } ${showFeedback ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}
                          >
                            {getResultLabel(result)}
                          </button>
                          <div className="text-xs text-yellow-400 mt-1">
                            {recommendedBets[index].toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>

                    {scores && (
                      <div className="bg-gray-700/50 p-3 rounded space-y-2">
                        <div className="text-sm text-gray-400">演算法評分:</div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>馬可夫鏈: <span className="text-blue-400 font-bold">{scores.markov.toFixed(1)}</span></div>
                          <div>模式延續: <span className="text-blue-400 font-bold">{scores.pattern.toFixed(1)}</span></div>
                          <div>頻率平衡: <span className="text-blue-400 font-bold">{scores.frequency.toFixed(1)}</span></div>
                          <div>長龍斬龍: <span className="text-yellow-400 font-bold">{scores.dragon.toFixed(1)}</span></div>
                          <div>單雙跳: <span className="text-yellow-400 font-bold">{scores.jump.toFixed(1)}</span></div>
                          <div>路單齊整: <span className="text-yellow-400 font-bold">{scores.regularity.toFixed(1)}</span></div>
                        </div>
                        <div className="text-center pt-2 border-t border-gray-600">
                          <div>綜合評分: <span className="text-green-400 font-bold text-lg">{scores.total.toFixed(1)}</span></div>
                        </div>
                      </div>
                    )}

                    {showFeedback && (
                      <div className="bg-gray-700/50 p-4 rounded space-y-3">
                        <div className="text-center text-gray-300 font-medium">
                          {selectedRound === null ? (
                            <span>請點擊命中的局數</span>
                          ) : (
                            <div className="space-y-1">
                              <div>第 {selectedRound + 1} 局命中</div>
                              <div className="text-sm text-gray-400">
                                {(() => {
                                  const totalInvested = recommendedBets.slice(0, selectedRound + 1).reduce((sum, bet) => sum + bet, 0);
                                  const betAmount = recommendedBets[selectedRound];
                                  const winnings = betAmount * PAYOUT_RATE;
                                  const totalReturn = betAmount + winnings;
                                  const netProfit = totalReturn - totalInvested;
                                  return (
                                    <>
                                      投入: {totalInvested.toLocaleString()}元 | 
                                      拿回: {totalReturn.toFixed(0)}元 | 
                                      淨損益: {netProfit > 0 ? '+' : ''}{netProfit.toFixed(0)}元
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            onClick={() => handleFeedback(true)}
                            disabled={selectedRound === null}
                            className="bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側：說明 & 問題 */}
          <Card className="lg:col-span-2 bg-gray-800/50 border-yellow-500/30">
            <CardHeader>
              <CardTitle className="text-yellow-400">說明 & 問題</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-gray-300">
            <div>
              <h3 className="font-bold text-yellow-400 mb-3 text-lg">❓ 網站製作出的預測結果可以相信嗎?</h3>
              <p className="text-red-400 font-bold text-base">❌ 不能</p>
              <p className="text-base text-gray-400">
                本網站僅提供數據分析後結果，並不保證100%的準確度及正確性，請自行評估，控制好風險。
              </p>
            </div>

            <div>
              <h3 className="font-bold text-yellow-400 mb-3 text-lg">💰 採用生存籌碼策略</h3>
              <p className="text-base text-gray-400">
                本系統使用<span className="text-yellow-400 font-bold">固定倍數序列 [100, 110, 250, 500, 1020, 2200, 4800]</span>，
                基於保守的 <span className="text-yellow-400 font-bold">0.95 賠率</span>，<span className="text-red-400 font-bold">不構成投資建議</span>。
              </p>
            </div>

            <div>
              <h3 className="font-bold text-yellow-400 mb-3 text-lg">🚀 如何開始使用?</h3>
              <ol className="list-decimal list-inside space-y-2 text-base">
                <li>🎲 進入任何一局，利用上方按鈕輸入<span className="text-yellow-400 font-bold">至少15局</span>歷史記錄(越多越好)。</li>
                <li>✅ 點擊<span className="text-green-400 font-bold">「開始預測」</span>按鈕，系統會分析並預測接下來7局。</li>
                <li>🎯 按照預測的<span className="text-yellow-400 font-bold">結果從左開始依序下注</span>並配合建議賠注。</li>
                <li>🔁 遇到<span className="text-green-400 font-bold">和局重複下注</span>即可。</li>
                <li>🏠 只要有贏就是<span className="text-yellow-400 font-bold">換房再次進行分析</span>。</li>
                <li>⚠️ 請確認自己的<span className="text-yellow-400 font-bold">止損止盈</span>，<span className="text-green-400 font-bold">小賭怡情</span>。</li>
              </ol>
            </div>
            </CardContent>
          </Card>

          {/* 右側：USDT捐贈區 */}
          <Card className="bg-gradient-to-br from-yellow-900/20 to-gray-800/50 border-yellow-500/50 border-2">
            <CardHeader>
              <CardTitle className="text-yellow-400 text-center text-xl">🐱 分好運給旋轉貓貓</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-6 p-6">
              <p className="text-gray-300 text-base text-center font-semibold">
                有賺錢歡迎分好運給旋轉貓貓 💰✨
              </p>
              
              {/* QR Code - 移除白框 */}
              <div className="relative">
                <img 
                  src="https://raw.githubusercontent.com/cat135149/spinning-cat-baccarat/main/usdt-qr.jpg" 
                  alt="USDT QR Code" 
                  className="w-64 h-64 object-cover rounded-lg shadow-lg"
                />
              </div>
              
              {/* USDT地址 */}
              <div className="w-full space-y-3">
                <p className="text-sm text-gray-300 text-center font-bold">
                  USDT-BEP20
                </p>
                <div className="bg-gray-900/70 p-4 rounded-lg border-2 border-yellow-500/50 relative">
                  <p className="text-sm text-gray-200 break-all text-center font-mono leading-relaxed">
                    0xD140FA9261FaD2DAbAf1203a20168c17ae70650c
                  </p>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText('0xD140FA9261FaD2DAbAf1203a20168c17ae70650c');
                      alert('地址已複製！');
                    }}
                    className="mt-3 w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold"
                  >
                    📋 複製地址
                  </Button>
                </div>
              </div>
              
              <p className="text-sm text-gray-400 text-center">
                感謝您的支持！🙏
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 頁尾 */}
        <div className="text-center text-gray-500 text-sm mt-8">
          本系統僅供參考,不構成任何投注建議。請理性娛樂,謹慎決策。
        </div>
      </div>

      {/* 確認對話框 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border-2 border-yellow-500 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-yellow-400 mb-4">⚠️ 歷史記錄不足</h3>
            <p className="text-gray-300 mb-2">
              目前只有 <span className="text-yellow-400 font-bold">{history.length} 局</span> 歷史記錄
            </p>
            <p className="text-gray-400 text-sm mb-6">
              建議至少輸入15局以上以提高預測準確度。歷史記錄太少可能導致預測不準確。
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowConfirmDialog(false)}
                variant="outline"
                className="flex-1 border-gray-600"
              >
                返回輸入
              </Button>
              <Button
                onClick={startPrediction}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700"
              >
                繼續預測
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

