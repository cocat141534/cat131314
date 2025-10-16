/**
 * 資金曲線追蹤測試
 * 分析最大回撤、連續虧損、回本時間等關鍵指標
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
 * 追蹤資金曲線的詳細測試
 */
function testEquityCurve(rounds: number = 1000) {
  console.log(`\n${'='.repeat(80)}`);
  console.log('資金曲線追蹤測試');
  console.log(`${'='.repeat(80)}\n`);
  
  console.log(`策略: ${BEST_STRATEGY.name}`);
  console.log(`賭注: [${BEST_STRATEGY.bets.join(', ')}]`);
  console.log(`本金: ${BEST_STRATEGY.totalBankroll.toLocaleString()}元`);
  console.log(`測試輪數: ${rounds}\n`);
  
  console.log(`開始測試...\n`);
  
  let shoe = shuffleShoe(createShoe());
  let shoePosition = 0;
  
  // 資金曲線追蹤
  const equityCurve: number[] = [0]; // 從0開始
  let currentEquity = 0;
  let maxEquity = 0;
  let minEquity = 0;
  let maxDrawdown = 0;
  let currentDrawdown = 0;
  
  // 回本追蹤
  let firstLossRound: number | null = null;
  let firstBreakEvenRound: number | null = null;
  let worstEquityRound = 0;
  
  // 連續統計
  let consecutiveLosses = 0;
  let maxConsecutiveLosses = 0;
  let consecutiveWins = 0;
  let maxConsecutiveWins = 0;
  
  // 詳細記錄
  const detailedLog: any[] = [];
  
  for (let round = 1; round <= rounds; round++) {
    if (shoePosition > 316) {
      shoe = shuffleShoe(createShoe());
      shoePosition = 0;
    }
    
    const result = runRound(shoe, shoePosition);
    shoePosition += result.cardsUsed;
    
    // 更新資金
    currentEquity += result.profit;
    equityCurve.push(currentEquity);
    
    // 更新最大/最小資金
    if (currentEquity > maxEquity) {
      maxEquity = currentEquity;
      currentDrawdown = 0;
    } else {
      currentDrawdown = maxEquity - currentEquity;
      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
      }
    }
    
    if (currentEquity < minEquity) {
      minEquity = currentEquity;
      worstEquityRound = round;
    }
    
    // 追蹤第一次虧損和回本
    if (firstLossRound === null && currentEquity < 0) {
      firstLossRound = round;
    }
    
    if (firstLossRound !== null && firstBreakEvenRound === null && currentEquity >= 0) {
      firstBreakEvenRound = round;
    }
    
    // 連續統計
    if (result.success) {
      consecutiveWins++;
      consecutiveLosses = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
    } else {
      consecutiveLosses++;
      consecutiveWins = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
    }
    
    // 記錄前20輪和關鍵事件
    if (round <= 20 || !result.success || round === worstEquityRound) {
      detailedLog.push({
        round,
        success: result.success ? '✓' : '✗',
        matchPosition: result.matchPosition || '-',
        profit: result.profit,
        equity: currentEquity,
        note: !result.success ? '失敗' : round === worstEquityRound ? '最低點' : '',
      });
    }
    
    // 進度顯示
    if (round % 100 === 0) {
      const progress = (round / rounds * 100).toFixed(0);
      process.stdout.write(`\r進度: ${progress}% | 當前資金: ${currentEquity.toLocaleString()}元 | 最大回撤: ${maxDrawdown.toLocaleString()}元`);
    }
  }
  
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('資金曲線分析');
  console.log(`${'='.repeat(80)}\n`);
  
  console.log(`基本統計:`);
  console.log(`  起始資金: 0元`);
  console.log(`  最終資金: ${currentEquity.toLocaleString()}元`);
  console.log(`  最高資金: ${maxEquity.toLocaleString()}元 (峰值)`);
  console.log(`  最低資金: ${minEquity.toLocaleString()}元 (第${worstEquityRound}輪)`);
  console.log(`  總獲利: ${currentEquity.toLocaleString()}元\n`);
  
  console.log(`風險指標:`);
  console.log(`  最大回撤: ${maxDrawdown.toLocaleString()}元`);
  console.log(`  回撤比例: ${((maxDrawdown / Math.max(maxEquity, 1)) * 100).toFixed(2)}%`);
  console.log(`  最大連續勝利: ${maxConsecutiveWins}輪`);
  console.log(`  最大連續失敗: ${maxConsecutiveLosses}輪\n`);
  
  console.log(`回本分析:`);
  if (firstLossRound !== null) {
    console.log(`  首次虧損: 第${firstLossRound}輪`);
    if (firstBreakEvenRound !== null) {
      const recoveryRounds = firstBreakEvenRound - firstLossRound;
      console.log(`  回到正獲利: 第${firstBreakEvenRound}輪`);
      console.log(`  回本耗時: ${recoveryRounds}輪`);
    } else {
      console.log(`  回到正獲利: 未回本`);
    }
  } else {
    console.log(`  從未出現虧損 ✓`);
  }
  
  console.log(`\n前20輪詳細記錄:`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`輪次 | 結果 | 命中位置 | 本輪獲利 | 累積資金 | 備註`);
  console.log(`${'─'.repeat(80)}`);
  
  detailedLog.filter(l => l.round <= 20).forEach(log => {
    const round = log.round.toString().padStart(4);
    const success = log.success.padEnd(4);
    const match = log.matchPosition.toString().padStart(8);
    const profit = (log.profit > 0 ? '+' : '') + log.profit.toLocaleString().padStart(10);
    const equity = log.equity.toLocaleString().padStart(10);
    const note = log.note.padEnd(8);
    console.log(`${round} | ${success} | ${match} | ${profit}元 | ${equity}元 | ${note}`);
  });
  
  // 顯示失敗記錄
  const failureLogs = detailedLog.filter(l => !l.success && l.round > 20);
  if (failureLogs.length > 0) {
    console.log(`\n失敗記錄 (第21輪後):`);
    console.log(`${'─'.repeat(80)}`);
    failureLogs.forEach(log => {
      console.log(`  第${log.round}輪: 虧損${Math.abs(log.profit).toLocaleString()}元, 累積資金: ${log.equity.toLocaleString()}元`);
    });
  }
  
  // 資金曲線簡易圖表
  console.log(`\n資金曲線圖 (每50輪取樣):`);
  console.log(`${'─'.repeat(80)}`);
  const sampleInterval = Math.max(1, Math.floor(rounds / 20));
  for (let i = 0; i <= rounds; i += sampleInterval) {
    const equity = equityCurve[i];
    const barLength = Math.floor((equity / maxEquity) * 40);
    const bar = equity >= 0 ? '█'.repeat(Math.max(0, barLength)) : '';
    const label = `第${i.toString().padStart(4)}輪`;
    const value = equity.toLocaleString().padStart(10);
    console.log(`${label}: ${value}元 ${bar}`);
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('結論');
  console.log(`${'='.repeat(80)}\n`);
  
  if (minEquity >= 0) {
    console.log(`✓ 資金曲線穩定向上,從未出現虧損`);
  } else if (firstBreakEvenRound !== null) {
    console.log(`○ 曾出現虧損,但已成功回本`);
    console.log(`  最大虧損: ${Math.abs(minEquity).toLocaleString()}元`);
    console.log(`  回本耗時: ${firstBreakEvenRound - (firstLossRound || 0)}輪`);
  } else {
    console.log(`✗ 出現虧損且尚未回本`);
  }
  
  const drawdownRatio = (maxDrawdown / Math.max(maxEquity, 1)) * 100;
  if (drawdownRatio < 10) {
    console.log(`✓ 回撤風險極低 (${drawdownRatio.toFixed(2)}%)`);
  } else if (drawdownRatio < 30) {
    console.log(`○ 回撤風險可控 (${drawdownRatio.toFixed(2)}%)`);
  } else {
    console.log(`⚠ 回撤風險較高 (${drawdownRatio.toFixed(2)}%)`);
  }
  
  console.log(`\n${'='.repeat(80)}\n`);
}

// 執行測試
const testRounds = process.argv[2] ? parseInt(process.argv[2]) : 1000;
testEquityCurve(testRounds);

