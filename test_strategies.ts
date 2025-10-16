/**
 * 多種賭注策略對比測試
 * 尋找最優資金管理方案
 */

import { predictWithScores, type GameResult } from './client/src/lib/predictor';

// 賭注策略定義
interface BettingStrategy {
  name: string;
  description: string;
  bets: number[];
  totalBankroll: number;
}

// 定義多種策略
const STRATEGIES: BettingStrategy[] = [
  {
    name: '原始倍投',
    description: '激進倍投,後期賭注過大',
    bets: [100, 300, 700, 1500, 3200, 6600, 12800],
    totalBankroll: 25200,
  },
  {
    name: '保守倍投',
    description: '降低倍投倍數,控制風險',
    bets: [200, 400, 800, 1600, 3200, 6400, 12800],
    totalBankroll: 25400,
  },
  {
    name: '線性遞增',
    description: '均勻遞增,平衡風險',
    bets: [1000, 2000, 3000, 4000, 5000, 6000, 7000],
    totalBankroll: 28000,
  },
  {
    name: '前重後輕',
    description: '前期多下,利用高命中率',
    bets: [3000, 3000, 2500, 2000, 1500, 1000, 500],
    totalBankroll: 13500,
  },
  {
    name: '固定金額',
    description: '每局固定金額,最保守',
    bets: [2000, 2000, 2000, 2000, 2000, 2000, 2000],
    totalBankroll: 14000,
  },
  {
    name: '優化倍投',
    description: '基於命中率統計優化的倍投',
    bets: [500, 1000, 1500, 2000, 2500, 3000, 3500],
    totalBankroll: 14000,
  },
  {
    name: '激進前置',
    description: '前3局重注,後4局保守',
    bets: [4000, 4000, 4000, 1000, 1000, 1000, 1000],
    totalBankroll: 16000,
  },
];

// 牌組相關(複製自test_realistic.ts)
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
  
  const { playerDraws, bankerDraws } = shouldDrawThirdCard(playerPoints, bankerPoints);
  
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
function runRoundWithStrategy(
  shoe: Card[],
  startPosition: number,
  strategy: BettingStrategy
): {
  success: boolean;
  profit: number;
  matchPosition: number | null;
  cardsUsed: number;
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
  
  // 實際發牌7局並下注
  let matchPosition: number | null = null;
  let profit = 0;
  
  for (let i = 0; i < 7; i++) {
    const { result, cardsUsed } = dealHand(shoe, position);
    position += cardsUsed;
    
    // 檢查是否命中
    if (matchPosition === null && predicted[i] === result) {
      matchPosition = i + 1;
      // 計算獲利
      const totalBet = strategy.bets.slice(0, i + 1).reduce((sum, bet) => sum + bet, 0);
      const winAmount = strategy.bets[i];
      profit = winAmount; // 只計算淨獲利
      break;
    }
  }
  
  // 如果7局都沒中,虧損全部本金
  if (matchPosition === null) {
    profit = -strategy.totalBankroll;
  }
  
  const success = matchPosition !== null;
  const cardsUsed = position - startPosition;
  
  return { success, profit, matchPosition, cardsUsed };
}

/**
 * 測試單一策略
 */
function testStrategy(strategy: BettingStrategy, rounds: number = 1000) {
  let shoe = shuffleShoe(createShoe());
  let shoePosition = 0;
  let totalProfit = 0;
  let successCount = 0;
  let totalRounds = 0;
  let maxConsecutiveLosses = 0;
  let currentConsecutiveLosses = 0;
  const positionHits = new Array(7).fill(0);
  
  while (totalRounds < rounds) {
    if (shoePosition > 316) {
      shoe = shuffleShoe(createShoe());
      shoePosition = 0;
    }
    
    const result = runRoundWithStrategy(shoe, shoePosition, strategy);
    shoePosition += result.cardsUsed;
    
    totalRounds++;
    totalProfit += result.profit;
    
    if (result.success) {
      successCount++;
      currentConsecutiveLosses = 0;
      if (result.matchPosition) {
        positionHits[result.matchPosition - 1]++;
      }
    } else {
      currentConsecutiveLosses++;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentConsecutiveLosses);
    }
  }
  
  const successRate = (successCount / totalRounds * 100).toFixed(2);
  const avgProfit = (totalProfit / totalRounds).toFixed(2);
  const roi = ((totalProfit / strategy.totalBankroll / totalRounds) * 100).toFixed(2);
  
  return {
    strategy: strategy.name,
    successCount,
    successRate: parseFloat(successRate),
    totalProfit,
    avgProfit: parseFloat(avgProfit),
    roi: parseFloat(roi),
    maxConsecutiveLosses,
    positionHits,
  };
}

/**
 * 對比測試所有策略
 */
function compareStrategies(rounds: number = 1000) {
  console.log(`\n${'='.repeat(80)}`);
  console.log('百家樂賭注策略對比測試');
  console.log(`${'='.repeat(80)}\n`);
  
  console.log(`測試參數:`);
  console.log(`- 測試輪數: ${rounds}`);
  console.log(`- 策略數量: ${STRATEGIES.length}`);
  console.log(`- 預測系統: 三演算法組合(馬可夫鏈+模式延續+頻率平衡)\n`);
  
  console.log(`策略列表:`);
  STRATEGIES.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name} - ${s.description}`);
    console.log(`     賭注: [${s.bets.join(', ')}]`);
    console.log(`     本金: ${s.totalBankroll.toLocaleString()}元\n`);
  });
  
  console.log(`開始測試...\n`);
  
  const results: any[] = [];
  
  STRATEGIES.forEach((strategy, index) => {
    process.stdout.write(`測試策略 ${index + 1}/${STRATEGIES.length}: ${strategy.name}...`);
    const result = testStrategy(strategy, rounds);
    results.push(result);
    console.log(` 完成`);
  });
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('測試結果對比');
  console.log(`${'='.repeat(80)}\n`);
  
  // 按總獲利排序
  results.sort((a, b) => b.totalProfit - a.totalProfit);
  
  console.log(`排名 | 策略名稱       | 成功率  | 總獲利      | 平均獲利 | ROI    | 最大連敗`);
  console.log(`${'─'.repeat(80)}`);
  
  results.forEach((r, i) => {
    const rank = (i + 1).toString().padStart(2);
    const name = r.strategy.padEnd(14);
    const rate = `${r.successRate.toFixed(1)}%`.padStart(6);
    const total = `${r.totalProfit.toLocaleString()}元`.padStart(11);
    const avg = `${r.avgProfit.toFixed(0)}元`.padStart(8);
    const roi = `${r.roi > 0 ? '+' : ''}${r.roi.toFixed(2)}%`.padStart(7);
    const loss = r.maxConsecutiveLosses.toString().padStart(8);
    
    console.log(`${rank}   ${name}  ${rate}  ${total}  ${avg}  ${roi}  ${loss}`);
  });
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('詳細分析');
  console.log(`${'='.repeat(80)}\n`);
  
  // 最佳策略
  const best = results[0];
  console.log(`🏆 最佳策略: ${best.strategy}`);
  console.log(`   成功率: ${best.successRate}%`);
  console.log(`   總獲利: ${best.totalProfit.toLocaleString()}元`);
  console.log(`   平均每輪: ${best.avgProfit}元`);
  console.log(`   投資報酬率: ${best.roi}%`);
  console.log(`   最大連續失敗: ${best.maxConsecutiveLosses}次\n`);
  
  console.log(`   各位置命中分布:`);
  best.positionHits.forEach((count: number, i: number) => {
    const rate = (count / best.successCount * 100).toFixed(1);
    console.log(`     第${i + 1}局: ${count}次 (${rate}%)`);
  });
  
  // 最差策略
  const worst = results[results.length - 1];
  console.log(`\n❌ 最差策略: ${worst.strategy}`);
  console.log(`   總虧損: ${worst.totalProfit.toLocaleString()}元`);
  console.log(`   平均每輪: ${worst.avgProfit}元\n`);
  
  // 獲利策略統計
  const profitableCount = results.filter(r => r.totalProfit > 0).length;
  console.log(`獲利策略數量: ${profitableCount}/${STRATEGIES.length}`);
  
  if (profitableCount > 0) {
    console.log(`✓ 存在可獲利的資金管理策略`);
  } else {
    console.log(`✗ 所有策略均無法長期獲利`);
  }
  
  console.log(`\n${'='.repeat(80)}\n`);
}

// 執行測試
const testRounds = process.argv[2] ? parseInt(process.argv[2]) : 1000;
compareStrategies(testRounds);

