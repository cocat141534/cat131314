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
  calculateBets(bankroll: number): number[];
}

// 1. 保守激進前置策略 (25%投入)
class ConservativeAggressiveStrategy implements BettingStrategy {
  name = '保守激進前置(25%)';
  
  calculateBets(bankroll: number): number[] {
    const totalInvestment = bankroll * 0.25;
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
}

// 2. 凱利公式策略 (20%投入)
class KellyStrategy implements BettingStrategy {
  name = '凱利公式(20%)';
  
  calculateBets(bankroll: number): number[] {
    const totalInvestment = bankroll * 0.2;
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
}

// 3. 固定比例策略 (2.5%)
class FixedPercentageStrategy implements BettingStrategy {
  name = '固定比例(2.5%)';
  
  calculateBets(bankroll: number): number[] {
    const bet = Math.floor(bankroll * 0.025);
    return [bet, bet, bet, bet, bet, bet, bet];
  }
}

// 執行單輪測試
function runSingleRound(
  shoe: BaccaratShoe,
  bankroll: number,
  strategy: BettingStrategy
): {
  success: boolean;
  hitRound: number | null;
  profit: number;
  newBankroll: number;
} {
  if (bankroll <= 0) {
    return {
      success: false,
      hitRound: null,
      profit: 0,
      newBankroll: 0
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
  const bets = strategy.calculateBets(bankroll);
  
  // 下注
  for (let i = 0; i < 7; i++) {
    const actual = shoe.playRound();
    
    if (prediction[i] !== 'T' && actual !== 'T' && prediction[i] === actual) {
      const totalInvested = bets.slice(0, i + 1).reduce((sum, bet) => sum + bet, 0);
      const winAmount = bets[i] * 2;
      const netProfit = winAmount - totalInvested;
      const newBankroll = bankroll + netProfit;
      
      return {
        success: true,
        hitRound: i + 1,
        profit: netProfit,
        newBankroll: Math.max(0, newBankroll)
      };
    }
  }
  
  // 失敗
  const totalLoss = bets.reduce((sum, bet) => sum + bet, 0);
  const newBankroll = Math.max(0, bankroll - totalLoss);
  
  return {
    success: false,
    hitRound: null,
    profit: -totalLoss,
    newBankroll
  };
}

// 模擬單日遊玩
function simulateDay(
  shoe: BaccaratShoe,
  startBankroll: number,
  strategy: BettingStrategy,
  maxRounds: number
): {
  played: boolean;
  rounds: number;
  endBankroll: number;
  dailyProfit: number;
  successCount: number;
  failCount: number;
} {
  // 20%機率休息
  if (Math.random() < 0.2) {
    return {
      played: false,
      rounds: 0,
      endBankroll: startBankroll,
      dailyProfit: 0,
      successCount: 0,
      failCount: 0
    };
  }
  
  // 隨機遊玩1-7次
  const rounds = Math.floor(Math.random() * maxRounds) + 1;
  
  let bankroll = startBankroll;
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < rounds; i++) {
    if (bankroll <= 0) break;
    
    const result = runSingleRound(shoe, bankroll, strategy);
    bankroll = result.newBankroll;
    
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  return {
    played: true,
    rounds: successCount + failCount,
    endBankroll: bankroll,
    dailyProfit: bankroll - startBankroll,
    successCount,
    failCount
  };
}

// 測試策略
function test300Days(strategy: BettingStrategy, initialBankroll: number) {
  const DAYS = 300;
  const MAX_ROUNDS_PER_DAY = 7;
  
  let bankroll = initialBankroll;
  const shoe = new BaccaratShoe();
  
  const dailyRecords: Array<{
    day: number;
    played: boolean;
    rounds: number;
    startBankroll: number;
    endBankroll: number;
    dailyProfit: number;
    successCount: number;
    failCount: number;
  }> = [];
  
  let totalPlayedDays = 0;
  let totalRestDays = 0;
  let totalRounds = 0;
  let totalSuccessCount = 0;
  let totalFailCount = 0;
  let maxBankroll = initialBankroll;
  let minBankroll = initialBankroll;
  let bestDayProfit = 0;
  let worstDayProfit = 0;
  let bankruptDay = -1;
  
  for (let day = 1; day <= DAYS; day++) {
    if (bankroll <= 0) {
      bankruptDay = day - 1;
      break;
    }
    
    const startBankroll = bankroll;
    const dayResult = simulateDay(shoe, bankroll, strategy, MAX_ROUNDS_PER_DAY);
    
    bankroll = dayResult.endBankroll;
    
    dailyRecords.push({
      day,
      played: dayResult.played,
      rounds: dayResult.rounds,
      startBankroll,
      endBankroll: bankroll,
      dailyProfit: dayResult.dailyProfit,
      successCount: dayResult.successCount,
      failCount: dayResult.failCount
    });
    
    if (dayResult.played) {
      totalPlayedDays++;
      totalRounds += dayResult.rounds;
      totalSuccessCount += dayResult.successCount;
      totalFailCount += dayResult.failCount;
      
      bestDayProfit = Math.max(bestDayProfit, dayResult.dailyProfit);
      worstDayProfit = Math.min(worstDayProfit, dayResult.dailyProfit);
    } else {
      totalRestDays++;
    }
    
    maxBankroll = Math.max(maxBankroll, bankroll);
    minBankroll = Math.min(minBankroll, bankroll);
    
    // 每30天顯示進度
    if (day % 30 === 0) {
      console.log(`第${day}天 | 本金: ${bankroll.toLocaleString()}元 | 遊玩: ${totalPlayedDays}天 | 休息: ${totalRestDays}天`);
    }
  }
  
  const finalProfit = bankroll - initialBankroll;
  const roi = (finalProfit / initialBankroll) * 100;
  const successRate = totalRounds > 0 ? (totalSuccessCount / totalRounds) * 100 : 0;
  const avgDailyProfit = totalPlayedDays > 0 ? finalProfit / totalPlayedDays : 0;
  
  return {
    strategy: strategy.name,
    initialBankroll,
    finalBankroll: bankroll,
    totalProfit: finalProfit,
    roi,
    totalDays: DAYS,
    playedDays: totalPlayedDays,
    restDays: totalRestDays,
    totalRounds,
    successCount: totalSuccessCount,
    failCount: totalFailCount,
    successRate,
    maxBankroll,
    minBankroll,
    bestDayProfit,
    worstDayProfit,
    avgDailyProfit,
    bankruptDay,
    dailyRecords
  };
}

// 主測試
function runTest() {
  const INITIAL_BANKROLL = 16000;
  
  const strategies: BettingStrategy[] = [
    new ConservativeAggressiveStrategy(),
    new KellyStrategy(),
    new FixedPercentageStrategy()
  ];
  
  console.log('開始300天模擬測試...\n');
  console.log('='.repeat(80));
  console.log(`初始本金: ${INITIAL_BANKROLL.toLocaleString()}元 | 測試期間: 300天 | 每日限制: 7次`);
  console.log('='.repeat(80));
  
  const results = [];
  
  for (const strategy of strategies) {
    console.log(`\n測試策略: ${strategy.name}`);
    console.log('-'.repeat(80));
    const result = test300Days(strategy, INITIAL_BANKROLL);
    results.push(result);
  }
  
  // 排序結果
  results.sort((a, b) => b.roi - a.roi);
  
  // 顯示結果
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 300天模擬測試結果');
  console.log('='.repeat(80));
  
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.strategy}`);
    console.log('-'.repeat(80));
    console.log(`【最終結果】`);
    console.log(`最終本金: ${result.finalBankroll.toLocaleString()}元`);
    console.log(`總獲利: ${result.totalProfit >= 0 ? '+' : ''}${result.totalProfit.toLocaleString()}元`);
    console.log(`投資報酬率: ${result.roi.toFixed(2)}%`);
    console.log(`\n【遊玩統計】`);
    console.log(`遊玩天數: ${result.playedDays}天 (${((result.playedDays / result.totalDays) * 100).toFixed(1)}%)`);
    console.log(`休息天數: ${result.restDays}天 (${((result.restDays / result.totalDays) * 100).toFixed(1)}%)`);
    console.log(`總遊玩次數: ${result.totalRounds}次`);
    console.log(`平均每天: ${(result.totalRounds / result.playedDays).toFixed(1)}次`);
    console.log(`\n【成功率】`);
    console.log(`成功: ${result.successCount}次 | 失敗: ${result.failCount}次`);
    console.log(`成功率: ${result.successRate.toFixed(2)}%`);
    console.log(`\n【本金波動】`);
    console.log(`最高本金: ${result.maxBankroll.toLocaleString()}元 (${((result.maxBankroll / result.initialBankroll - 1) * 100).toFixed(2)}%)`);
    console.log(`最低本金: ${result.minBankroll.toLocaleString()}元 (${((result.minBankroll / result.initialBankroll - 1) * 100).toFixed(2)}%)`);
    console.log(`\n【單日表現】`);
    console.log(`最佳單日: +${result.bestDayProfit.toLocaleString()}元`);
    console.log(`最差單日: ${result.worstDayProfit.toLocaleString()}元`);
    console.log(`平均每日: ${result.avgDailyProfit >= 0 ? '+' : ''}${result.avgDailyProfit.toFixed(2)}元`);
    
    if (result.bankruptDay >= 0) {
      console.log(`\n⚠️  破產於第 ${result.bankruptDay} 天`);
    } else {
      console.log(`\n✅ 完成全部 300 天測試`);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('🏆 最佳策略: ' + results[0].strategy);
  console.log('='.repeat(80));
  
  // 輸出最佳策略的本金曲線(每10天取樣)
  const bestResult = results[0];
  console.log(`\n【${bestResult.strategy} - 本金曲線】(每10天取樣)`);
  for (let i = 0; i < bestResult.dailyRecords.length; i += 10) {
    const record = bestResult.dailyRecords[i];
    console.log(`第${record.day}天: ${record.endBankroll.toLocaleString()}元 ${record.played ? `(玩${record.rounds}次)` : '(休息)'}`);
  }
}

// 執行
const startTime = Date.now();
runTest();
const endTime = Date.now();
console.log(`\n測試耗時: ${((endTime - startTime) / 1000).toFixed(2)}秒`);

