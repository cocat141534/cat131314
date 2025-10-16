/**
 * 真實百家樂環境模擬器
 * - 8副牌(416張)真實牌組
 * - 追蹤已發牌張,動態計算機率
 * - 真實補牌規則
 * - 馬丁格爾倍投策略
 */

import { predictWithScores, type GameResult } from './client/src/lib/predictor';

// 賭注策略(7局倍投)
const BET_SEQUENCE = [100, 300, 700, 1500, 3200, 6600, 12800];
const TOTAL_BANKROLL = 25200;

// 牌面值定義
type CardRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
type CardSuit = '♠' | '♥' | '♦' | '♣';

interface Card {
  rank: CardRank;
  suit: CardSuit;
  value: number; // 百家樂點數(0-9)
}

/**
 * 建立8副牌(416張)
 */
function createShoe(): Card[] {
  const ranks: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits: CardSuit[] = ['♠', '♥', '♦', '♣'];
  const shoe: Card[] = [];
  
  // 8副牌
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

/**
 * 洗牌(Fisher-Yates算法)
 */
function shuffleShoe(shoe: Card[]): Card[] {
  const shuffled = [...shoe];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 計算手牌點數(百家樂規則:只取個位數)
 */
function calculatePoints(cards: Card[]): number {
  const sum = cards.reduce((total, card) => total + card.value, 0);
  return sum % 10;
}

/**
 * 判斷是否需要補牌
 */
function shouldDrawThirdCard(playerPoints: number, bankerPoints: number, playerThirdCard?: number): {
  playerDraws: boolean;
  bankerDraws: boolean;
} {
  let playerDraws = false;
  let bankerDraws = false;
  
  // 天牌(8或9點)不補牌
  if (playerPoints >= 8 || bankerPoints >= 8) {
    return { playerDraws: false, bankerDraws: false };
  }
  
  // 閒家補牌規則
  if (playerPoints <= 5) {
    playerDraws = true;
  }
  
  // 莊家補牌規則
  if (!playerDraws) {
    // 閒家不補牌,莊家0-5補牌
    if (bankerPoints <= 5) {
      bankerDraws = true;
    }
  } else {
    // 閒家補牌,莊家根據閒家第三張牌決定
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

/**
 * 發一局牌並返回結果
 */
function dealHand(shoe: Card[], position: number): { result: GameResult; cardsUsed: number } {
  // 發初始4張牌
  const playerCards = [shoe[position], shoe[position + 2]];
  const bankerCards = [shoe[position + 1], shoe[position + 3]];
  let cardsUsed = 4;
  
  let playerPoints = calculatePoints(playerCards);
  let bankerPoints = calculatePoints(bankerCards);
  
  // 檢查是否需要補牌
  const { playerDraws, bankerDraws } = shouldDrawThirdCard(playerPoints, bankerPoints);
  
  let playerThirdCardValue: number | undefined;
  
  if (playerDraws) {
    const playerThirdCard = shoe[position + cardsUsed];
    playerCards.push(playerThirdCard);
    playerThirdCardValue = playerThirdCard.value;
    cardsUsed++;
    playerPoints = calculatePoints(playerCards);
  }
  
  // 重新計算莊家是否補牌(基於閒家第三張牌)
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
  
  // 判斷結果
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
 * 執行一輪完整測試(7局歷史 + 7局預測驗證)
 */
function runRound(shoe: Card[], startPosition: number): {
  success: boolean;
  profit: number;
  history: GameResult[];
  predicted: GameResult[];
  actual: GameResult[];
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
  const actual: GameResult[] = [];
  let matchPosition: number | null = null;
  let profit = 0;
  
  for (let i = 0; i < 7; i++) {
    const { result, cardsUsed } = dealHand(shoe, position);
    actual.push(result);
    position += cardsUsed;
    
    // 檢查是否命中
    if (matchPosition === null && predicted[i] === result) {
      matchPosition = i + 1;
      // 計算獲利:贏得該局賭注,扣除之前所有賭注
      const totalBet = BET_SEQUENCE.slice(0, i + 1).reduce((sum, bet) => sum + bet, 0);
      const winAmount = BET_SEQUENCE[i]; // 1賠1
      profit = winAmount - totalBet + winAmount; // 贏回本金+獲利
      break; // 命中後停止下注
    }
  }
  
  // 如果7局都沒中,虧損全部本金
  if (matchPosition === null) {
    profit = -TOTAL_BANKROLL;
  }
  
  const success = matchPosition !== null;
  const cardsUsed = position - startPosition;
  
  return { success, profit, history, predicted, actual, matchPosition, cardsUsed };
}

/**
 * 執行大量測試
 */
function runBatchTest(rounds: number = 100) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('百家樂真實環境模擬測試');
  console.log(`${'='.repeat(70)}\n`);
  
  console.log(`測試環境:`);
  console.log(`- 牌組: 8副牌(416張)`);
  console.log(`- 發牌規則: 真實百家樂補牌規則`);
  console.log(`- 一靴牌發完才重新洗牌\n`);
  
  console.log(`賭注策略:`);
  BET_SEQUENCE.forEach((bet, i) => {
    console.log(`  第${i + 1}局: ${bet.toLocaleString()}元`);
  });
  console.log(`  總本金: ${TOTAL_BANKROLL.toLocaleString()}元\n`);
  
  console.log(`測試規則:`);
  console.log(`- 發7局作為歷史記錄`);
  console.log(`- 預測接下來7局`);
  console.log(`- 依序下注,中1局即停止`);
  console.log(`- 7局都沒中則虧損全部本金\n`);
  
  console.log(`開始測試...\n`);
  
  let shoe = shuffleShoe(createShoe());
  let shoePosition = 0;
  let totalProfit = 0;
  let successCount = 0;
  let totalRounds = 0;
  let maxConsecutiveLosses = 0;
  let currentConsecutiveLosses = 0;
  const profitHistory: number[] = [];
  const detailedResults: any[] = [];
  
  const startTime = Date.now();
  
  while (totalRounds < rounds) {
    // 檢查是否需要重新洗牌(剩餘牌少於100張)
    if (shoePosition > 316) {
      shoe = shuffleShoe(createShoe());
      shoePosition = 0;
      console.log(`\n[洗牌] 第 ${Math.floor(totalRounds / 20) + 1} 次洗牌`);
    }
    
    const result = runRound(shoe, shoePosition);
    shoePosition += result.cardsUsed;
    
    totalRounds++;
    totalProfit += result.profit;
    profitHistory.push(totalProfit);
    
    if (result.success) {
      successCount++;
      currentConsecutiveLosses = 0;
    } else {
      currentConsecutiveLosses++;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentConsecutiveLosses);
    }
    
    // 記錄前5次測試的詳細結果
    if (totalRounds <= 5) {
      detailedResults.push({
        round: totalRounds,
        history: result.history.join(' '),
        predicted: result.predicted.join(' '),
        actual: result.actual.join(' '),
        matchPosition: result.matchPosition || '無',
        profit: result.profit,
        success: result.success ? '✓' : '✗',
      });
    }
    
    // 每10次顯示進度
    if (totalRounds % 10 === 0) {
      const progress = (totalRounds / rounds * 100).toFixed(0);
      const currentRate = (successCount / totalRounds * 100).toFixed(1);
      const avgProfit = (totalProfit / totalRounds).toFixed(0);
      process.stdout.write(`\r進度: ${progress}% (${totalRounds}/${rounds}) | 成功率: ${currentRate}% | 平均獲利: ${avgProfit}元`);
    }
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('測試結果統計');
  console.log(`${'='.repeat(70)}\n`);
  
  const successRate = (successCount / totalRounds * 100).toFixed(2);
  const failureCount = totalRounds - successCount;
  const avgProfit = (totalProfit / totalRounds).toFixed(2);
  const maxProfit = Math.max(...profitHistory);
  const maxLoss = Math.min(...profitHistory);
  const finalProfit = profitHistory[profitHistory.length - 1];
  
  console.log(`基本統計:`);
  console.log(`  總測試輪數: ${totalRounds}`);
  console.log(`  成功次數: ${successCount} (${successRate}%)`);
  console.log(`  失敗次數: ${failureCount} (${(100 - parseFloat(successRate)).toFixed(2)}%)`);
  console.log(`  最大連續失敗: ${maxConsecutiveLosses} 次\n`);
  
  console.log(`獲利統計:`);
  console.log(`  總獲利: ${totalProfit.toLocaleString()}元`);
  console.log(`  平均每輪獲利: ${avgProfit}元`);
  console.log(`  最高累積獲利: ${maxProfit.toLocaleString()}元`);
  console.log(`  最低累積獲利: ${maxLoss.toLocaleString()}元`);
  console.log(`  最終累積獲利: ${finalProfit.toLocaleString()}元`);
  console.log(`  投資報酬率: ${((finalProfit / TOTAL_BANKROLL / totalRounds) * 100).toFixed(2)}%\n`);
  
  console.log(`前5輪詳細結果:`);
  console.log(`${'─'.repeat(70)}`);
  detailedResults.forEach(r => {
    console.log(`\n第 ${r.round} 輪 ${r.success}`);
    console.log(`  歷史: ${r.history}`);
    console.log(`  預測: ${r.predicted}`);
    console.log(`  實際: ${r.actual}`);
    console.log(`  命中: 第${r.matchPosition}局`);
    console.log(`  獲利: ${r.profit > 0 ? '+' : ''}${r.profit}元`);
  });
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('結論分析');
  console.log(`${'='.repeat(70)}\n`);
  
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
  
  if (maxConsecutiveLosses <= 3) {
    console.log(`✓ 風險可控 (最大連續失敗${maxConsecutiveLosses}次)`);
  } else {
    console.log(`⚠ 風險較高 (最大連續失敗${maxConsecutiveLosses}次)`);
  }
  
  console.log(`\n測試耗時: ${duration}秒`);
  console.log(`${'='.repeat(70)}\n`);
}

// 執行測試
const testRounds = process.argv[2] ? parseInt(process.argv[2]) : 100;
runBatchTest(testRounds);

