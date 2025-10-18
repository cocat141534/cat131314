import { GameResult, predictHybrid } from './client/src/lib/hybrid-predictor';

// 8副牌百家樂模擬器
class BaccaratShoe {
  private cards: number[] = [];
  private usedCards: number = 0;
  
  constructor() {
    this.shuffle();
  }
  
  private shuffle() {
    // 8副牌 = 416張牌
    this.cards = [];
    for (let deck = 0; deck < 8; deck++) {
      for (let suit = 0; suit < 4; suit++) {
        for (let rank = 1; rank <= 13; rank++) {
          this.cards.push(rank);
        }
      }
    }
    
    // 洗牌
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    
    this.usedCards = 0;
  }
  
  private getCardValue(card: number): number {
    return card >= 10 ? 0 : card;
  }
  
  public dealHand(): GameResult {
    // 檢查是否需要換牌靴
    if (this.usedCards > 350) { // 剩餘少於66張時換靴
      this.shuffle();
    }
    
    // 發牌邏輯
    const bankerCards: number[] = [];
    const playerCards: number[] = [];
    
    // 初始發牌
    playerCards.push(this.cards[this.usedCards++]);
    bankerCards.push(this.cards[this.usedCards++]);
    playerCards.push(this.cards[this.usedCards++]);
    bankerCards.push(this.cards[this.usedCards++]);
    
    let playerTotal = (this.getCardValue(playerCards[0]) + this.getCardValue(playerCards[1])) % 10;
    let bankerTotal = (this.getCardValue(bankerCards[0]) + this.getCardValue(bankerCards[1])) % 10;
    
    // 天牌判斷
    if (playerTotal >= 8 || bankerTotal >= 8) {
      return this.determineWinner(playerTotal, bankerTotal);
    }
    
    // 閒家補牌規則
    let playerThirdCard: number | null = null;
    if (playerTotal <= 5) {
      playerThirdCard = this.cards[this.usedCards++];
      playerCards.push(playerThirdCard);
      playerTotal = (playerTotal + this.getCardValue(playerThirdCard)) % 10;
    }
    
    // 莊家補牌規則
    if (playerThirdCard === null) {
      // 閒家沒補牌
      if (bankerTotal <= 5) {
        bankerCards.push(this.cards[this.usedCards++]);
        bankerTotal = (bankerTotal + this.getCardValue(bankerCards[bankerCards.length - 1])) % 10;
      }
    } else {
      // 閒家有補牌
      const thirdValue = this.getCardValue(playerThirdCard);
      const shouldDraw = 
        (bankerTotal <= 2) ||
        (bankerTotal === 3 && thirdValue !== 8) ||
        (bankerTotal === 4 && thirdValue >= 2 && thirdValue <= 7) ||
        (bankerTotal === 5 && thirdValue >= 4 && thirdValue <= 7) ||
        (bankerTotal === 6 && (thirdValue === 6 || thirdValue === 7));
      
      if (shouldDraw) {
        bankerCards.push(this.cards[this.usedCards++]);
        bankerTotal = (bankerTotal + this.getCardValue(bankerCards[bankerCards.length - 1])) % 10;
      }
    }
    
    return this.determineWinner(playerTotal, bankerTotal);
  }
  
  private determineWinner(playerTotal: number, bankerTotal: number): GameResult {
    if (playerTotal > bankerTotal) return 'P';
    if (bankerTotal > playerTotal) return 'B';
    return 'T';
  }
  
  public needsNewShoe(): boolean {
    return this.usedCards > 350;
  }
}

// 投注序列
const BET_SEQUENCE = [100, 110, 250, 500, 1020, 2200, 4800];
const INITIAL_BANKROLL = 8980;
const PAYOUT_RATE = 0.95; // 莊家賠率

interface RoundResult {
  roundNumber: number;
  prediction: GameResult[];
  actualResults: GameResult[];
  hitRound: number; // 第幾局命中 (1-7, 0表示未命中)
  profit: number;
  bankroll: number;
  historySize: number;
}

interface TestResult {
  testNumber: number;
  totalRounds: number;
  wins: number;
  losses: number;
  winRate: number;
  finalBankroll: number;
  totalProfit: number;
  roi: number;
  maxBankroll: number;
  minBankroll: number;
  maxDrawdown: number;
  shoeChanges: number;
  rounds: RoundResult[];
}

function simulateRounds(numRounds: number, testNumber: number): TestResult {
  const shoe = new BaccaratShoe();
  let history: GameResult[] = [];
  let bankroll = INITIAL_BANKROLL;
  let wins = 0;
  let losses = 0;
  let maxBankroll = INITIAL_BANKROLL;
  let minBankroll = INITIAL_BANKROLL;
  let shoeChanges = 0;
  const rounds: RoundResult[] = [];
  
  console.log(`\n=== 開始測試 #${testNumber} ===`);
  console.log(`初始本金: ${INITIAL_BANKROLL}元`);
  
  // 初始化：收集15局歷史
  console.log('收集初始15局歷史記錄...');
  for (let i = 0; i < 15; i++) {
    history.push(shoe.dealHand());
  }
  
  // 開始模擬
  for (let round = 1; round <= numRounds; round++) {
    // 檢查是否需要換靴
    if (shoe.needsNewShoe()) {
      shoeChanges++;
      history = []; // 換桌清空歷史
      console.log(`\n第 ${round} 輪：換靴 (第 ${shoeChanges} 次)`);
      
      // 重新收集15局
      for (let i = 0; i < 15; i++) {
        history.push(shoe.dealHand());
      }
      continue;
    }
    
    // 檢查本金是否破產
    if (bankroll < BET_SEQUENCE[0]) {
      console.log(`\n第 ${round} 輪：本金不足，破產！`);
      break;
    }
    
    // 進行預測
    const predictionResult = predictHybrid(history, 7);
    const prediction = predictionResult.prediction;
    
    // 實際遊玩，直到命中或7局結束
    const actualResults: GameResult[] = [];
    let hitRound = 0;
    let totalInvested = 0;
    
    for (let i = 0; i < 7; i++) {
      const actual = shoe.dealHand();
      actualResults.push(actual);
      totalInvested += BET_SEQUENCE[i];
      
      if (actual === prediction[i]) {
        hitRound = i + 1;
        break;
      }
    }
    
    // 計算盈虧
    let profit = 0;
    if (hitRound > 0) {
      // 命中
      const betAmount = BET_SEQUENCE[hitRound - 1];
      const winnings = betAmount * PAYOUT_RATE;
      const totalReturn = betAmount + winnings;
      profit = totalReturn - totalInvested;
      wins++;
    } else {
      // 未命中
      profit = -totalInvested;
      losses++;
    }
    
    bankroll += profit;
    maxBankroll = Math.max(maxBankroll, bankroll);
    minBankroll = Math.min(minBankroll, bankroll);
    
    // 將實際結果加入歷史
    history.push(...actualResults);
    
    // 記錄結果
    rounds.push({
      roundNumber: round,
      prediction,
      actualResults,
      hitRound,
      profit,
      bankroll,
      historySize: history.length
    });
    
    // 每100輪輸出進度
    if (round % 100 === 0) {
      console.log(`第 ${round} 輪：勝率 ${(wins / (wins + losses) * 100).toFixed(2)}%，本金 ${bankroll.toFixed(0)}元`);
    }
  }
  
  const totalProfit = bankroll - INITIAL_BANKROLL;
  const roi = (totalProfit / INITIAL_BANKROLL) * 100;
  const maxDrawdown = INITIAL_BANKROLL - minBankroll;
  const winRate = wins / (wins + losses) * 100;
  
  console.log(`\n=== 測試 #${testNumber} 完成 ===`);
  console.log(`總輪數: ${wins + losses}`);
  console.log(`勝場: ${wins}, 敗場: ${losses}`);
  console.log(`勝率: ${winRate.toFixed(2)}%`);
  console.log(`最終本金: ${bankroll.toFixed(0)}元`);
  console.log(`總盈虧: ${totalProfit > 0 ? '+' : ''}${totalProfit.toFixed(0)}元`);
  console.log(`ROI: ${roi > 0 ? '+' : ''}${roi.toFixed(2)}%`);
  console.log(`最高本金: ${maxBankroll.toFixed(0)}元`);
  console.log(`最低本金: ${minBankroll.toFixed(0)}元`);
  console.log(`最大回撤: ${maxDrawdown.toFixed(0)}元`);
  console.log(`換靴次數: ${shoeChanges}`);
  
  return {
    testNumber,
    totalRounds: wins + losses,
    wins,
    losses,
    winRate,
    finalBankroll: bankroll,
    totalProfit,
    roi,
    maxBankroll,
    minBankroll,
    maxDrawdown,
    shoeChanges,
    rounds
  };
}

// 主測試函數
function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     百家樂預測系統 - 真實情境模擬測試（新版）              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n測試參數:');
  console.log('- 8副牌 (416張)');
  console.log('- 剩餘少於66張時換靴');
  console.log('- 換靴時清空歷史記錄');
  console.log('- 投注序列: 100, 110, 250, 500, 1020, 2200, 4800');
  console.log('- 初始本金: 8,980元');
  console.log('- 莊家賠率: 0.95');
  console.log('- 每次測試: 500輪');
  console.log('- 重複次數: 5次');
  console.log('- 預測模式: 手動觸發（新版）');
  
  const results: TestResult[] = [];
  
  for (let i = 1; i <= 5; i++) {
    const result = simulateRounds(500, i);
    results.push(result);
  }
  
  // 統計分析
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    5次測試統計分析                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const avgWinRate = results.reduce((sum, r) => sum + r.winRate, 0) / results.length;
  const avgProfit = results.reduce((sum, r) => sum + r.totalProfit, 0) / results.length;
  const avgROI = results.reduce((sum, r) => sum + r.roi, 0) / results.length;
  const bestTest = results.reduce((best, r) => r.totalProfit > best.totalProfit ? r : best);
  const worstTest = results.reduce((worst, r) => r.totalProfit < worst.totalProfit ? r : worst);
  
  console.log(`平均勝率: ${avgWinRate.toFixed(2)}%`);
  console.log(`平均盈虧: ${avgProfit > 0 ? '+' : ''}${avgProfit.toFixed(0)}元`);
  console.log(`平均ROI: ${avgROI > 0 ? '+' : ''}${avgROI.toFixed(2)}%`);
  console.log(`\n最佳表現: 測試 #${bestTest.testNumber} (${bestTest.totalProfit > 0 ? '+' : ''}${bestTest.totalProfit.toFixed(0)}元, ROI ${bestTest.roi.toFixed(2)}%)`);
  console.log(`最差表現: 測試 #${worstTest.testNumber} (${worstTest.totalProfit > 0 ? '+' : ''}${worstTest.totalProfit.toFixed(0)}元, ROI ${worstTest.roi.toFixed(2)}%)`);
  
  const profitableTests = results.filter(r => r.totalProfit > 0).length;
  console.log(`\n盈利測試: ${profitableTests}/5 (${(profitableTests / 5 * 100).toFixed(0)}%)`);
  
  // 生成詳細報告
  return results;
}

// 執行測試
const results = runTests();

// 輸出JSON格式結果供進一步分析
import * as fs from 'fs';
fs.writeFileSync(
  '/home/ubuntu/test-results.json',
  JSON.stringify(results, null, 2)
);
console.log('\n詳細測試結果已保存至: /home/ubuntu/test-results.json');

