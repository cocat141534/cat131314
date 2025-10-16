export type GameResult = 'B' | 'P'; // B = Banker (莊), P = Player (閒)

export interface PredictionResult {
  banker: number; // 莊家機率 (0-1)
  player: number; // 閒家機率 (0-1)
}

/**
 * 分析歷史記錄中的連續性模式
 */
function analyzeStreaks(history: GameResult[]): { bankerStreak: number; playerStreak: number } {
  if (history.length === 0) return { bankerStreak: 0, playerStreak: 0 };
  
  let currentStreak = 1;
  const lastResult = history[history.length - 1];
  
  for (let i = history.length - 2; i >= 0; i--) {
    if (history[i] === lastResult) {
      currentStreak++;
    } else {
      break;
    }
  }
  
  return {
    bankerStreak: lastResult === 'B' ? currentStreak : 0,
    playerStreak: lastResult === 'P' ? currentStreak : 0,
  };
}

/**
 * 計算基礎頻率
 */
function calculateFrequency(history: GameResult[]): { bankerFreq: number; playerFreq: number } {
  if (history.length === 0) return { bankerFreq: 0.5, playerFreq: 0.5 };
  
  const bankerCount = history.filter(r => r === 'B').length;
  const playerCount = history.filter(r => r === 'P').length;
  
  return {
    bankerFreq: bankerCount / history.length,
    playerFreq: playerCount / history.length,
  };
}

/**
 * 分析跳躍模式 (單跳、雙跳等)
 */
function analyzePattern(history: GameResult[]): number {
  if (history.length < 4) return 0;
  
  // 檢查最近的模式
  const recent = history.slice(-4);
  
  // 單跳模式: BPBP 或 PBPB
  const isSingleJump = 
    (recent[0] !== recent[1] && recent[1] !== recent[2] && recent[2] !== recent[3]);
  
  // 雙跳模式: BBPP 或 PPBB
  const isDoubleJump = 
    (recent[0] === recent[1] && recent[1] !== recent[2] && recent[2] === recent[3]);
  
  if (isSingleJump) return 0.3; // 單跳傾向
  if (isDoubleJump) return 0.2; // 雙跳傾向
  
  return 0;
}

/**
 * 計算加權分數 (近期記錄權重更高)
 */
function calculateWeightedScore(history: GameResult[], windowSize: number = 10): { bankerScore: number; playerScore: number } {
  const recentHistory = history.slice(-windowSize);
  let bankerScore = 0;
  let playerScore = 0;
  
  recentHistory.forEach((result, index) => {
    const weight = (index + 1) / recentHistory.length; // 越近權重越高
    if (result === 'B') {
      bankerScore += weight;
    } else {
      playerScore += weight;
    }
  });
  
  const total = bankerScore + playerScore;
  return {
    bankerScore: total > 0 ? bankerScore / total : 0.5,
    playerScore: total > 0 ? playerScore / total : 0.5,
  };
}

/**
 * 主預測函數 - 預測下一次開牌結果
 */
export function predictNext(history: GameResult[]): PredictionResult {
  // 如果沒有歷史記錄,返回均等機率
  if (history.length === 0) {
    return { banker: 0.5, player: 0.5 };
  }
  
  // 1. 基礎頻率分析
  const { bankerFreq, playerFreq } = calculateFrequency(history);
  
  // 2. 連續性分析
  const { bankerStreak, playerStreak } = analyzeStreaks(history);
  const streakFactor = Math.min(Math.max(bankerStreak, playerStreak), 5) / 10; // 最多影響 0.5
  
  // 3. 模式識別
  const patternFactor = analyzePattern(history);
  
  // 4. 加權計算
  const { bankerScore, playerScore } = calculateWeightedScore(history);
  
  // 綜合計算 (各因素權重)
  let bankerProb = 
    bankerFreq * 0.3 +           // 歷史頻率 30%
    bankerScore * 0.4 +          // 加權分數 40%
    (bankerStreak > 0 ? streakFactor : -streakFactor * 0.5) * 0.2 + // 連續性 20%
    patternFactor * 0.1;         // 模式 10%
  
  let playerProb = 
    playerFreq * 0.3 +
    playerScore * 0.4 +
    (playerStreak > 0 ? streakFactor : -streakFactor * 0.5) * 0.2 +
    patternFactor * 0.1;
  
  // 標準化機率
  const total = bankerProb + playerProb;
  bankerProb = bankerProb / total;
  playerProb = playerProb / total;
  
  // 確保機率在合理範圍內 (0.1 - 0.9)
  bankerProb = Math.max(0.1, Math.min(0.9, bankerProb));
  playerProb = 1 - bankerProb;
  
  return {
    banker: bankerProb,
    player: playerProb,
  };
}

/**
 * 預測接下來 N 次的結果
 */
export function predictNextN(history: GameResult[], n: number = 5): PredictionResult[] {
  const predictions: PredictionResult[] = [];
  let currentHistory = [...history];
  
  for (let i = 0; i < n; i++) {
    const prediction = predictNext(currentHistory);
    predictions.push(prediction);
    
    // 基於預測結果模擬下一次歷史 (選擇機率較高的結果)
    const nextResult: GameResult = prediction.banker > prediction.player ? 'B' : 'P';
    currentHistory.push(nextResult);
  }
  
  return predictions;
}

