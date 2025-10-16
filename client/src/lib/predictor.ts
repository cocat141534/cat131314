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
 * 演算法 1: 馬可夫鏈轉移機率評分
 */
function scoreMarkovChain(history: GameResult[], combination: GameResult[]): number {
  // 過濾掉和局,只看莊閒轉移
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length === 0) {
    return 50; // 沒有歷史記錄,返回中性分數
  }
  
  // 計算轉移機率
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
  
  // 計算轉移機率
  const bTotal = transitions['B->B'] + transitions['B->P'];
  const pTotal = transitions['P->B'] + transitions['P->P'];
  
  const probBB = bTotal > 0 ? transitions['B->B'] / bTotal : 0.5;
  const probBP = bTotal > 0 ? transitions['B->P'] / bTotal : 0.5;
  const probPB = pTotal > 0 ? transitions['P->B'] / pTotal : 0.5;
  const probPP = pTotal > 0 ? transitions['P->P'] / pTotal : 0.5;
  
  // 計算組合的機率分數
  let score = 100;
  let current: 'B' | 'P' = filtered[filtered.length - 1] as 'B' | 'P'; // 從最後一個歷史記錄開始
  
  for (const next of combination) {
    let transitionProb = 0.5;
    
    if (current === 'B' && next === 'B') transitionProb = probBB;
    else if (current === 'B' && next === 'P') transitionProb = probBP;
    else if (current === 'P' && next === 'B') transitionProb = probPB;
    else if (current === 'P' && next === 'P') transitionProb = probPP;
    
    score *= transitionProb;
    current = next as 'B' | 'P';
  }
  
  // 標準化到 0-100
  return Math.min(100, score * 1000);
}

/**
 * 演算法 2: 模式延續性分析評分
 */
function scorePatternContinuity(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length < 3) {
    return 50; // 歷史太少,返回中性分數
  }
  
  // 識別當前模式
  const recent = filtered.slice(-4);
  let patternType = 'random';
  
  // 單跳模式: BPBP 或 PBPB
  if (recent.length >= 4) {
    const isSingleJump = 
      recent[0] !== recent[1] && 
      recent[1] !== recent[2] && 
      recent[2] !== recent[3];
    if (isSingleJump) patternType = 'single-jump';
  }
  
  // 雙跳模式: BBPP 或 PPBB
  if (recent.length >= 4) {
    const isDoubleJump = 
      recent[0] === recent[1] && 
      recent[1] !== recent[2] && 
      recent[2] === recent[3];
    if (isDoubleJump) patternType = 'double-jump';
  }
  
  // 長龍模式: BBB 或 PPP
  const last3 = filtered.slice(-3);
  if (last3.length === 3 && last3[0] === last3[1] && last3[1] === last3[2]) {
    patternType = 'streak';
  }
  
  // 評估組合是否符合模式
  let score = 50;
  
  if (patternType === 'single-jump') {
    // 期望繼續單跳
    let jumpCount = 0;
    let prev: 'B' | 'P' = filtered[filtered.length - 1] as 'B' | 'P';
    for (const next of combination) {
      if (next !== prev) jumpCount++;
      prev = next as 'B' | 'P';
    }
    score = (jumpCount / combination.length) * 100;
  } else if (patternType === 'double-jump') {
    // 期望繼續雙跳
    let doubleJumpScore = 0;
    for (let i = 0; i < combination.length - 1; i += 2) {
      if (i + 1 < combination.length && combination[i] === combination[i + 1]) {
        doubleJumpScore += 20;
      }
    }
    score = Math.min(100, doubleJumpScore);
  } else if (patternType === 'streak') {
    // 期望延續長龍
    const streakValue = filtered[filtered.length - 1];
    const streakCount = combination.filter(r => r === streakValue).length;
    score = (streakCount / combination.length) * 100;
  }
  
  return score;
}

/**
 * 演算法 3: 頻率平衡評分
 */
function scoreFrequencyBalance(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length === 0) {
    // 沒有歷史,期望平衡
    const bCount = combination.filter(r => r === 'B').length;
    const pCount = combination.filter(r => r === 'P').length;
    const balance = 1 - Math.abs(bCount - pCount) / combination.length;
    return balance * 100;
  }
  
  // 計算歷史中的莊閒比例
  const historyBCount = filtered.filter(r => r === 'B').length;
  const historyPCount = filtered.filter(r => r === 'P').length;
  const historyBRatio = historyBCount / filtered.length;
  
  // 計算加上組合後的比例
  const combBCount = combination.filter(r => r === 'B').length;
  const combPCount = combination.filter(r => r === 'P').length;
  const totalBCount = historyBCount + combBCount;
  const totalPCount = historyPCount + combPCount;
  const newBRatio = totalBCount / (totalBCount + totalPCount);
  
  // 期望比例趨向 0.5 (平衡)
  const targetRatio = 0.5;
  const improvement = Math.abs(historyBRatio - targetRatio) - Math.abs(newBRatio - targetRatio);
  
  // 如果組合讓比例更接近平衡,給高分
  return 50 + improvement * 200;
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

