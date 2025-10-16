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
    this.deck = [];
    for (let i = 0; i < 8; i++) {
      for (let j = 1; j <= 13; j++) {
        for (let k = 0; k < 4; k++) {
          this.deck.push(j > 10 ? 0 : j);
        }
      }
    }
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
    this.currentIndex = 0;
  }

  drawCard(): number {
    if (this.currentIndex >= this.deck.length - 10) {
      this.shuffle();
    }
    return this.deck[this.currentIndex++];
  }

  playRound(): GameResult {
    let playerTotal = (this.drawCard() + this.drawCard()) % 10;
    let bankerTotal = (this.drawCard() + this.drawCard()) % 10;

    if (playerTotal >= 8 || bankerTotal >= 8) {
      if (playerTotal > bankerTotal) return 'P';
      if (bankerTotal > playerTotal) return 'B';
      return 'T';
    }

    let playerThird: number | null = null;
    if (playerTotal <= 5) {
      playerThird = this.drawCard();
      playerTotal = (playerTotal + playerThird) % 10;
    }

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

// 策略接口
interface BettingStrategy {
  name: string;
  calculateBets(bankroll: number, context: any): number[];
  updateContext(context: any, success: boolean, hitRound: number | null): any;
  getInitialContext(): any;
}

// 1. 保守激進前置策略 (改良版 - 每輪投入25%)
class ConservativeAggressiveStrategy implements BettingStrategy {
  name = '保守激進前置';
  
  calculateBets(bankroll: number): number[] {
    const totalInvestment = bankroll * 0.25; // 只投入25%
    return [
      Math.floor(totalInvestment * 0.24),
      Math.floor(totalInvestment * 0.24),
      Math.floor(totalInvestment * 0.24),
      Math.floor(totalInvestment * 0.08),
      Math.floor(totalInvestment * 0.08),
      Math.floor(totalInvestment * 0.08),
      Math.floor(totalInvestment * 0.04)
    ];
  }
  
  updateContext(context: any) { return context; }
  getInitialContext() { return {}; }
}

// 2. 馬丁格爾策略
class MartingaleStrategy implements BettingStrategy {
  name = '馬丁格爾';
  
  calculateBets(bankroll: number, context: any): number[] {
    const baseBet = Math.floor(bankroll * 0.02); // 基礎注碼2%
    const multiplier = context.multiplier || 1;
    const bet = Math.min(baseBet * multiplier, bankroll * 0.3); // 最多30%
    
    return [bet, bet, bet, bet, bet, bet, bet];
  }
  
  updateContext(context: any, success: boolean): any {
    if (success) {
      return { multiplier: 1 }; // 成功後重置
    } else {
      return { multiplier: (context.multiplier || 1) * 2 }; // 失敗後加倍
    }
  }
  
  getInitialContext() { return { multiplier: 1 }; }
}

// 3. 反馬丁格爾策略 (Paroli)
class ParoliStrategy implements BettingStrategy {
  name = '反馬丁格爾';
  
  calculateBets(bankroll: number, context: any): number[] {
    const baseBet = Math.floor(bankroll * 0.03);
    const multiplier = context.multiplier || 1;
    const bet = Math.min(baseBet * multiplier, bankroll * 0.25);
    
    return [bet, bet, bet, bet, bet, bet, bet];
  }
  
  updateContext(context: any, success: boolean): any {
    if (success) {
      const newMultiplier = (context.multiplier || 1) * 2;
      const winStreak = (context.winStreak || 0) + 1;
      
      if (winStreak >= 3) {
        return { multiplier: 1, winStreak: 0 }; // 連贏3次重置
      }
      return { multiplier: newMultiplier, winStreak };
    } else {
      return { multiplier: 1, winStreak: 0 }; // 失敗後重置
    }
  }
  
  getInitialContext() { return { multiplier: 1, winStreak: 0 }; }
}

// 4. 費波那契策略
class FibonacciStrategy implements BettingStrategy {
  name = '費波那契';
  
  private fibonacci = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  
  calculateBets(bankroll: number, context: any): number[] {
    const baseBet = Math.floor(bankroll * 0.01);
    const index = context.fibIndex || 0;
    const bet = Math.min(baseBet * this.fibonacci[index], bankroll * 0.3);
    
    return [bet, bet, bet, bet, bet, bet, bet];
  }
  
  updateContext(context: any, success: boolean): any {
    if (success) {
      const newIndex = Math.max(0, (context.fibIndex || 0) - 2); // 成功退回兩步
      return { fibIndex: newIndex };
    } else {
      const newIndex = Math.min(this.fibonacci.length - 1, (context.fibIndex || 0) + 1);
      return { fibIndex: newIndex };
    }
  }
  
  getInitialContext() { return { fibIndex: 0 }; }
}

// 5. 固定比例策略
class FixedPercentageStrategy implements BettingStrategy {
  name = '固定比例';
  
  calculateBets(bankroll: number): number[] {
    const bet = Math.floor(bankroll * 0.025); // 固定2.5%
    return [bet, bet, bet, bet, bet, bet, bet];
  }
  
  updateContext(context: any) { return context; }
  getInitialContext() { return {}; }
}

// 6. 凱利公式策略 (1/4 Kelly)
class KellyStrategy implements BettingStrategy {
  name = '凱利公式';
  
  calculateBets(bankroll: number): number[] {
    // 假設成功率98.5%, 賠率1:1
    // Kelly = (p * b - q) / b = (0.985 * 1 - 0.015) / 1 = 0.97
    // 使用1/4 Kelly = 0.2425, 取0.2 (20%)
    const totalInvestment = bankroll * 0.2;
    
    // 前置重注策略
    return [
      Math.floor(totalInvestment * 0.25),
      Math.floor(totalInvestment * 0.25),
      Math.floor(totalInvestment * 0.25),
      Math.floor(totalInvestment * 0.08),
      Math.floor(totalInvestment * 0.08),
      Math.floor(totalInvestment * 0.06),
      Math.floor(totalInvestment * 0.03)
    ];
  }
  
  updateContext(context: any) { return context; }
  getInitialContext() { return {}; }
}

// 執行單輪測試
function runSingleRound(
  shoe: BaccaratShoe,
  bankroll: number,
  strategy: BettingStrategy,
  context: any
): {
  success: boolean;
  hitRound: number | null;
  profit: number;
  newBankroll: number;
  newContext: any;
} {
  if (bankroll <= 0) {
    return {
      success: false,
      hitRound: null,
      profit: 0,
      newBankroll: 0,
      newContext: context
    };
  }
  
  // 隨機進場
  const skipRounds = Math.floor(Math.random() * 71) + 10;
  for (let i = 0; i < skipRounds; i++) {
    shoe.playRound();
  }
  
  // 收集歷史
  const history: GameResult[] = [];
  for (let i = 0; i < 7; i++) {
    history.push(shoe.playRound());
  }
  
  // 預測
  const prediction = predictNextN(history, 7);
  
  // 計算賭注
  const bets = strategy.calculateBets(bankroll, context);
  
  // 下注
  for (let i = 0; i < 7; i++) {
    const actual = shoe.playRound();
    
    if (prediction[i] !== 'T' && actual !== 'T' && prediction[i] === actual) {
      const totalInvested = bets.slice(0, i + 1).reduce((sum, bet) => sum + bet, 0);
      const winAmount = bets[i] * 2;
      const netProfit = winAmount - totalInvested;
      const newBankroll = bankroll + netProfit;
      const newContext = strategy.updateContext(context, true, i + 1);
      
      return {
        success: true,
        hitRound: i + 1,
        profit: netProfit,
        newBankroll: Math.max(0, newBankroll),
        newContext
      };
    }
  }
  
  // 失敗
  const totalLoss = bets.reduce((sum, bet) => sum + bet, 0);
  const newBankroll = Math.max(0, bankroll - totalLoss);
  const newContext = strategy.updateContext(context, false, null);
  
  return {
    success: false,
    hitRound: null,
    profit: -totalLoss,
    newBankroll,
    newContext
  };
}

// 測試單個策略
function testStrategy(strategy: BettingStrategy, initialBankroll: number, rounds: number) {
  let bankroll = initialBankroll;
  let context = strategy.getInitialContext();
  let successCount = 0;
  let failCount = 0;
  let bankruptRound = -1;
  let maxBankroll = initialBankroll;
  let minBankroll = initialBankroll;
  
  const shoe = new BaccaratShoe();
  
  for (let round = 0; round < rounds; round++) {
    if (bankroll <= 0) {
      bankruptRound = round;
      break;
    }
    
    const result = runSingleRound(shoe, bankroll, strategy, context);
    
    bankroll = result.newBankroll;
    context = result.newContext;
    
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
    
    maxBankroll = Math.max(maxBankroll, bankroll);
    minBankroll = Math.min(minBankroll, bankroll);
  }
  
  const totalRounds = successCount + failCount;
  const finalProfit = bankroll - initialBankroll;
  const roi = (finalProfit / initialBankroll) * 100;
  const successRate = totalRounds > 0 ? (successCount / totalRounds) * 100 : 0;
  
  return {
    strategy: strategy.name,
    initialBankroll,
    finalBankroll: bankroll,
    totalProfit: finalProfit,
    roi,
    successCount,
    failCount,
    successRate,
    bankruptRound,
    maxBankroll,
    minBankroll,
    totalRounds
  };
}

// 主測試
function runAllTests() {
  const INITIAL_BANKROLL = 16000;
  const ROUNDS = 2000;
  
  const strategies: BettingStrategy[] = [
    new ConservativeAggressiveStrategy(),
    new MartingaleStrategy(),
    new ParoliStrategy(),
    new FibonacciStrategy(),
    new FixedPercentageStrategy(),
    new KellyStrategy()
  ];
  
  console.log('開始測試所有策略...\n');
  console.log('='.repeat(80));
  console.log(`初始本金: ${INITIAL_BANKROLL.toLocaleString()}元 | 測試輪數: ${ROUNDS}輪`);
  console.log('='.repeat(80));
  
  const results = [];
  
  for (const strategy of strategies) {
    console.log(`\n測試中: ${strategy.name}...`);
    const result = testStrategy(strategy, INITIAL_BANKROLL, ROUNDS);
    results.push(result);
  }
  
  // 排序結果(按ROI降序)
  results.sort((a, b) => b.roi - a.roi);
  
  // 顯示結果
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 策略對比結果');
  console.log('='.repeat(80));
  
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.strategy}`);
    console.log('-'.repeat(80));
    console.log(`最終本金: ${result.finalBankroll.toLocaleString()}元`);
    console.log(`總獲利: ${result.totalProfit >= 0 ? '+' : ''}${result.totalProfit.toLocaleString()}元`);
    console.log(`投資報酬率: ${result.roi.toFixed(2)}%`);
    console.log(`成功率: ${result.successRate.toFixed(2)}% (${result.successCount}/${result.totalRounds})`);
    console.log(`最高本金: ${result.maxBankroll.toLocaleString()}元`);
    console.log(`最低本金: ${result.minBankroll.toLocaleString()}元`);
    
    if (result.bankruptRound >= 0) {
      console.log(`⚠️  破產於第 ${result.bankruptRound} 輪`);
    } else {
      console.log(`✅ 完成全部 ${ROUNDS} 輪測試`);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('🏆 最佳策略: ' + results[0].strategy);
  console.log('='.repeat(80));
}

// 執行
const startTime = Date.now();
runAllTests();
const endTime = Date.now();
console.log(`\n測試耗時: ${((endTime - startTime) / 1000).toFixed(2)}秒`);

