import { predictNextN } from './client/src/lib/predictor';

type GameResult = 'B' | 'P' | 'T';

// 真實百家樂牌組模擬
class BaccaratShoe {
  private deck: number[] = [];
  private currentIndex = 0;

  constructor() {
    this.shuffle();
  }

  shuffle() {
    // 8副牌,每副52張
    this.deck = [];
    for (let i = 0; i < 8; i++) {
      for (let j = 1; j <= 13; j++) {
        for (let k = 0; k < 4; k++) {
          this.deck.push(j > 10 ? 0 : j); // J,Q,K = 0
        }
      }
    }
    // Fisher-Yates 洗牌
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
    this.currentIndex = 0;
  }

  drawCard(): number {
    if (this.currentIndex >= this.deck.length - 10) {
      this.shuffle(); // 剩餘牌少於10張時重新洗牌
    }
    return this.deck[this.currentIndex++];
  }

  playRound(): GameResult {
    let playerTotal = (this.drawCard() + this.drawCard()) % 10;
    let bankerTotal = (this.drawCard() + this.drawCard()) % 10;

    // 天牌判斷
    if (playerTotal >= 8 || bankerTotal >= 8) {
      if (playerTotal > bankerTotal) return 'P';
      if (bankerTotal > playerTotal) return 'B';
      return 'T';
    }

    // 閒家補牌規則
    let playerThird: number | null = null;
    if (playerTotal <= 5) {
      playerThird = this.drawCard();
      playerTotal = (playerTotal + playerThird) % 10;
    }

    // 莊家補牌規則
    if (playerThird === null) {
      if (bankerTotal <= 5) {
        bankerTotal = (bankerTotal + this.drawCard()) % 10;
      }
    } else {
      const shouldBankerDraw = 
        (bankerTotal <= 2) ||
        (bankerTotal === 3 && playerThird !== 8) ||
        (bankerTotal === 4 && playerThird >= 2 && playerThird <= 7) ||
        (bankerTotal === 5 && playerThird >= 4 && playerThird <= 7) ||
        (bankerTotal === 6 && (playerThird === 6 || playerThird === 7));
      
      if (shouldBankerDraw) {
        bankerTotal = (bankerTotal + this.drawCard()) % 10;
      }
    }

    if (playerTotal > bankerTotal) return 'P';
    if (bankerTotal > playerTotal) return 'B';
    return 'T';
  }
}

// 根據本金計算賭注
function calculateBets(currentBankroll: number, initialBankroll: number): number[] {
  const standardBankroll = 5000;
  const standardBets = [1250, 1250, 1250, 312, 312, 312, 312];
  
  const ratio = currentBankroll / standardBankroll;
  
  let multiplier: number;
  if (ratio >= 1.0) {
    multiplier = 1.0;
  } else if (ratio >= 0.5) {
    multiplier = 0.5;
  } else if (ratio >= 0.25) {
    multiplier = 0.25;
  } else {
    multiplier = 0.1;
  }
  
  const bet1 = Math.floor(currentBankroll * 0.25);
  const bet2 = Math.floor(currentBankroll * 0.25);
  const bet3 = Math.floor(currentBankroll * 0.25);
  const bet4 = Math.floor(currentBankroll * 0.0625);
  const bet5 = Math.floor(currentBankroll * 0.0625);
  const bet6 = Math.floor(currentBankroll * 0.0625);
  const bet7 = Math.floor(currentBankroll * 0.0625);
  
  return [bet1, bet2, bet3, bet4, bet5, bet6, bet7];
}

// 執行單輪測試
function runSingleRound(shoe: BaccaratShoe, currentBankroll: number, initialBankroll: number): {
  success: boolean;
  hitRound: number | null;
  profit: number;
  newBankroll: number;
} {
  // 隨機跳過10-80局
  const skipRounds = Math.floor(Math.random() * 71) + 10;
  for (let i = 0; i < skipRounds; i++) {
    shoe.playRound();
  }
  
  // 收集7局歷史
  const history: GameResult[] = [];
  for (let i = 0; i < 7; i++) {
    history.push(shoe.playRound());
  }
  
  // 預測接下來7局
  const prediction = predictNextN(history, 7);
  
  // 計算賭注
  const bets = calculateBets(currentBankroll, initialBankroll);
  
  // 實際下注7局
  for (let i = 0; i < 7; i++) {
    const actual = shoe.playRound();
    
    // 檢查是否命中(忽略和局)
    if (prediction[i] !== 'T' && actual !== 'T' && prediction[i] === actual) {
      // 命中!
      const totalInvested = bets.slice(0, i + 1).reduce((sum, bet) => sum + bet, 0);
      const winAmount = bets[i] * 2;
      const netProfit = winAmount - totalInvested;
      const newBankroll = currentBankroll + netProfit;
      
      return {
        success: true,
        hitRound: i + 1,
        profit: netProfit,
        newBankroll: newBankroll
      };
    }
  }
  
  // 7局都沒中,失敗
  const totalLoss = bets.reduce((sum, bet) => sum + bet, 0);
  const newBankroll = Math.max(0, currentBankroll - totalLoss);
  
  return {
    success: false,
    hitRound: null,
    profit: -totalLoss,
    newBankroll: newBankroll
  };
}

// 主測試函數
function runTest() {
  const INITIAL_BANKROLL = 5000;
  const TOTAL_ROUNDS = 2000;
  
  let currentBankroll = INITIAL_BANKROLL;
  let successCount = 0;
  let failCount = 0;
  let bankruptCount = 0;
  let maxBankroll = INITIAL_BANKROLL;
  let minBankroll = INITIAL_BANKROLL;
  let totalProfit = 0;
  
  const bankrollHistory: number[] = [INITIAL_BANKROLL];
  const hitRoundStats = [0, 0, 0, 0, 0, 0, 0]; // 統計各局命中次數
  
  const shoe = new BaccaratShoe();
  
  for (let round = 0; round < TOTAL_ROUNDS; round++) {
    if (currentBankroll <= 0) {
      bankruptCount++;
      console.log(`第 ${round + 1} 輪破產,停止測試`);
      break;
    }
    
    const result = runSingleRound(shoe, currentBankroll, INITIAL_BANKROLL);
    
    currentBankroll = result.newBankroll;
    totalProfit += result.profit;
    
    if (result.success) {
      successCount++;
      if (result.hitRound !== null) {
        hitRoundStats[result.hitRound - 1]++;
      }
    } else {
      failCount++;
    }
    
    maxBankroll = Math.max(maxBankroll, currentBankroll);
    minBankroll = Math.min(minBankroll, currentBankroll);
    bankrollHistory.push(currentBankroll);
    
    // 每100輪顯示進度
    if ((round + 1) % 100 === 0) {
      console.log(`進度: ${round + 1}/${TOTAL_ROUNDS} | 本金: ${currentBankroll.toFixed(0)}元`);
    }
  }
  
  // 計算最大回撤
  let maxDrawdown = 0;
  let peak = INITIAL_BANKROLL;
  for (const bankroll of bankrollHistory) {
    if (bankroll > peak) {
      peak = bankroll;
    }
    const drawdown = ((peak - bankroll) / peak) * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }
  
  // 生成報告
  console.log('\n' + '='.repeat(60));
  console.log('📊 本金報告 - 5000元初始本金 2000輪測試');
  console.log('='.repeat(60));
  console.log(`\n【基本資訊】`);
  console.log(`初始本金: ${INITIAL_BANKROLL.toLocaleString()}元`);
  console.log(`測試輪數: ${successCount + failCount}輪`);
  console.log(`\n【最終結果】`);
  console.log(`最終本金: ${currentBankroll.toLocaleString()}元`);
  console.log(`總獲利: ${totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString()}元`);
  console.log(`投資報酬率: ${((totalProfit / INITIAL_BANKROLL) * 100).toFixed(2)}%`);
  console.log(`平均每輪: ${(totalProfit / (successCount + failCount)).toFixed(2)}元`);
  console.log(`\n【成功率統計】`);
  console.log(`成功次數: ${successCount}次`);
  console.log(`失敗次數: ${failCount}次`);
  console.log(`成功率: ${((successCount / (successCount + failCount)) * 100).toFixed(2)}%`);
  console.log(`破產次數: ${bankruptCount}次`);
  console.log(`\n【本金波動】`);
  console.log(`最高本金: ${maxBankroll.toLocaleString()}元 (${((maxBankroll / INITIAL_BANKROLL - 1) * 100).toFixed(2)}%)`);
  console.log(`最低本金: ${minBankroll.toLocaleString()}元 (${((minBankroll / INITIAL_BANKROLL - 1) * 100).toFixed(2)}%)`);
  console.log(`最大回撤: ${maxDrawdown.toFixed(2)}%`);
  console.log(`\n【命中位置分布】`);
  hitRoundStats.forEach((count, index) => {
    const percentage = successCount > 0 ? ((count / successCount) * 100).toFixed(1) : '0.0';
    console.log(`第${index + 1}局: ${count}次 (${percentage}%)`);
  });
  console.log('\n' + '='.repeat(60));
  
  // 輸出本金曲線數據(每50輪取樣)
  console.log('\n【本金曲線數據】(每50輪取樣)');
  for (let i = 0; i < bankrollHistory.length; i += 50) {
    console.log(`第${i}輪: ${bankrollHistory[i].toFixed(0)}元`);
  }
}

// 執行測試
console.log('開始測試...\n');
const startTime = Date.now();
runTest();
const endTime = Date.now();
console.log(`\n測試耗時: ${((endTime - startTime) / 1000).toFixed(2)}秒`);

