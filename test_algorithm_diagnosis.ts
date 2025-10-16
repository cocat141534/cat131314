import { predictNextN, predictWithScores } from './client/src/lib/predictor';

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

// 純隨機預測
function randomPredict(length: number): GameResult[] {
  const results: GameResult[] = [];
  for (let i = 0; i < length; i++) {
    results.push(Math.random() < 0.5 ? 'B' : 'P');
  }
  return results;
}

// 測試預測準確率
function testPredictionAccuracy(testRounds: number) {
  const shoe = new BaccaratShoe();
  
  let ourSystemHits = 0;
  let randomHits = 0;
  let totalPredictions = 0;
  
  // 統計各演算法分數
  const algorithmScores = {
    markov: [] as number[],
    pattern: [] as number[],
    frequency: [] as number[],
    total: [] as number[]
  };
  
  // 統計命中位置
  const ourSystemHitPositions = [0, 0, 0, 0, 0, 0, 0];
  const randomHitPositions = [0, 0, 0, 0, 0, 0, 0];
  
  for (let round = 0; round < testRounds; round++) {
    // 隨機進場
    const skipRounds = Math.floor(Math.random() * 71) + 10;
    for (let i = 0; i < skipRounds; i++) {
      shoe.playRound();
    }
    
    // 收集7局歷史
    const history: GameResult[] = [];
    for (let i = 0; i < 7; i++) {
      history.push(shoe.playRound());
    }
    
    // 我們的預測
    const ourPrediction = predictNextN(history, 7);
    const predictionWithScores = predictWithScores(history, 7);
    
    // 隨機預測
    const randomPrediction = randomPredict(7);
    
    // 記錄演算法分數
    algorithmScores.markov.push(predictionWithScores.scores.markov);
    algorithmScores.pattern.push(predictionWithScores.scores.pattern);
    algorithmScores.frequency.push(predictionWithScores.scores.frequency);
    algorithmScores.total.push(predictionWithScores.scores.total);
    
    // 實際結果
    const actual: GameResult[] = [];
    for (let i = 0; i < 7; i++) {
      actual.push(shoe.playRound());
    }
    
    // 檢查我們的預測
    let ourHit = false;
    for (let i = 0; i < 7; i++) {
      totalPredictions++;
      if (ourPrediction[i] !== 'T' && actual[i] !== 'T' && ourPrediction[i] === actual[i]) {
        if (!ourHit) {
          ourSystemHits++;
          ourSystemHitPositions[i]++;
          ourHit = true;
        }
      }
    }
    
    // 檢查隨機預測
    let randomHit = false;
    for (let i = 0; i < 7; i++) {
      if (randomPrediction[i] !== 'T' && actual[i] !== 'T' && randomPrediction[i] === actual[i]) {
        if (!randomHit) {
          randomHits++;
          randomHitPositions[i]++;
          randomHit = true;
        }
      }
    }
    
    if ((round + 1) % 200 === 0) {
      console.log(`進度: ${round + 1}/${testRounds}`);
    }
  }
  
  // 計算平均分數
  const avgScores = {
    markov: algorithmScores.markov.reduce((a, b) => a + b, 0) / algorithmScores.markov.length,
    pattern: algorithmScores.pattern.reduce((a, b) => a + b, 0) / algorithmScores.pattern.length,
    frequency: algorithmScores.frequency.reduce((a, b) => a + b, 0) / algorithmScores.frequency.length,
    total: algorithmScores.total.reduce((a, b) => a + b, 0) / algorithmScores.total.length
  };
  
  return {
    testRounds,
    ourSystemHits,
    randomHits,
    ourSystemSuccessRate: (ourSystemHits / testRounds) * 100,
    randomSuccessRate: (randomHits / testRounds) * 100,
    improvement: ((ourSystemHits - randomHits) / testRounds) * 100,
    ourSystemHitPositions,
    randomHitPositions,
    avgScores
  };
}

// 測試單局預測準確率
function testSinglePredictionAccuracy(testRounds: number) {
  const shoe = new BaccaratShoe();
  
  let ourCorrect = 0;
  let randomCorrect = 0;
  let totalPredictions = 0;
  
  for (let round = 0; round < testRounds; round++) {
    // 隨機進場
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
    const ourPrediction = predictNextN(history, 7);
    const randomPrediction = randomPredict(7);
    
    // 實際結果
    for (let i = 0; i < 7; i++) {
      const actual = shoe.playRound();
      
      // 只比較莊閒,忽略和局
      if (actual !== 'T') {
        totalPredictions++;
        
        if (ourPrediction[i] !== 'T' && ourPrediction[i] === actual) {
          ourCorrect++;
        }
        
        if (randomPrediction[i] !== 'T' && randomPrediction[i] === actual) {
          randomCorrect++;
        }
      }
    }
  }
  
  return {
    totalPredictions,
    ourCorrect,
    randomCorrect,
    ourAccuracy: (ourCorrect / totalPredictions) * 100,
    randomAccuracy: (randomCorrect / totalPredictions) * 100,
    improvement: ((ourCorrect - randomCorrect) / totalPredictions) * 100
  };
}

// 主測試
function runDiagnosis() {
  const TEST_ROUNDS = 1000;
  
  console.log('='.repeat(80));
  console.log('🔍 預測演算法診斷測試');
  console.log('='.repeat(80));
  console.log(`測試輪數: ${TEST_ROUNDS}輪\n`);
  
  // 測試1: 7局內至少命中1局的成功率
  console.log('【測試1: 7局內至少命中1局的成功率】');
  console.log('-'.repeat(80));
  const result1 = testPredictionAccuracy(TEST_ROUNDS);
  
  console.log(`\n我們的系統:`);
  console.log(`  成功率: ${result1.ourSystemSuccessRate.toFixed(2)}% (${result1.ourSystemHits}/${result1.testRounds})`);
  console.log(`  命中位置分布:`);
  result1.ourSystemHitPositions.forEach((count, index) => {
    const percentage = result1.ourSystemHits > 0 ? (count / result1.ourSystemHits * 100).toFixed(1) : '0.0';
    console.log(`    第${index + 1}局: ${count}次 (${percentage}%)`);
  });
  
  console.log(`\n純隨機預測:`);
  console.log(`  成功率: ${result1.randomSuccessRate.toFixed(2)}% (${result1.randomHits}/${result1.testRounds})`);
  console.log(`  命中位置分布:`);
  result1.randomHitPositions.forEach((count, index) => {
    const percentage = result1.randomHits > 0 ? (count / result1.randomHits * 100).toFixed(1) : '0.0';
    console.log(`    第${index + 1}局: ${count}次 (${percentage}%)`);
  });
  
  console.log(`\n對比:`);
  console.log(`  改進幅度: ${result1.improvement >= 0 ? '+' : ''}${result1.improvement.toFixed(2)}%`);
  
  if (result1.improvement > 0) {
    console.log(`  ✅ 我們的系統優於隨機預測`);
  } else if (result1.improvement < 0) {
    console.log(`  ❌ 我們的系統劣於隨機預測`);
  } else {
    console.log(`  ⚠️  我們的系統等同於隨機預測`);
  }
  
  console.log(`\n【演算法分數分析】`);
  console.log(`  馬可夫鏈平均分數: ${result1.avgScores.markov.toFixed(2)}`);
  console.log(`  模式延續平均分數: ${result1.avgScores.pattern.toFixed(2)}`);
  console.log(`  頻率平衡平均分數: ${result1.avgScores.frequency.toFixed(2)}`);
  console.log(`  總分平均: ${result1.avgScores.total.toFixed(2)}`);
  
  // 測試2: 單局預測準確率
  console.log(`\n\n【測試2: 單局預測準確率】`);
  console.log('-'.repeat(80));
  const result2 = testSinglePredictionAccuracy(TEST_ROUNDS);
  
  console.log(`\n我們的系統:`);
  console.log(`  準確率: ${result2.ourAccuracy.toFixed(2)}% (${result2.ourCorrect}/${result2.totalPredictions})`);
  
  console.log(`\n純隨機預測:`);
  console.log(`  準確率: ${result2.randomAccuracy.toFixed(2)}% (${result2.randomCorrect}/${result2.totalPredictions})`);
  
  console.log(`\n對比:`);
  console.log(`  改進幅度: ${result2.improvement >= 0 ? '+' : ''}${result2.improvement.toFixed(2)}%`);
  
  if (result2.improvement > 0) {
    console.log(`  ✅ 我們的系統優於隨機預測`);
  } else if (result2.improvement < 0) {
    console.log(`  ❌ 我們的系統劣於隨機預測`);
  } else {
    console.log(`  ⚠️  我們的系統等同於隨機預測`);
  }
  
  // 理論分析
  console.log(`\n\n【理論分析】`);
  console.log('-'.repeat(80));
  console.log(`隨機預測的理論成功率(7局內至少中1局):`);
  console.log(`  1 - (0.5)^7 = ${(1 - Math.pow(0.5, 7)) * 100}%`);
  console.log(`\n隨機預測的理論單局準確率:`);
  console.log(`  50%`);
  
  console.log(`\n\n【結論】`);
  console.log('='.repeat(80));
  
  if (result1.improvement > 5 && result2.improvement > 2) {
    console.log(`✅ 預測系統有效!`);
    console.log(`   - 7局成功率比隨機高 ${result1.improvement.toFixed(2)}%`);
    console.log(`   - 單局準確率比隨機高 ${result2.improvement.toFixed(2)}%`);
  } else if (Math.abs(result1.improvement) < 2 && Math.abs(result2.improvement) < 1) {
    console.log(`⚠️  預測系統可能無效!`);
    console.log(`   - 與隨機預測差異不大`);
    console.log(`   - 可能只是統計誤差`);
  } else {
    console.log(`❌ 預測系統無效!`);
    console.log(`   - 表現等同或劣於隨機預測`);
    console.log(`   - 演算法可能有問題`);
  }
  
  console.log('='.repeat(80));
}

// 執行
const startTime = Date.now();
runDiagnosis();
const endTime = Date.now();
console.log(`\n測試耗時: ${((endTime - startTime) / 1000).toFixed(2)}秒`);

