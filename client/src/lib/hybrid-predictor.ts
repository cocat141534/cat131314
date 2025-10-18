export type GameResult = 'B' | 'P' | 'T';

/**
 * 混合預測演算法
 * 結合舊演算法(馬可夫鏈、模式延續、頻率平衡)
 * 和新百家樂專業演算法(長龍斬龍、單雙跳、路單齊整)
 */

// ==================== 舊演算法 ====================

/**
 * 馬可夫鏈評分
 */
function scoreMarkovChain(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length === 0) return 50;
  
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
  
  const smoothing = 5;
  const bTotal = transitions['B->B'] + transitions['B->P'] + smoothing * 2;
  const pTotal = transitions['P->B'] + transitions['P->P'] + smoothing * 2;
  
  let probBB = (transitions['B->B'] + smoothing) / bTotal;
  let probBP = (transitions['B->P'] + smoothing) / bTotal;
  let probPB = (transitions['P->B'] + smoothing) / pTotal;
  let probPP = (transitions['P->P'] + smoothing) / pTotal;
  
  probBB = Math.max(0.2, Math.min(0.8, probBB));
  probBP = Math.max(0.2, Math.min(0.8, probBP));
  probPB = Math.max(0.2, Math.min(0.8, probPB));
  probPP = Math.max(0.2, Math.min(0.8, probPP));
  
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
  
  const normalizedScore = Math.max(0, Math.min(100, (logProb + 10) * 10));
  return normalizedScore;
}

/**
 * 模式延續性評分
 */
function scorePatternContinuity(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length === 0) return 50;
  
  const lastValue = filtered[filtered.length - 1];
  let streakLength = 1;
  for (let i = filtered.length - 2; i >= 0; i--) {
    if (filtered[i] === lastValue) {
      streakLength++;
    } else {
      break;
    }
  }
  
  let patternScore = 50;
  
  if (streakLength >= 2) {
    const sameCount = combination.filter(r => r === lastValue).length;
    const sameRatio = sameCount / combination.length;
    const streakFactor = Math.min(streakLength / 10, 0.3);
    
    const optimalRatio = 0.5;
    const ratioDeviation = Math.abs(sameRatio - optimalRatio);
    const ratioScore = 1 - ratioDeviation * 2;
    
    patternScore = 50 + ratioScore * 30 * streakFactor;
    return patternScore;
  }
  
  return 50;
}

/**
 * 頻率平衡評分
 */
function scoreFrequencyBalance(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length === 0) return 50;
  
  const bCount = filtered.filter(r => r === 'B').length;
  const pCount = filtered.filter(r => r === 'P').length;
  const bRatio = bCount / filtered.length;
  
  const currentDeviation = Math.abs(bRatio - 0.5);
  
  const combBCount = combination.filter(r => r === 'B').length;
  const combPCount = combination.filter(r => r === 'P').length;
  
  const totalBCount = bCount + combBCount;
  const totalPCount = pCount + combPCount;
  const newBRatio = totalBCount / (totalBCount + totalPCount);
  const newDeviation = Math.abs(newBRatio - 0.5);
  
  const improvement = currentDeviation - newDeviation;
  const normalizedImprovement = Math.max(-0.2, Math.min(0.2, improvement));
  
  return 50 + normalizedImprovement * 250;
}

// ==================== 新百家樂專業演算法 ====================

/**
 * 長龍斬龍分析
 */
function scoreDragonAnalysis(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length === 0) return 50;
  
  const lastValue = filtered[filtered.length - 1];
  let streakLength = 1;
  for (let i = filtered.length - 2; i >= 0; i--) {
    if (filtered[i] === lastValue) {
      streakLength++;
    } else {
      break;
    }
  }
  
  const sameCount = combination.filter(r => r === lastValue).length;
  const sameRatio = sameCount / combination.length;
  
  let score = 50;
  
  if (streakLength <= 2) {
    score = 50 + sameRatio * 30;
  } else if (streakLength <= 5) {
    score = 50 + sameRatio * 40;
  } else {
    score = 50 + (1 - sameRatio) * 50;
  }
  
  return score;
}

/**
 * 單跳雙跳模式分析
 */
function scoreJumpPattern(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length < 4) return 50;
  
  const recent = filtered.slice(-Math.min(12, filtered.length));
  
  let singleJumps = 0;
  for (let i = 0; i < recent.length - 1; i++) {
    if (recent[i] !== recent[i + 1]) singleJumps++;
  }
  const singleJumpDivisor = Math.max(1, recent.length - 1);
  const singleJumpRatio = singleJumps / singleJumpDivisor;
  
  let doubleJumps = 0;
  for (let i = 0; i < recent.length - 3; i += 2) {
    if (recent[i] === recent[i + 1] && 
        recent[i + 2] === recent[i + 3] && 
        recent[i] !== recent[i + 2]) {
      doubleJumps++;
    }
  }
  
  let combJumps = 0;
  let prev = filtered[filtered.length - 1];
  for (const next of combination) {
    if (next !== prev) combJumps++;
    prev = next as 'B' | 'P';
  }
  const combJumpRatio = combination.length > 0 ? combJumps / combination.length : 0;
  
  let score = 50;
  
  if (singleJumpRatio > 0.7) {
    score = 50 + combJumpRatio * 50;
  } else if (doubleJumps >= 2) {
    const doubleJumpIdeal = 0.5;
    const deviation = Math.abs(combJumpRatio - doubleJumpIdeal);
    score = 50 + (1 - deviation * 2) * 40;
  } else {
    score = 50 + (1 - Math.abs(combJumpRatio - 0.5) * 2) * 30;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * 路單齊整度分析
 */
function scoreRoadRegularity(history: GameResult[], combination: GameResult[]): number {
  const filtered = history.filter(r => r !== 'T');
  
  if (filtered.length < 6) return 50;
  
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
  
  const mean = chunks.reduce((a, b) => a + b, 0) / chunks.length;
  const variance = chunks.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / chunks.length;
  const stdDev = Math.sqrt(variance);
  
  const regularity = Math.max(0, 1 - stdDev / 3);
  
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
    const deviation = Math.abs(combMean - mean);
    score = 50 + (1 - Math.min(1, deviation / 2)) * 40;
  } else {
    score = 50 + (combChunks.length / combination.length) * 30;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * 隨機預測評分
 */
function scoreRandom(history: GameResult[], combination: GameResult[]): number {
  const seed = history.length;
  let hash = seed;
  
  for (let i = 0; i < combination.length; i++) {
    hash = ((hash << 5) - hash) + (combination[i] === 'B' ? 1 : 0);
    hash = hash & hash;
  }
  
  return Math.abs(hash % 100);
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
 * 混合預測函數
 */
export function predictHybrid(history: GameResult[], n: number = 7): {
  prediction: GameResult[];
  scores: {
    markov: number;
    pattern: number;
    frequency: number;
    dragon: number;
    jump: number;
    regularity: number;
    random: number;
    total: number;
  };
} {
  const combinations = generateCombinations(n);
  
  // 先檢查是否有任何演算法分數>90 (使用第一個組合作為測試)
  const testCombination = combinations[0];
  const testScores = {
    markov: scoreMarkovChain(history, testCombination),
    pattern: scorePatternContinuity(history, testCombination),
    frequency: scoreFrequencyBalance(history, testCombination),
    dragon: scoreDragonAnalysis(history, testCombination),
    jump: scoreJumpPattern(history, testCombination),
    regularity: scoreRoadRegularity(history, testCombination),
  };
  const maxTestScore = Math.max(
    testScores.markov,
    testScores.pattern,
    testScores.frequency,
    testScores.dragon,
    testScores.jump,
    testScores.regularity
  );
  const shouldBoostRandom = maxTestScore > 94;
  
  // 混合權重
  let weights = {
    markov: 0.19,       // 舊:馬可夫鏈
    pattern: 0.19,      // 舊:模式延續
    frequency: 0.19,    // 舊:頻率平衡
    dragon: 0.13,       // 新:長龍斬龍
    jump: 0.13,         // 新:單雙跳
    regularity: 0.13,   // 新:路單齊整
    random: 0.04,       // 隨機(隱藏)
  };
  
  // 當某個演算法分數>94時,增加隨機權重
  if (shouldBoostRandom) {
    const extraRandom = 0.0093; // 增加0.93%
    const totalOtherWeights = 1 - weights.random;
    const scale = (1 - weights.random - extraRandom) / totalOtherWeights;
    
    // 按比例縮減其他權重
    weights = {
      markov: weights.markov * scale,
      pattern: weights.pattern * scale,
      frequency: weights.frequency * scale,
      dragon: weights.dragon * scale,
      jump: weights.jump * scale,
      regularity: weights.regularity * scale,
      random: weights.random + extraRandom, // 4% -> 4.93%
    };
  }
  
  let bestCombination: GameResult[] = combinations[0];
  let bestScore = -Infinity;
  let bestScores = {
    markov: 0,
    pattern: 0,
    frequency: 0,
    dragon: 0,
    jump: 0,
    regularity: 0,
    random: 0,
  };
  
  for (const combination of combinations) {
    const markovScore = scoreMarkovChain(history, combination);
    const patternScore = scorePatternContinuity(history, combination);
    const frequencyScore = scoreFrequencyBalance(history, combination);
    const dragonScore = scoreDragonAnalysis(history, combination);
    const jumpScore = scoreJumpPattern(history, combination);
    const regularityScore = scoreRoadRegularity(history, combination);
    const randomScore = scoreRandom(history, combination);
    
    // 正常混合權重
    const totalScore = 
      markovScore * weights.markov +
      patternScore * weights.pattern +
      frequencyScore * weights.frequency +
      dragonScore * weights.dragon +
      jumpScore * weights.jump +
      regularityScore * weights.regularity +
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
        regularity: regularityScore,
        random: randomScore,
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

