/**
 * 隨機進場點測試
 * 模擬真實情境:在已經發牌 10-80 局後才進場
 */

import { predictWithScores, type GameResult } from './client/src/lib/predictor';

// 使用最佳策略:激進前置
const BEST_STRATEGY = {
  name: '激進前置',
  bets: [4000, 4000, 4000, 1000, 1000, 1000, 1000],
  totalBankroll: 16000,
};

// 牌組相關
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
 * 跳過指定數量的局數(模擬已經發牌)
 */
function skipHands(shoe: Card[], position: number, handsToSkip: number): number {
  let currentPosition = position;
  for (let i = 0; i < handsToSkip; i++) {
    const { cardsUsed } = dealHand(shoe, currentPosition);
    currentPosition += cardsUsed;
    
    // 如果牌不夠了,返回當前位置
    if (currentPosition > 316) {
      break;
    }
  }
  return currentPosition;
}

function runRound(shoe: Card[], startPosition: number): {
  success: boolean;
  profit: number;
  matchPosition: number | null;
  cardsUsed: number;
} {
  let position = startPosition;
  
  const history: GameResult[] = [];
  for (let i = 0; i < 7; i++) {
    const { result, cardsUsed } = dealHand(shoe, position);
    history.push(result);
    position += cardsUsed;
  }
  
  const predictionResult = predictWithScores(history, 7);
  const predicted = predictionResult.prediction;
  
  let matchPosition: number | null = null;
  let profit = 0;
  
  for (let i = 0; i < 7; i++) {
    const { result, cardsUsed } = dealHand(shoe, position);
    position += cardsUsed;
    
    if (matchPosition === null && predicted[i] === result) {
      matchPosition = i + 1;
      profit = BEST_STRATEGY.bets[i];
      break;
    }
  }
  
  if (matchPosition === null) {
    profit = -BEST_STRATEGY.totalBankroll;
  }
  
  const success = matchPosition !== null;
  const cardsUsed = position - startPosition;
  
  return { success, profit, matchPosition, cardsUsed };
}

/**
 * 隨機進場點測試
 */
function testRandomEntry(rounds: number = 2000) {
  console.log(`\n${'='.repeat(80)}`);
  console.log('隨機進場點測試 - 模擬真實賭場情境');
  console.log(`${'='.repeat(80)}\n`);
  
  console.log(`測試設定:`);
  console.log(`  策略: ${BEST_STRATEGY.name}`);
  console.log(`  賭注: [${BEST_STRATEGY.bets.join(', ')}]`);
  console.log(`  本金: ${BEST_STRATEGY.totalBankroll.toLocaleString()}元`);
  console.log(`  測試輪數: ${rounds}`);
  console.log(`  進場時機: 隨機跳過 10-80 局後進場\n`);
  
  console.log(`真實情境模擬:`);
  console.log(`  - 每輪測試前,隨機跳過 10-80 局(模擬已經發牌)`);
  console.log(`  - 牌組分布已改變,不是初始狀態`);
  console.log(`  - 更貼近實際走進賭場坐下的情況\n`);
  
  console.log(`開始測試...\n`);
  
  let shoe = shuffleShoe(createShoe());
  let shoePosition = 0;
  
  // 統計數據
  let totalProfit = 0;
  let successCount = 0;
  let totalRounds = 0;
  
  // 資金曲線
  const equityCurve: number[] = [0];
  let currentEquity = 0;
  let maxEquity = 0;
  let minEquity = 0;
  let maxDrawdown = 0;
  
  // 進場時機統計
  const entryPointStats = {
    early: { count: 0, success: 0, profit: 0 },    // 10-30局
    mid: { count: 0, success: 0, profit: 0 },      // 31-55局
    late: { count: 0, success: 0, profit: 0 },     // 56-80局
  };
  
  // 連續統計
  let consecutiveLosses = 0;
  let maxConsecutiveLosses = 0;
  let consecutiveWins = 0;
  let maxConsecutiveWins = 0;
  
  // 詳細記錄
  const detailedLog: any[] = [];
  
  for (let round = 1; round <= rounds; round++) {
    // 檢查是否需要重新洗牌
    if (shoePosition > 316) {
      shoe = shuffleShoe(createShoe());
      shoePosition = 0;
    }
    
    // 隨機跳過 10-80 局(模擬已經發牌)
    const handsToSkip = Math.floor(Math.random() * 71) + 10; // 10-80
    shoePosition = skipHands(shoe, shoePosition, handsToSkip);
    
    // 如果跳過後牌不夠了,重新洗牌
    if (shoePosition > 316) {
      shoe = shuffleShoe(createShoe());
      shoePosition = 0;
      shoePosition = skipHands(shoe, shoePosition, handsToSkip);
    }
    
    // 記錄進場時機
    let entryCategory: 'early' | 'mid' | 'late';
    if (handsToSkip <= 30) {
      entryCategory = 'early';
    } else if (handsToSkip <= 55) {
      entryCategory = 'mid';
    } else {
      entryCategory = 'late';
    }
    
    // 執行測試
    const result = runRound(shoe, shoePosition);
    shoePosition += result.cardsUsed;
    
    totalRounds++;
    totalProfit += result.profit;
    currentEquity += result.profit;
    equityCurve.push(currentEquity);
    
    // 更新進場時機統計
    entryPointStats[entryCategory].count++;
    entryPointStats[entryCategory].profit += result.profit;
    if (result.success) {
      entryPointStats[entryCategory].success++;
    }
    
    // 更新最大/最小資金
    if (currentEquity > maxEquity) {
      maxEquity = currentEquity;
    }
    if (currentEquity < minEquity) {
      minEquity = currentEquity;
    }
    
    const currentDrawdown = maxEquity - currentEquity;
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }
    
    // 連續統計
    if (result.success) {
      successCount++;
      consecutiveWins++;
      consecutiveLosses = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
    } else {
      consecutiveLosses++;
      consecutiveWins = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
    }
    
    // 記錄前10輪和失敗案例
    if (round <= 10 || !result.success) {
      detailedLog.push({
        round,
        entryPoint: handsToSkip,
        entryCategory,
        success: result.success ? '✓' : '✗',
        matchPosition: result.matchPosition || '-',
        profit: result.profit,
        equity: currentEquity,
      });
    }
    
    // 進度顯示
    if (round % 100 === 0) {
      const progress = (round / rounds * 100).toFixed(0);
      const rate = (successCount / totalRounds * 100).toFixed(1);
      process.stdout.write(`\r進度: ${progress}% (${round}/${rounds}) | 成功率: ${rate}% | 當前資金: ${currentEquity.toLocaleString()}元`);
    }
  }
  
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('測試結果統計');
  console.log(`${'='.repeat(80)}\n`);
  
  const successRate = (successCount / totalRounds * 100).toFixed(2);
  const avgProfit = (totalProfit / totalRounds).toFixed(2);
  
  console.log(`基本統計:`);
  console.log(`  總測試輪數: ${totalRounds}`);
  console.log(`  成功次數: ${successCount} (${successRate}%)`);
  console.log(`  失敗次數: ${totalRounds - successCount} (${(100 - parseFloat(successRate)).toFixed(2)}%)`);
  console.log(`  總獲利: ${totalProfit.toLocaleString()}元`);
  console.log(`  平均每輪: ${avgProfit}元\n`);
  
  console.log(`資金曲線:`);
  console.log(`  起始資金: 0元`);
  console.log(`  最終資金: ${currentEquity.toLocaleString()}元`);
  console.log(`  最高資金: ${maxEquity.toLocaleString()}元`);
  console.log(`  最低資金: ${minEquity.toLocaleString()}元`);
  console.log(`  最大回撤: ${maxDrawdown.toLocaleString()}元 (${((maxDrawdown / Math.max(maxEquity, 1)) * 100).toFixed(2)}%)\n`);
  
  console.log(`風險指標:`);
  console.log(`  最大連續勝利: ${maxConsecutiveWins}輪`);
  console.log(`  最大連續失敗: ${maxConsecutiveLosses}輪\n`);
  
  console.log(`進場時機分析:`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`時機     | 次數  | 成功率  | 總獲利        | 平均獲利`);
  console.log(`${'─'.repeat(80)}`);
  
  Object.entries(entryPointStats).forEach(([key, stats]) => {
    const label = key === 'early' ? '早期(10-30局)' : key === 'mid' ? '中期(31-55局)' : '後期(56-80局)';
    const count = stats.count.toString().padStart(5);
    const rate = ((stats.success / stats.count) * 100).toFixed(1).padStart(6);
    const profit = stats.profit.toLocaleString().padStart(13);
    const avg = (stats.profit / stats.count).toFixed(0).padStart(8);
    console.log(`${label} | ${count} | ${rate}% | ${profit}元 | ${avg}元`);
  });
  
  console.log(`\n前10輪詳細記錄:`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`輪次 | 進場點 | 時機 | 結果 | 命中 | 本輪獲利 | 累積資金`);
  console.log(`${'─'.repeat(80)}`);
  
  detailedLog.filter(l => l.round <= 10).forEach(log => {
    const round = log.round.toString().padStart(4);
    const entry = log.entryPoint.toString().padStart(6);
    const category = log.entryCategory === 'early' ? '早期' : log.entryCategory === 'mid' ? '中期' : '後期';
    const success = log.success.padEnd(4);
    const match = log.matchPosition.toString().padStart(4);
    const profit = (log.profit > 0 ? '+' : '') + log.profit.toLocaleString().padStart(10);
    const equity = log.equity.toLocaleString().padStart(10);
    console.log(`${round} | ${entry}局 | ${category} | ${success} | ${match} | ${profit}元 | ${equity}元`);
  });
  
  // 失敗記錄
  const failureLogs = detailedLog.filter(l => !l.success && l.round > 10);
  if (failureLogs.length > 0) {
    console.log(`\n失敗記錄 (第11輪後):`);
    console.log(`${'─'.repeat(80)}`);
    failureLogs.forEach(log => {
      console.log(`  第${log.round}輪 (進場點:第${log.entryPoint}局): 虧損${Math.abs(log.profit).toLocaleString()}元, 累積: ${log.equity.toLocaleString()}元`);
    });
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('結論分析');
  console.log(`${'='.repeat(80)}\n`);
  
  if (parseFloat(successRate) >= 95) {
    console.log(`✓ 成功率優秀 (${successRate}%)`);
  } else if (parseFloat(successRate) >= 85) {
    console.log(`○ 成功率良好 (${successRate}%)`);
  } else {
    console.log(`✗ 成功率偏低 (${successRate}%)`);
  }
  
  if (totalProfit > 0) {
    console.log(`✓ 整體獲利 (+${totalProfit.toLocaleString()}元)`);
  } else {
    console.log(`✗ 整體虧損 (${totalProfit.toLocaleString()}元)`);
  }
  
  if (minEquity >= 0) {
    console.log(`✓ 資金曲線穩定,從未虧損`);
  } else {
    console.log(`⚠ 曾出現虧損 (最低${minEquity.toLocaleString()}元)`);
  }
  
  // 進場時機建議
  const bestEntry = Object.entries(entryPointStats).reduce((best, [key, stats]) => {
    const avgProfit = stats.profit / stats.count;
    if (avgProfit > best.avgProfit) {
      return { key, avgProfit };
    }
    return best;
  }, { key: '', avgProfit: -Infinity });
  
  const entryLabel = bestEntry.key === 'early' ? '早期(10-30局)' : 
                     bestEntry.key === 'mid' ? '中期(31-55局)' : '後期(56-80局)';
  console.log(`\n💡 最佳進場時機: ${entryLabel}`);
  
  console.log(`\n${'='.repeat(80)}\n`);
}

// 執行測試
const testRounds = process.argv[2] ? parseInt(process.argv[2]) : 2000;
testRandomEntry(testRounds);

