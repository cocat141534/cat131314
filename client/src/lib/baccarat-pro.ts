export type GameResult = 'B' | 'P' | 'T';

/**
 * 百家樂專業預測演算法
 * 基於路單分析、長龍斬龍、單跳雙跳等專業方法
 */

/**
 * 演算法 1: 長龍與斬龍分析
 * 檢測連續長度,判斷是否應該跟龍或斬龍
 */
function scoreDragonAnalysis(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length === 0) return 50;
  
  // 檢測當前連續
  const lastValue = filtered[filtered.length - 1];
  let streakLength = 1;
  for (let i = filtered.length - 2; i >= 0; i--) {
    if (filtered[i] === lastValue) {
      streakLength++;
    } else {
      break;
    }
  }
  
  // 計算組合中延續vs反轉的比例
  const sameCount = combination.filter(r => r === lastValue).length;
  const sameRatio = sameCount / combination.length;
  
  let score = 50;
  
  if (streakLength <= 2) {
    // 短連續(1-2):可能繼續,給予延續組合較高分
    score = 50 + sameRatio * 30;
  } else if (streakLength <= 5) {
    // 中等連續(3-5):跟龍,給予延續組合高分
    score = 50 + sameRatio * 40;
  } else {
    // 長龍(6+):考慮斬龍,給予反轉組合較高分
    score = 50 + (1 - sameRatio) * 50;
  }
  
  return score;
}

/**
 * 演算法 2: 單跳雙跳模式分析
 * 檢測歷史中的跳點模式
 */
function scoreJumpPattern(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length < 4) return 50;
  
  // 檢測最近的跳點模式
  const recent = filtered.slice(-Math.min(12, filtered.length));
  
  // 計算單跳頻率(交替)
  let singleJumps = 0;
  for (let i = 0; i < recent.length - 1; i++) {
    if (recent[i] !== recent[i + 1]) singleJumps++;
  }
  const singleJumpRatio = singleJumps / (recent.length - 1);
  
  // 計算雙跳頻率
  let doubleJumps = 0;
  for (let i = 0; i < recent.length - 3; i += 2) {
    if (recent[i] === recent[i + 1] && 
        recent[i + 2] === recent[i + 3] && 
        recent[i] !== recent[i + 2]) {
      doubleJumps++;
    }
  }
  
  // 計算組合的跳點特性
  let combJumps = 0;
  let prev = filtered[filtered.length - 1];
  for (const next of combination) {
    if (next !== prev) combJumps++;
    prev = next as 'B' | 'P';
  }
  const combJumpRatio = combJumps / combination.length;
  
  let score = 50;
  
  if (singleJumpRatio > 0.7) {
    // 單跳模式:期望組合也是單跳
    score = 50 + combJumpRatio * 50;
  } else if (doubleJumps >= 2) {
    // 雙跳模式:期望組合是雙跳(跳點率約0.5)
    const doubleJumpIdeal = 0.5;
    const deviation = Math.abs(combJumpRatio - doubleJumpIdeal);
    score = 50 + (1 - deviation * 2) * 40;
  } else {
    // 無明顯模式:給予平衡組合較高分
    score = 50 + (1 - Math.abs(combJumpRatio - 0.5) * 2) * 30;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * 演算法 3: 路單齊整度分析
 * 檢測路單的規律性,預測延續或改變
 */
function scoreRoadRegularity(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length < 6) return 50;
  
  // 計算歷史的規律性(熵值)
  const chunks: number[] = [];
  let currentStreak = 1;
  
  for (let i = 1; i < filtered.length; i++) {
    if (filtered[i] === filtered[i - 1]) {
      currentStreak++;
    } else {
      chunks.push(currentStreak);
      currentStreak = 1;
    }
  }
  chunks.push(currentStreak);
  
  // 計算連續長度的標準差(規律性指標)
  const mean = chunks.reduce((a, b) => a + b, 0) / chunks.length;
  const variance = chunks.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / chunks.length;
  const stdDev = Math.sqrt(variance);
  
  // 規律性分數:標準差越小越規律
  const regularity = Math.max(0, 1 - stdDev / 3);
  
  // 計算組合的連續長度
  const combChunks: number[] = [];
  let combStreak = 1;
  let prev = filtered[filtered.length - 1];
  
  for (const next of combination) {
    if (next === prev) {
      combStreak++;
    } else {
      combChunks.push(combStreak);
      combStreak = 1;
    }
    prev = next as 'B' | 'P';
  }
  combChunks.push(combStreak);
  
  const combMean = combChunks.reduce((a, b) => a + b, 0) / combChunks.length;
  
  let score = 50;
  
  if (regularity > 0.5) {
    // 路單規律:期望組合也規律(連續長度接近歷史平均)
    const deviation = Math.abs(combMean - mean);
    score = 50 + (1 - Math.min(1, deviation / 2)) * 40;
  } else {
    // 路單不規律:給予多樣化組合較高分
    score = 50 + (combChunks.length / combination.length) * 30;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * 演算法 4: 補償理論
 * 基於長期莊閒應該趨向平衡的理論
 */
function scoreCompensation(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length === 0) return 50;
  
  // 計算歷史中的莊閒比例
  const bCount = filtered.filter(r => r === 'B').length;
  const pCount = filtered.filter(r => r === 'P').length;
  const bRatio = bCount / filtered.length;
  
  // 計算組合的莊閒比例
  const combBCount = combination.filter(r => r === 'B').length;
  const combPCount = combination.filter(r => r === 'P').length;
  
  // 計算加上組合後的整體比例
  const totalBCount = bCount + combBCount;
  const totalPCount = pCount + combPCount;
  const newBRatio = totalBCount / (totalBCount + totalPCount);
  
  // 計算偏離度改善
  const currentDeviation = Math.abs(bRatio - 0.5);
  const newDeviation = Math.abs(newBRatio - 0.5);
  const improvement = currentDeviation - newDeviation;
  
  // 轉換為分數
  const score = 50 + improvement * 200;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * 生成所有可能的組合
 */
function generateCombinations(length: number): GameResult[][] {
  const combinations: GameResult[][] = [];
  const total = Math.pow(2, length);
  
  for (let i = 0; i < total; i++) {
    const combination: GameResult[] = [];
    for (let j = 0; j < length; j++) {
      combination.push((i & (1 << j)) ? 'P' : 'B');
    }
    combinations.push(combination);
  }
  
  return combinations;
}

/**
 * 百家樂專業預測函數
 */
export function predictBaccaratPro(history: GameResult[], n: number = 7): {
  prediction: GameResult[];
  scores: {
    dragon: number;
    jump: number;
    regularity: number;
    compensation: number;
    total: number;
  };
} {
  const combinations = generateCombinations(n);
  
  // 演算法權重
  const weights = {
    dragon: 0.30,        // 長龍斬龍分析
    jump: 0.30,          // 單跳雙跳模式
    regularity: 0.25,    // 路單齊整度
    compensation: 0.15,  // 補償理論
  };
  
  let bestCombination: GameResult[] = combinations[0];
  let bestScore = -Infinity;
  let bestScores = { dragon: 0, jump: 0, regularity: 0, compensation: 0 };
  
  for (const combination of combinations) {
    const dragonScore = scoreDragonAnalysis(history, combination);
    const jumpScore = scoreJumpPattern(history, combination);
    const regularityScore = scoreRoadRegularity(history, combination);
    const compensationScore = scoreCompensation(history, combination);
    
    const totalScore = 
      dragonScore * weights.dragon +
      jumpScore * weights.jump +
      regularityScore * weights.regularity +
      compensationScore * weights.compensation;
    
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestCombination = combination;
      bestScores = {
        dragon: dragonScore,
        jump: jumpScore,
        regularity: regularityScore,
        compensation: compensationScore,
      };
    }
  }
  
  return {
    prediction: bestCombination,
    scores: {
      ...bestScores,
      total: bestScore,
    },
  };
}

