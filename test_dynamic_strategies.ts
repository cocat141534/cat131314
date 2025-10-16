/**
 * 動態調整策略完整測試
 * 對比固定策略 vs 多種動態調整方案
 */

import { predictWithScores, type GameResult } from './client/src/lib/predictor';

// 策略定義
interface Strategy {
  name: string;
  description: string;
  getBets: (context: StrategyContext) => number[];
}

interface StrategyContext {
  remainingBankroll: number;
  initialBankroll: number;
  lastMatchPosition: number | null;
  consecutiveFailures: number;
  cumulativeProfit: number;
  roundNumber: number;
}

// 定義各種策略
const STRATEGIES: Strategy[] = [
  {
    name: '固定激進策略',
    description: '始終使用激進前置,不做調整',
    getBets: () => [4000, 4000, 4000, 1000, 1000, 1000, 1000],
  },
  {
    name: '本金比例調整',
    description: '根據剩餘本金比例動態縮放賭注',
    getBets: (ctx) => {
      const ratio = ctx.remainingBankroll / ctx.initialBankroll;
      const base = [4000, 4000, 4000, 1000, 1000, 1000, 1000];
      
      if (ratio >= 1.0) {
        // 本金充足,維持激進
        return base;
      } else if (ratio >= 0.5) {
        // 本金減半,賭注減半
        return base.map(b => Math.floor(b * 0.5));
      } else if (ratio >= 0.25) {
        // 本金剩1/4,賭注減至1/4
        return base.map(b => Math.floor(b * 0.25));
      } else {
        // 本金不足1/4,最保守
        return [500, 500, 500, 300, 300, 300, 300];
      }
    },
  },
  {
    name: '表現反應調整',
    description: '根據上輪命中位置調整策略',
    getBets: (ctx) => {
      if (ctx.lastMatchPosition === null) {
        // 上輪失敗,改用保守策略
        return [2000, 2000, 2000, 1000, 1000, 500, 500];
      } else if (ctx.lastMatchPosition <= 2) {
        // 上輪前2局命中,維持激進
        return [4000, 4000, 4000, 1000, 1000, 1000, 1000];
      } else if (ctx.lastMatchPosition <= 4) {
        // 上輪中期命中,適度保守
        return [3000, 3000, 3000, 1000, 1000, 800, 800];
      } else {
        // 上輪後期命中,較保守
        return [2000, 2000, 2000, 1000, 1000, 800, 800];
      }
    },
  },
  {
    name: '連敗保護調整',
    description: '根據連續失敗次數降低風險',
    getBets: (ctx) => {
      const base = [4000, 4000, 4000, 1000, 1000, 1000, 1000];
      
      if (ctx.consecutiveFailures === 0) {
        return base;
      } else if (ctx.consecutiveFailures === 1) {
        // 失敗1次,降低30%
        return base.map(b => Math.floor(b * 0.7));
      } else if (ctx.consecutiveFailures === 2) {
        // 失敗2次,降低50%
        return base.map(b => Math.floor(b * 0.5));
      } else {
        // 失敗3次以上,最保守
        return [1000, 1000, 1000, 500, 500, 500, 500];
      }
    },
  },
  {
    name: '盈虧平衡調整',
    description: '虧損時保守,獲利時激進',
    getBets: (ctx) => {
      if (ctx.cumulativeProfit >= 0) {
        // 獲利狀態,維持激進
        return [4000, 4000, 4000, 1000, 1000, 1000, 1000];
      } else if (ctx.cumulativeProfit >= -8000) {
        // 小幅虧損,適度保守
        return [3000, 3000, 3000, 1000, 1000, 800, 800];
      } else if (ctx.cumulativeProfit >= -16000) {
        // 中度虧損,較保守
        return [2000, 2000, 2000, 1000, 1000, 500, 500];
      } else {
        // 大幅虧損,最保守
        return [1000, 1000, 1000, 500, 500, 500, 500];
      }
    },
  },
  {
    name: '混合智能調整',
    description: '綜合本金、表現、連敗、盈虧',
    getBets: (ctx) => {
      const base = [4000, 4000, 4000, 1000, 1000, 1000, 1000];
      let scale = 1.0;
      
      // 因素1: 本金比例
      const bankrollRatio = ctx.remainingBankroll / ctx.initialBankroll;
      if (bankrollRatio < 0.5) scale *= 0.6;
      else if (bankrollRatio < 0.75) scale *= 0.8;
      
      // 因素2: 連續失敗
      if (ctx.consecutiveFailures >= 2) scale *= 0.5;
      else if (ctx.consecutiveFailures >= 1) scale *= 0.7;
      
      // 因素3: 上輪表現
      if (ctx.lastMatchPosition !== null && ctx.lastMatchPosition > 4) {
        scale *= 0.8;
      }
      
      // 因素4: 累積盈虧
      if (ctx.cumulativeProfit < -12000) scale *= 0.6;
      else if (ctx.cumulativeProfit < 0) scale *= 0.8;
      
      // 應用縮放
      const adjustedBets = base.map(b => Math.floor(b * scale));
      
      // 確保最低賭注
      return adjustedBets.map(b => Math.max(b, 300));
    },
  },
];

// 牌組相關(複製之前的代碼)
type CardRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
type CardSuit = '♠' | '♥' | '♦' | '♣';

interface Card {
  rank: CardRank;
  suit: CardSuit;
  value: number;
}

function createShoe(): Card[] {
  const ranks: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits: CardSuit[] = ['♠', '♥', '♦', '♣'];
  const shoe: Card[] = [];
  
  for (let deck = 0; deck < 8; deck++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        let value: number;
        if (rank === 'A') value = 1;
        else if (['10', 'J', 'Q', 'K'].includes(rank)) value = 0;
        else value = parseInt(rank);
        shoe.push({ rank, suit, value });
      }
    }
  }
  return shoe;
}

function shuffleShoe(shoe: Card[]): Card[] {
  const shuffled = [...shoe];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function calculatePoints(cards: Card[]): number {
  const sum = cards.reduce((total, card) => total + card.value, 0);
  return sum % 10;
}

function shouldDrawThirdCard(playerPoints: number, bankerPoints: number, playerThirdCard?: number): {
  playerDraws: boolean;
  bankerDraws: boolean;
} {
  let playerDraws = false;
  let bankerDraws = false;
  
  if (playerPoints >= 8 || bankerPoints >= 8) {
    return { playerDraws: false, bankerDraws: false };
  }
  
  if (playerPoints <= 5) {
    playerDraws = true;
  }
  
  if (!playerDraws) {
    if (bankerPoints <= 5) {
      bankerDraws = true;
    }
  } else {
    if (playerThirdCard !== undefined) {
      if (bankerPoints <= 2) {
        bankerDraws = true;
      } else if (bankerPoints === 3 && playerThirdCard !== 8) {
        bankerDraws = true;
      } else if (bankerPoints === 4 && [2, 3, 4, 5, 6, 7].includes(playerThirdCard)) {
        bankerDraws = true;
      } else if (bankerPoints === 5 && [4, 5, 6, 7].includes(playerThirdCard)) {
        bankerDraws = true;
      } else if (bankerPoints === 6 && [6, 7].includes(playerThirdCard)) {
        bankerDraws = true;
      }
    }
  }
  
  return { playerDraws, bankerDraws };
}

function dealHand(shoe: Card[], position: number): { result: GameResult; cardsUsed: number } {
  const playerCards = [shoe[position], shoe[position + 2]];
  const bankerCards = [shoe[position + 1], shoe[position + 3]];
  let cardsUsed = 4;
  
  let playerPoints = calculatePoints(playerCards);
  let bankerPoints = calculatePoints(bankerCards);
  
  const { playerDraws } = shouldDrawThirdCard(playerPoints, bankerPoints);
  
  let playerThirdCardValue: number | undefined;
  
  if (playerDraws) {
    const playerThirdCard = shoe[position + cardsUsed];
    playerCards.push(playerThirdCard);
    playerThirdCardValue = playerThirdCard.value;
    cardsUsed++;
    playerPoints = calculatePoints(playerCards);
  }
  
  const bankerDecision = shouldDrawThirdCard(
    calculatePoints([playerCards[0], playerCards[1]]),
    bankerPoints,
    playerThirdCardValue
  );
  
  if (bankerDecision.bankerDraws) {
    const bankerThirdCard = shoe[position + cardsUsed];
    bankerCards.push(bankerThirdCard);
    cardsUsed++;
    bankerPoints = calculatePoints(bankerCards);
  }
  
  let result: GameResult;
  if (playerPoints > bankerPoints) {
    result = 'P';
  } else if (bankerPoints > playerPoints) {
    result = 'B';
  } else {
    result = 'T';
  }
  
  return { result, cardsUsed };
}

/**
 * 使用特定策略執行一輪測試
 */
function runRoundWithDynamicStrategy(
  shoe: Card[],
  startPosition: number,
  strategy: Strategy,
  context: StrategyContext
): {
  success: boolean;
  profit: number;
  matchPosition: number | null;
  cardsUsed: number;
  betsUsed: number[];
} {
  let position = startPosition;
  
  // 生成7局歷史
  const history: GameResult[] = [];
  for (let i = 0; i < 7; i++) {
    const { result, cardsUsed } = dealHand(shoe, position);
    history.push(result);
    position += cardsUsed;
  }
  
  // 預測接下來7局
  const predictionResult = predictWithScores(history, 7);
  const predicted = predictionResult.prediction;
  
  // 根據策略獲取本輪賭注
  const bets = strategy.getBets(context);
  const totalBankroll = bets.reduce((sum, b) => sum + b, 0);
  
  // 實際發牌7局並下注
  let matchPosition: number | null = null;
  let profit = 0;
  const betsUsed: number[] = [];
  
  for (let i = 0; i < 7; i++) {
    const { result, cardsUsed } = dealHand(shoe, position);
    position += cardsUsed;
    
    betsUsed.push(bets[i]);
    
    // 檢查是否命中
    if (matchPosition === null && predicted[i] === result) {
      matchPosition = i + 1;
      profit = bets[i]; // 贏得該局賭注
      break;
    }
  }
  
  // 如果7局都沒中,虧損全部賭注
  if (matchPosition === null) {
    profit = -totalBankroll;
  }
  
  const success = matchPosition !== null;
  const cardsUsed = position - startPosition;
  
  return { success, profit, matchPosition, cardsUsed, betsUsed };
}

/**
 * 測試單一策略
 */
function testDynamicStrategy(strategy: Strategy, rounds: number = 1000, initialBankroll: number = 16000) {
  let shoe = shuffleShoe(createShoe());
  let shoePosition = 0;
  
  let remainingBankroll = initialBankroll;
  let cumulativeProfit = 0;
  let successCount = 0;
  let totalRounds = 0;
  let bankruptcyRound = -1;
  let consecutiveFailures = 0;
  let maxConsecutiveFailures = 0;
  let lastMatchPosition: number | null = null;
  
  const equityCurve: number[] = [0];
  let maxEquity = 0;
  let minEquity = 0;
  let maxDrawdown = 0;
  
  while (totalRounds < rounds && remainingBankroll > 0) {
    if (shoePosition > 316) {
      shoe = shuffleShoe(createShoe());
      shoePosition = 0;
    }
    
    // 構建策略上下文
    const context: StrategyContext = {
      remainingBankroll,
      initialBankroll,
      lastMatchPosition,
      consecutiveFailures,
      cumulativeProfit,
      roundNumber: totalRounds + 1,
    };
    
    // 執行測試
    const result = runRoundWithDynamicStrategy(shoe, shoePosition, strategy, context);
    shoePosition += result.cardsUsed;
    
    // 檢查本金是否足夠
    const requiredBankroll = result.betsUsed.reduce((sum, b) => sum + b, 0);
    if (remainingBankroll < requiredBankroll) {
      bankruptcyRound = totalRounds + 1;
      break;
    }
    
    totalRounds++;
    remainingBankroll += result.profit;
    cumulativeProfit += result.profit;
    equityCurve.push(cumulativeProfit);
    
    // 更新統計
    if (result.success) {
      successCount++;
      consecutiveFailures = 0;
      lastMatchPosition = result.matchPosition;
    } else {
      consecutiveFailures++;
      maxConsecutiveFailures = Math.max(maxConsecutiveFailures, consecutiveFailures);
      lastMatchPosition = null;
    }
    
    // 更新資金曲線
    if (cumulativeProfit > maxEquity) {
      maxEquity = cumulativeProfit;
    }
    if (cumulativeProfit < minEquity) {
      minEquity = cumulativeProfit;
    }
    const currentDrawdown = maxEquity - cumulativeProfit;
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }
  }
  
  const successRate = totalRounds > 0 ? (successCount / totalRounds * 100) : 0;
  const avgProfit = totalRounds > 0 ? (cumulativeProfit / totalRounds) : 0;
  const bankrupted = bankruptcyRound !== -1;
  
  return {
    strategy: strategy.name,
    totalRounds,
    successCount,
    successRate,
    cumulativeProfit,
    avgProfit,
    remainingBankroll,
    bankrupted,
    bankruptcyRound,
    maxConsecutiveFailures,
    maxDrawdown,
    minEquity,
  };
}

/**
 * 對比測試所有策略
 */
function compareAllStrategies(rounds: number = 1000, simulations: number = 100) {
  console.log(`\n${'='.repeat(90)}`);
  console.log('動態調整策略完整對比測試');
  console.log(`${'='.repeat(90)}\n`);
  
  console.log(`測試設定:`);
  console.log(`  初始本金: 16,000元`);
  console.log(`  目標輪數: ${rounds}輪`);
  console.log(`  模擬次數: ${simulations}次`);
  console.log(`  策略數量: ${STRATEGIES.length}種\n`);
  
  console.log(`策略列表:`);
  STRATEGIES.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name} - ${s.description}`);
  });
  
  console.log(`\n開始測試...\n`);
  
  const allResults: any[] = [];
  
  STRATEGIES.forEach((strategy, index) => {
    process.stdout.write(`測試策略 ${index + 1}/${STRATEGIES.length}: ${strategy.name}...`);
    
    const simResults: any[] = [];
    
    for (let sim = 0; sim < simulations; sim++) {
      const result = testDynamicStrategy(strategy, rounds, 16000);
      simResults.push(result);
    }
    
    // 統計結果
    const bankruptcyCount = simResults.filter(r => r.bankrupted).length;
    const avgProfit = simResults.reduce((sum, r) => sum + r.cumulativeProfit, 0) / simulations;
    const avgRounds = simResults.reduce((sum, r) => sum + r.totalRounds, 0) / simulations;
    const avgSuccessRate = simResults.reduce((sum, r) => sum + r.successRate, 0) / simulations;
    const avgMaxDrawdown = simResults.reduce((sum, r) => sum + r.maxDrawdown, 0) / simulations;
    
    allResults.push({
      strategy: strategy.name,
      bankruptcyRate: (bankruptcyCount / simulations * 100).toFixed(1),
      avgProfit: avgProfit.toFixed(0),
      avgRounds: avgRounds.toFixed(0),
      avgSuccessRate: avgSuccessRate.toFixed(1),
      avgMaxDrawdown: avgMaxDrawdown.toFixed(0),
    });
    
    console.log(` 完成`);
  });
  
  console.log(`\n${'='.repeat(90)}`);
  console.log('測試結果對比');
  console.log(`${'='.repeat(90)}\n`);
  
  // 按平均獲利排序
  allResults.sort((a, b) => parseFloat(b.avgProfit) - parseFloat(a.avgProfit));
  
  console.log(`排名 | 策略名稱           | 破產率 | 平均獲利   | 成功率 | 最大回撤   | 平均輪數`);
  console.log(`${'─'.repeat(90)}`);
  
  allResults.forEach((r, i) => {
    const rank = (i + 1).toString().padStart(2);
    const name = r.strategy.padEnd(18);
    const bankrupt = `${r.bankruptcyRate}%`.padStart(6);
    const profit = `${parseFloat(r.avgProfit).toLocaleString()}元`.padStart(10);
    const success = `${r.avgSuccessRate}%`.padStart(6);
    const drawdown = `${parseFloat(r.avgMaxDrawdown).toLocaleString()}元`.padStart(10);
    const rounds = r.avgRounds.padStart(8);
    
    console.log(`${rank}   ${name}  ${bankrupt}  ${profit}  ${success}  ${drawdown}  ${rounds}`);
  });
  
  console.log(`\n${'='.repeat(90)}`);
  console.log('結論分析');
  console.log(`${'='.repeat(90)}\n`);
  
  const best = allResults[0];
  const safest = allResults.reduce((a, b) => parseFloat(a.bankruptcyRate) < parseFloat(b.bankruptcyRate) ? a : b);
  
  console.log(`🏆 最高獲利策略: ${best.strategy}`);
  console.log(`   平均獲利: ${parseFloat(best.avgProfit).toLocaleString()}元`);
  console.log(`   破產率: ${best.bankruptcyRate}%`);
  console.log(`   成功率: ${best.avgSuccessRate}%\n`);
  
  console.log(`🛡️  最安全策略: ${safest.strategy}`);
  console.log(`   破產率: ${safest.bankruptcyRate}%`);
  console.log(`   平均獲利: ${parseFloat(safest.avgProfit).toLocaleString()}元\n`);
  
  // 推薦策略
  const recommended = allResults.find(r => parseFloat(r.bankruptcyRate) < 5 && parseFloat(r.avgProfit) > 0);
  if (recommended) {
    console.log(`💡 推薦策略: ${recommended.strategy}`);
    console.log(`   兼顧獲利與安全性`);
    console.log(`   破產率: ${recommended.bankruptcyRate}%`);
    console.log(`   平均獲利: ${parseFloat(recommended.avgProfit).toLocaleString()}元`);
  }
  
  console.log(`\n${'='.repeat(90)}\n`);
}

// 執行測試
const testRounds = process.argv[2] ? parseInt(process.argv[2]) : 1000;
const simCount = process.argv[3] ? parseInt(process.argv[3]) : 100;
compareAllStrategies(testRounds, simCount);

