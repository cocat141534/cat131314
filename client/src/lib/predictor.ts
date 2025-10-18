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
    dragon: number;
    jump: number;
    regularity: number;
    random: number;
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
  
  // 計算轉移機率 (增加平滑參數避免極端機率)
  const smoothing = 5; // 增加平滑參數從2到5
  const bTotal = transitions['B->B'] + transitions['B->P'] + smoothing * 2;
  const pTotal = transitions['P->B'] + transitions['P->P'] + smoothing * 2;
  
  let probBB = (transitions['B->B'] + smoothing) / bTotal;
  let probBP = (transitions['B->P'] + smoothing) / bTotal;
  let probPB = (transitions['P->B'] + smoothing) / pTotal;
  let probPP = (transitions['P->P'] + smoothing) / pTotal;
  
  // 限制機率範圍,避免過於極端 (0.2 - 0.8)
  probBB = Math.max(0.2, Math.min(0.8, probBB));
  probBP = Math.max(0.2, Math.min(0.8, probBP));
  probPB = Math.max(0.2, Math.min(0.8, probPB));
  probPP = Math.max(0.2, Math.min(0.8, probPP));
  
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
  
  // 如果有連續,給予延續連續的組合較高分(但降低權重避免過度連續)
  if (streakLength >= 2) {
    const sameCount = combination.filter(r => r === lastValue).length;
    const sameRatio = sameCount / combination.length;
    
    // 大幅降低連續權重,並設定上限
    // 連續越長,權重反而降低(因為連續太長很容易斷)
    const streakFactor = Math.min(streakLength / 10, 0.3); // 從 0.8 降至 0.3
    
    // 不鼓勵全部相同,給予部分相同的組合更高分
    // sameRatio 在 0.4-0.6 範圍時得分最高
    const optimalRatio = 0.5; // 最佳比例
    const ratioDeviation = Math.abs(sameRatio - optimalRatio);
    const ratioScore = 1 - ratioDeviation * 2; // 偏離越大分數越低
    
    patternScore = 50 + ratioScore * 30 * streakFactor;
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
 * 演算法 4: 長龍斬龍評分
 * 檢測連續出現的長龍,預測其即將中斷
 */
function scoreDragonSlayer(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length < 3) {
    return 50; // 歷史太少,返回中性分數
  }
  
  // 檢測當前是否有長龍
  const lastValue = filtered[filtered.length - 1];
  let streakLength = 1;
  for (let i = filtered.length - 2; i >= 0; i--) {
    if (filtered[i] === lastValue) {
      streakLength++;
    } else {
      break;
    }
  }
  
  // 長龍定義:連續4次以上
  if (streakLength >= 4) {
    // 長龍越長,越傾向預測斬龍(出現相反結果)
    const oppositeValue = lastValue === 'B' ? 'P' : 'B';
    const oppositeCount = combination.filter(r => r === oppositeValue).length;
    const oppositeRatio = oppositeCount / combination.length;
    
    // 長龍長度影響斬龍機率
    // 4連: 30%斬龍機率, 5連: 40%, 6連: 50%, 7連+: 60%
    const dragonFactor = Math.min((streakLength - 3) * 0.1, 0.6);
    
    // 組合中相反結果越多,分數越高
    return 50 + oppositeRatio * 100 * dragonFactor;
  }
  
  // 沒有長龍,給予平衡組合較高分
  const bCount = combination.filter(r => r === 'B').length;
  const balance = 1 - Math.abs(bCount - combination.length / 2) / (combination.length / 2);
  return 50 + balance * 20;
}

/**
 * 演算法 5: 單雙跳評分
 * 檢測單跳(BPBPBP)或雙跳(BBPPBBPP)模式
 */
function scoreJumpPattern(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length < 4) {
    return 50;
  }
  
  // 檢測單跳模式 (交替出現)
  let singleJumpCount = 0;
  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i] !== filtered[i + 1]) {
      singleJumpCount++;
    }
  }
  const singleJumpRatio = singleJumpCount / (filtered.length - 1);
  
  // 檢測雙跳模式 (每兩個交替)
  let doubleJumpCount = 0;
  for (let i = 0; i < filtered.length - 2; i += 2) {
    if (i + 3 < filtered.length) {
      if (filtered[i] === filtered[i + 1] && 
          filtered[i + 2] === filtered[i + 3] && 
          filtered[i] !== filtered[i + 2]) {
        doubleJumpCount++;
      }
    }
  }
  const doubleJumpDivisor = Math.max(1, Math.floor(filtered.length / 4));
  const doubleJumpRatio = doubleJumpCount / doubleJumpDivisor;
  
  // 判斷是單跳還是雙跳模式
  if (singleJumpRatio > 0.7) {
    // 單跳模式:預測組合也應該單跳
    let combJumpCount = 0;
    let prev = filtered[filtered.length - 1];
    for (const next of combination) {
      if (next !== prev) combJumpCount++;
      prev = next;
    }
    const combJumpRatio = combination.length > 0 ? combJumpCount / combination.length : 0;
    return combJumpRatio * 100;
  } else if (doubleJumpRatio > 0.5) {
    // 雙跳模式:預測組合也應該雙跳
    let score = 50;
    const lastTwo = filtered.slice(-2);
    if (lastTwo[0] === lastTwo[1]) {
      // 剛完成一組雙,下一組應該相反
      const oppositeValue = lastTwo[0] === 'B' ? 'P' : 'B';
      const firstTwo = combination.slice(0, 2);
      if (firstTwo[0] === oppositeValue && firstTwo[1] === oppositeValue) {
        score += 30;
      }
    }
    return score;
  }
  
  // 沒有明顯跳躍模式
  return 50;
}

/**
 * 演算法 6: 路單齊整評分
 * 百家樂路單美學:傾向產生整齊的路單圖形
 */
function scoreRoadBeauty(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length < 5) {
    return 50;
  }
  
  // 分析最近的路單結構
  const recent = filtered.slice(-12); // 看最近12個
  
  // 計算連續段落
  const segments: { value: 'B' | 'P', length: number }[] = [];
  let currentValue = recent[0] as 'B' | 'P';
  let currentLength = 1;
  
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] === currentValue) {
      currentLength++;
    } else {
      segments.push({ value: currentValue, length: currentLength });
      currentValue = recent[i] as 'B' | 'P';
      currentLength = 1;
    }
  }
  segments.push({ value: currentValue, length: currentLength });
  
  // 檢測路單是否有規律性(長度相似的段落)
  if (segments.length >= 3) {
    const lengths = segments.map(s => s.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    
    // 標準差越小,路單越齊整
    const regularity = Math.max(0, 1 - stdDev / avgLength);
    
    if (regularity > 0.5) {
      // 路單齊整,預測下一段也應該符合平均長度
      const lastSegment = segments[segments.length - 1];
      const expectedLength = Math.round(avgLength);
      
      if (lastSegment.length >= expectedLength) {
        // 當前段已達平均長度,應該換邊
        const oppositeValue = lastSegment.value === 'B' ? 'P' : 'B';
        const oppositeCount = combination.filter(r => r === oppositeValue).length;
        const oppositeRatio = oppositeCount / combination.length;
        return 50 + oppositeRatio * 50 * regularity;
      } else {
        // 當前段未達平均長度,應該繼續
        const sameCount = combination.filter(r => r === lastSegment.value).length;
        const sameRatio = sameCount / combination.length;
        return 50 + sameRatio * 50 * regularity;
      }
    }
  }
  
  // 沒有明顯規律
  return 50;
}

/**
 * 隨機預測評分 (隱藏演算法,不顯示給用戶)
 */
function scoreRandom(history: GameResult[], combination: GameResult[]): number {
  // 使用歷史長度作為隨機種子,確保相同歷史得到相同結果
  const seed = history.length;
  let hash = seed;
  
  // 根據組合生成一個「隨機」分數
  for (let i = 0; i < combination.length; i++) {
    hash = ((hash << 5) - hash) + (combination[i] === 'B' ? 1 : 0);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // 歸一化到0-100
  return Math.abs(hash % 100);
}

/**
 * 主預測函數 - 使用組合評分法預測接下來 N 次
 */
export function predictNextN(history: GameResult[], n: number = 7): GameResult[] {
  // 生成所有可能的組合
  const combinations = generateCombinations(n);
  
  // 評分權重 (七種演算法)
  const weights = {
    markov: 0.19,        // 馬可夫鏈
    pattern: 0.19,       // 模式延續
    frequency: 0.19,     // 頻率平衡
    dragon: 0.13,        // 長龍斬龍
    jump: 0.13,          // 單雙跳
    road: 0.13,          // 路單齊整
    random: 0.04,        // 隨機生成
  };
  
  // 對每個組合評分
  let bestCombination: GameResult[] = combinations[0];
  let bestScore = -Infinity;
  
  for (const combination of combinations) {
    const markovScore = scoreMarkovChain(history, combination);
    const patternScore = scorePatternContinuity(history, combination);
    const frequencyScore = scoreFrequencyBalance(history, combination);
    const dragonScore = scoreDragonSlayer(history, combination);
    const jumpScore = scoreJumpPattern(history, combination);
    const roadScore = scoreRoadBeauty(history, combination);
    const randomScore = scoreRandom(history, combination);
    
    const totalScore = 
      markovScore * weights.markov +
      patternScore * weights.pattern +
      frequencyScore * weights.frequency +
      dragonScore * weights.dragon +
      jumpScore * weights.jump +
      roadScore * weights.road +
      randomScore * weights.random;
    
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
    dragon: number;
    jump: number;
    road: number;
    total: number;
  };
} {
  const combinations = generateCombinations(n);
  
  const weights = {
    markov: 0.19,
    pattern: 0.19,
    frequency: 0.19,
    dragon: 0.13,
    jump: 0.13,
    road: 0.13,
    random: 0.04,
  };
  
  let bestCombination: GameResult[] = combinations[0];
  let bestScores = { markov: 0, pattern: 0, frequency: 0, dragon: 0, jump: 0, road: 0, total: 0 };
  let bestScore = -Infinity;
  
  for (const combination of combinations) {
    const markovScore = scoreMarkovChain(history, combination);
    const patternScore = scorePatternContinuity(history, combination);
    const frequencyScore = scoreFrequencyBalance(history, combination);
    const dragonScore = scoreDragonSlayer(history, combination);
    const jumpScore = scoreJumpPattern(history, combination);
    const roadScore = scoreRoadBeauty(history, combination);
    const randomScore = scoreRandom(history, combination);
    
    const totalScore = 
      markovScore * weights.markov +
      patternScore * weights.pattern +
      frequencyScore * weights.frequency +
      dragonScore * weights.dragon +
      jumpScore * weights.jump +
      roadScore * weights.road +
      randomScore * weights.random;
    
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestCombination = combination;
      bestScores = {
        markov: markovScore,
        pattern: patternScore,
        frequency: frequencyScore,
        dragon: dragonScore,
        jump: jumpScore,
        road: roadScore,
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

