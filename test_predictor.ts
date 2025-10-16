/**
 * 百家樂預測系統自動化測試腳本
 * 模擬真實百家樂機率分布,進行大量測試評估預測準確率
 */

import { predictWithScores, type GameResult } from './client/src/lib/predictor';

// 百家樂真實機率分布
const PROBABILITIES = {
  B: 0.4586, // 莊家 45.86%
  P: 0.4462, // 閒家 44.62%
  T: 0.0952, // 和局 9.52%
};

/**
 * 根據真實機率生成隨機結果
 */
function generateRandomResult(): GameResult {
  const rand = Math.random();
  if (rand < PROBABILITIES.B) return 'B';
  if (rand < PROBABILITIES.B + PROBABILITIES.P) return 'P';
  return 'T';
}

/**
 * 生成指定數量的隨機結果序列
 */
function generateSequence(length: number): GameResult[] {
  return Array.from({ length }, () => generateRandomResult());
}

/**
 * 檢查預測是否命中
 * 只要預測的7局中有任何1局與實際結果相同,就算命中
 */
function checkPrediction(predicted: GameResult[], actual: GameResult[]): boolean {
  for (let i = 0; i < predicted.length; i++) {
    if (predicted[i] === actual[i]) {
      return true; // 只要有一局命中就算成功
    }
  }
  return false;
}

/**
 * 執行單次測試
 */
function runSingleTest(): {
  success: boolean;
  history: GameResult[];
  predicted: GameResult[];
  actual: GameResult[];
  matchedPositions: number[];
} {
  // 生成前7局歷史記錄
  const history = generateSequence(7);
  
  // 使用預測系統預測接下來7局
  const predictionResult = predictWithScores(history, 7);
  const predicted = predictionResult.prediction;
  
  // 生成實際接下來7局的結果
  const actual = generateSequence(7);
  
  // 檢查是否命中
  const success = checkPrediction(predicted, actual);
  
  // 記錄所有命中的位置
  const matchedPositions: number[] = [];
  for (let i = 0; i < predicted.length; i++) {
    if (predicted[i] === actual[i]) {
      matchedPositions.push(i + 1);
    }
  }
  
  return { success, history, predicted, actual, matchedPositions };
}

/**
 * 執行大量測試並統計結果
 */
function runBatchTest(iterations: number = 1000) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('百家樂預測系統自動化測試');
  console.log(`${'='.repeat(60)}\n`);
  
  console.log(`測試規則:`);
  console.log(`- 生成7局歷史記錄`);
  console.log(`- 預測接下來7局結果`);
  console.log(`- 生成實際7局結果`);
  console.log(`- 只要預測的7局中有任何1局命中,就算成功\n`);
  
  console.log(`測試參數:`);
  console.log(`- 測試次數: ${iterations}`);
  console.log(`- 莊家機率: ${(PROBABILITIES.B * 100).toFixed(2)}%`);
  console.log(`- 閒家機率: ${(PROBABILITIES.P * 100).toFixed(2)}%`);
  console.log(`- 和局機率: ${(PROBABILITIES.T * 100).toFixed(2)}%\n`);
  
  console.log(`開始測試...\n`);
  
  let successCount = 0;
  let totalMatches = 0;
  const positionMatches = new Array(7).fill(0); // 記錄每個位置的命中次數
  const detailedResults: any[] = [];
  
  const startTime = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    const result = runSingleTest();
    
    if (result.success) {
      successCount++;
    }
    
    totalMatches += result.matchedPositions.length;
    
    // 統計每個位置的命中次數
    result.matchedPositions.forEach(pos => {
      positionMatches[pos - 1]++;
    });
    
    // 記錄前10次測試的詳細結果
    if (i < 10) {
      detailedResults.push({
        testNumber: i + 1,
        history: result.history.join(' '),
        predicted: result.predicted.join(' '),
        actual: result.actual.join(' '),
        matched: result.matchedPositions.join(', ') || '無',
        success: result.success ? '✓' : '✗',
      });
    }
    
    // 每100次顯示進度
    if ((i + 1) % 100 === 0) {
      const progress = ((i + 1) / iterations * 100).toFixed(0);
      const currentRate = (successCount / (i + 1) * 100).toFixed(2);
      process.stdout.write(`\r進度: ${progress}% (${i + 1}/${iterations}) - 當前準確率: ${currentRate}%`);
    }
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('測試結果統計');
  console.log(`${'='.repeat(60)}\n`);
  
  const successRate = (successCount / iterations * 100).toFixed(2);
  const failureCount = iterations - successCount;
  const failureRate = (failureCount / iterations * 100).toFixed(2);
  const avgMatches = (totalMatches / iterations).toFixed(2);
  
  console.log(`總測試次數: ${iterations}`);
  console.log(`成功次數: ${successCount} (${successRate}%)`);
  console.log(`失敗次數: ${failureCount} (${failureRate}%)`);
  console.log(`平均每次命中局數: ${avgMatches} / 7`);
  console.log(`測試耗時: ${duration} 秒\n`);
  
  console.log(`各位置命中統計:`);
  positionMatches.forEach((count, index) => {
    const rate = (count / iterations * 100).toFixed(2);
    const bar = '█'.repeat(Math.floor(count / iterations * 50));
    console.log(`  第${index + 1}局: ${count.toString().padStart(4)} 次 (${rate.padStart(5)}%) ${bar}`);
  });
  
  console.log(`\n前10次測試詳細結果:`);
  console.log(`${'─'.repeat(60)}`);
  detailedResults.forEach(r => {
    console.log(`\n測試 #${r.testNumber} ${r.success}`);
    console.log(`  歷史: ${r.history}`);
    console.log(`  預測: ${r.predicted}`);
    console.log(`  實際: ${r.actual}`);
    console.log(`  命中: ${r.matched}`);
  });
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('結論');
  console.log(`${'='.repeat(60)}\n`);
  
  // 計算理論隨機命中率
  // 假設完全隨機預測,每局命中機率約 1/3 (莊閒和三選一)
  // 7局中至少命中1局的機率 = 1 - (2/3)^7 ≈ 93.9%
  const theoreticalRate = (1 - Math.pow(2/3, 7)) * 100;
  
  console.log(`實際準確率: ${successRate}%`);
  console.log(`理論隨機率: ${theoreticalRate.toFixed(2)}%`);
  
  if (parseFloat(successRate) > theoreticalRate) {
    console.log(`\n✓ 預測系統表現優於隨機預測 (+${(parseFloat(successRate) - theoreticalRate).toFixed(2)}%)`);
  } else if (parseFloat(successRate) < theoreticalRate) {
    console.log(`\n✗ 預測系統表現低於隨機預測 (${(parseFloat(successRate) - theoreticalRate).toFixed(2)}%)`);
  } else {
    console.log(`\n= 預測系統表現與隨機預測相當`);
  }
  
  console.log(`\n${'='.repeat(60)}\n`);
}

// 執行測試
const testCount = process.argv[2] ? parseInt(process.argv[2]) : 1000;
runBatchTest(testCount);

