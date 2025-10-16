export type GameResult = 'B' | 'P' | 'T'; // B = Banker (莊), P = Player (閒), T = Tie (和)

export interface PredictionRecord {
  history: GameResult[];
  prediction: GameResult[];
  timestamp: number;
  success?: boolean; // true = 成功, false = 失敗, undefined = 未回饋
  scores?: {
    markov: number;
    pattern: number;
    frequency: number;
    total: number;
  };
}

/**
 * 生成所有可能的組合 (只考慮莊和閒,不包含和局)
 */
function generateCombinations(length: number): GameResult[][] {
  const combinations: GameResult[][] = [];
  const total = Math.pow(2, length);
  
  for (let i = 0; i < total; i++) {
    const combination: GameResult[] = [];
    for (let j = 0; j < length; j++) {
      // 使用位運算判斷該位置是 B 還是 P
      combination.push((i & (1 << j)) ? 'P' : 'B');
    }
    combinations.push(combination);
  }
  
  return combinations;
}

/**
 * 演算法 1: 馬可夫鏈轉移機率評分 (改用對數避免數值過小)
 */
function scoreMarkovChain(history: GameResult[], combination: GameResult[]): number {
  // 過濾掉和局,只看莊閒轉移
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length === 0) {
    return 50; // 沒有歷史記錄,返回中性分數
  }
  
  // 計算轉移次數
  const transitions = {
    'B->B': 0,
    'B->P': 0,
    'P->B': 0,
    'P->P': 0,
  };
  
  for (let i = 0; i < filtered.length - 1; i++) {
    const from = filtered[i];
    const to = filtered[i + 1];
    const key = `${from}->${to}` as keyof typeof transitions;
    transitions[key]++;
  }
  
  // 計算轉移機率 (使用拉普拉斯平滑避免0機率)
  const bTotal = transitions['B->B'] + transitions['B->P'] + 2; // +2 是平滑參數
  const pTotal = transitions['P->B'] + transitions['P->P'] + 2;
  
  const probBB = (transitions['B->B'] + 1) / bTotal;
  const probBP = (transitions['B->P'] + 1) / bTotal;
  const probPB = (transitions['P->B'] + 1) / pTotal;
  const probPP = (transitions['P->P'] + 1) / pTotal;
  
  // 計算組合的對數機率
  let logProb = 0;
  let current: 'B' | 'P' = filtered[filtered.length - 1] as 'B' | 'P';
  
  for (const next of combination) {
    let transitionProb = 0.5;
    
    if (current === 'B' && next === 'B') transitionProb = probBB;
    else if (current === 'B' && next === 'P') transitionProb = probBP;
    else if (current === 'P' && next === 'B') transitionProb = probPB;
    else if (current === 'P' && next === 'P') transitionProb = probPP;
    
    logProb += Math.log(transitionProb);
    current = next as 'B' | 'P';
  }
  
  // 轉換為 0-100 分數 (對數值通常是負數,需要標準化)
  // 理論最大值約為 log(1)^7 = 0, 最小值約為 log(0.25)^7 = -9.7
  const normalizedScore = Math.max(0, Math.min(100, (logProb + 10) * 10));
  return normalizedScore;
}

/**
 * 演算法 2: 模式延續性分析評分
 */
function scorePatternContinuity(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length < 2) {
    return 50; // 歷史太少,返回中性分數
  }
  
  // 識別最近的模式
  const recent = filtered.slice(-6); // 看最近6個
  let patternScore = 50;
  
  // 檢測單跳模式 (交替出現)
  if (recent.length >= 4) {
    let alternateCount = 0;
    for (let i = 0; i < recent.length - 1; i++) {
      if (recent[i] !== recent[i + 1]) alternateCount++;
    }
    const alternateRatio = alternateCount / (recent.length - 1);
    
    // 如果歷史是單跳,檢查組合是否也是單跳
    if (alternateRatio > 0.6) {
      let combAlternate = 0;
      let prev: 'B' | 'P' = filtered[filtered.length - 1] as 'B' | 'P';
      for (const next of combination) {
        if (next !== prev) combAlternate++;
        prev = next as 'B' | 'P';
      }
      const combAlternateRatio = combAlternate / combination.length;
      patternScore = combAlternateRatio * 100;
      return patternScore;
    }
  }
  
  // 檢測連續模式 (連莊或連閒)
  const lastValue = filtered[filtered.length - 1];
  let streakLength = 1;
  for (let i = filtered.length - 2; i >= 0; i--) {
    if (filtered[i] === lastValue) {
      streakLength++;
    } else {
      break;
    }
  }
  
  // 如果有連續,給予延續連續的組合較高分
  if (streakLength >= 2) {
    const sameCount = combination.filter(r => r === lastValue).length;
    const sameRatio = sameCount / combination.length;
    // 連續越長,越傾向繼續,但不要太極端
    const streakFactor = Math.min(streakLength / 5, 0.8);
    patternScore = 50 + sameRatio * 50 * streakFactor;
    return patternScore;
  }
  
  // 沒有明顯模式,給予平衡的組合較高分
  const bCount = combination.filter(r => r === 'B').length;
  const balance = 1 - Math.abs(bCount - combination.length / 2) / (combination.length / 2);
  return 50 + balance * 30;
}

/**
 * 演算法 3: 頻率平衡評分 (改進版,避免過度補償)
 */
function scoreFrequencyBalance(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length === 0) {
    // 沒有歷史,期望組合本身平衡
    const bCount = combination.filter(r => r === 'B').length;
    const balance = 1 - Math.abs(bCount - combination.length / 2) / (combination.length / 2);
    return balance * 100;
  }
  
  // 計算歷史中的莊閒比例
  const historyBCount = filtered.filter(r => r === 'B').length;
  const historyPCount = filtered.filter(r => r === 'P').length;
  const historyBRatio = historyBCount / filtered.length;
  
  // 計算組合的莊閒比例
  const combBCount = combination.filter(r => r === 'B').length;
  const combPCount = combination.filter(r => r === 'P').length;
  
  // 計算加上組合後的整體比例
  const totalBCount = historyBCount + combBCount;
  const totalPCount = historyPCount + combPCount;
  const totalCount = totalBCount + totalPCount;
  const newBRatio = totalBCount / totalCount;
  
  // 目標是讓整體比例趨向 0.5,但不要過度補償
  const currentDeviation = Math.abs(historyBRatio - 0.5);
  const newDeviation = Math.abs(newBRatio - 0.5);
  
  // 如果組合讓偏差變小,給高分;但限制改善幅度避免極端
  const improvement = currentDeviation - newDeviation;
  const normalizedImprovement = Math.max(-0.2, Math.min(0.2, improvement));
  
  return 50 + normalizedImprovement * 250;
}

/**
 * 主預測函數 - 使用組合評分法預測接下來 N 次
 */
export function predictNextN(history: GameResult[], n: number = 7): GameResult[] {
  // 生成所有可能的組合
  const combinations = generateCombinations(n);
  
  // 評分權重
  const weights = {
    markov: 0.40,
    pattern: 0.35,
    frequency: 0.25,
  };
  
  // 對每個組合評分
  let bestCombination: GameResult[] = combinations[0];
  let bestScore = -Infinity;
  
  for (const combination of combinations) {
    const markovScore = scoreMarkovChain(history, combination);
    const patternScore = scorePatternContinuity(history, combination);
    const frequencyScore = scoreFrequencyBalance(history, combination);
    
    const totalScore = 
      markovScore * weights.markov +
      patternScore * weights.pattern +
      frequencyScore * weights.frequency;
    
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestCombination = combination;
    }
  }
  
  return bestCombination;
}

/**
 * 帶詳細評分的預測函數
 */
export function predictWithScores(history: GameResult[], n: number = 7): {
  prediction: GameResult[];
  scores: {
    markov: number;
    pattern: number;
    frequency: number;
    total: number;
  };
} {
  const combinations = generateCombinations(n);
  
  const weights = {
    markov: 0.40,
    pattern: 0.35,
    frequency: 0.25,
  };
  
  let bestCombination: GameResult[] = combinations[0];
  let bestScores = { markov: 0, pattern: 0, frequency: 0, total: 0 };
  let bestScore = -Infinity;
  
  for (const combination of combinations) {
    const markovScore = scoreMarkovChain(history, combination);
    const patternScore = scorePatternContinuity(history, combination);
    const frequencyScore = scoreFrequencyBalance(history, combination);
    
    const totalScore = 
      markovScore * weights.markov +
      patternScore * weights.pattern +
      frequencyScore * weights.frequency;
    
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestCombination = combination;
      bestScores = {
        markov: markovScore,
        pattern: patternScore,
        frequency: frequencyScore,
        total: totalScore,
      };
    }
  }
  
  return {
    prediction: bestCombination,
    scores: bestScores,
  };
}

/**
 * 儲存預測記錄到 localStorage
 */
export function savePredictionRecord(record: PredictionRecord): void {
  const records = getPredictionRecords();
  records.push(record);
  localStorage.setItem('prediction_records', JSON.stringify(records));
}

/**
 * 獲取所有預測記錄
 */
export function getPredictionRecords(): PredictionRecord[] {
  const data = localStorage.getItem('prediction_records');
  return data ? JSON.parse(data) : [];
}

/**
 * 更新預測記錄的成功/失敗狀態
 */
export function updatePredictionResult(timestamp: number, success: boolean): void {
  const records = getPredictionRecords();
  const record = records.find(r => r.timestamp === timestamp);
  if (record) {
    record.success = success;
    localStorage.setItem('prediction_records', JSON.stringify(records));
  }
}

/**
 * 計算預測準確率統計
 */
export function getPredictionStats(): {
  total: number;
  success: number;
  failure: number;
  pending: number;
  successRate: number;
} {
  const records = getPredictionRecords();
  const total = records.length;
  const success = records.filter(r => r.success === true).length;
  const failure = records.filter(r => r.success === false).length;
  const pending = records.filter(r => r.success === undefined).length;
  const successRate = total > 0 ? (success / (success + failure)) * 100 : 0;
  
  return { total, success, failure, pending, successRate };
}

