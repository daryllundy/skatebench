import technical_test from "./tests/skate-trick-test.json";
import {
  modelsToRun,
  type RunnableModel,
  MAX_CONCURRENCY,
  TEST_RUNS_PER_MODEL,
  TIMEOUT_SECONDS,
  OUTPUT_DIRECTORY,
} from "./constants";
import { generateText } from "ai";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

type WorkItem = {
  model: RunnableModel;
  system_prompt: string;
  prompt: string;
  answers: string[];
  negative_answers?: string[];
  originalTestIndex: number;
};

const workQueue: WorkItem[] = [];

technical_test.tests.forEach((test, testIndex) => {
  modelsToRun.map((model) => {
    workQueue.push({
      model,
      system_prompt: technical_test.system_prompt,
      prompt: test.prompt,
      answers: test.answers,
      negative_answers: test.negative_answers,
      originalTestIndex: testIndex,
    });
  });
});

function isCorrect(input: {
  answers: string[];
  negative_answers?: string[];
  result: string;
}) {
  const resultLower = input.result.toLowerCase();

  if (input.negative_answers) {
    if (
      input.negative_answers.some((answer) =>
        resultLower.includes(answer.toLowerCase())
      )
    ) {
      return false;
    }
  }
  return input.answers.some((answer) =>
    resultLower.includes(answer.toLowerCase())
  );
}

async function runTest(input: {
  model: RunnableModel;
  system_prompt: string;
  prompt: string;
  answers: string[];
  negative_answers?: string[];
  originalTestIndex: number;
}) {
  const { model, system_prompt, prompt, answers, negative_answers } = input;

  // Create a timeout promise with cleanup
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("Test timeout")),
      TIMEOUT_SECONDS * 1000
    );
  });

  async function internal__testRun() {
    // Create the test promise
    const testResult = await generateText({
      model: model.llm,
      system: system_prompt,
      prompt,
      providerOptions: {
        openrouter: {
          reasoning: {
            max_tokens: 2048,
          },
        },
        xai: {
          reasoningEffort: "high",
        },
      },
    });

    const correctness = isCorrect({
      answers,
      negative_answers,
      result: testResult.text,
    });

    // Extract cost from providerMetadata
    let cost = 0;
    if (testResult.providerMetadata) {
      // Check for openrouter cost
      const openrouterMeta = testResult.providerMetadata.openrouter as any;
      if (openrouterMeta?.usage?.cost) {
        cost = openrouterMeta.usage.cost;
      }
      // Check for other providers if needed
      // Add more provider cost extraction logic here as needed
    }

    return {
      model: model.name,
      prompt,
      result: testResult,
      correct: correctness,
      cost,
    };
  }

  // Race between test and timeout
  try {
    const result = await Promise.race([internal__testRun(), timeoutPromise]);
    // Clear the timeout since we got a result
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    // Clear the timeout in case of error too
    if (timeoutId) clearTimeout(timeoutId);
    console.error(`Test failed for model ${model.name}:`, error);
    throw error;
  }
}

function generateMarkdownReport(
  results: Array<{
    model: string;
    testIndex: number;
    runNumber: number;
    prompt: string;
    expectedAnswers: string[];
    result?: any;
    error?: string;
    duration: number;
  }>,
  metadata: any
): string {
  let markdown = `# ${metadata.testSuite} - Test Results\n\n`;

  // Add metadata
  markdown += `**Date:** ${new Date(metadata.timestamp).toLocaleString()}\n`;
  markdown += `**Total Tests:** ${metadata.totalTests}\n`;
  markdown += `**Successful:** ${metadata.successful}\n`;
  markdown += `**Failed:** ${metadata.failed}\n`;
  markdown += `**Models:** ${metadata.models.join(", ")}\n\n`;

  // Group results by test index
  const testGroups = results.reduce(
    (acc, result) => {
      if (!acc[result.testIndex]) {
        acc[result.testIndex] = [];
      }
      acc[result.testIndex].push(result);
      return acc;
    },
    {} as Record<number, typeof results>
  );

  // Generate markdown for each test
  Object.entries(testGroups)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([testIndex, testResults]) => {
      const firstResult = testResults[0];

      markdown += `## Test ${parseInt(testIndex) + 1}\n\n`;
      markdown += `**Prompt:** "${firstResult.prompt}"\n\n`;
      markdown += `**Expected answers:** ${firstResult.expectedAnswers.map((a) => `"${a}"`).join(", ")}\n\n`;

      // Add negative answers if they exist
      const testData = technical_test.tests[parseInt(testIndex)];
      if (testData.negative_answers && testData.negative_answers.length > 0) {
        markdown += `**Negative answers (automatic fail):** ${testData.negative_answers.map((a) => `"${a}"`).join(", ")}\n\n`;
      }

      // Sort results by model name, then by run number
      const sortedResults = testResults.sort((a, b) => {
        if (a.model !== b.model) {
          return a.model.localeCompare(b.model);
        }
        return a.runNumber - b.runNumber;
      });

      sortedResults.forEach((result) => {
        if (result.error) {
          markdown += `**${result.model} answer ${result.runNumber}:** ❌ Error: ${result.error}\n\n`;
        } else if (result.result) {
          const rawAnswer =
            result.result.text ||
            result.result.result?.text ||
            "No text response";
          // Trim whitespace and normalize newlines
          const answer = rawAnswer.trim().replace(/\s+/g, " ");
          const isCorrect = result.result.correct || false;
          const status = isCorrect ? "✅" : "❌";
          markdown += `**${result.model} answer ${result.runNumber}:** ${status} "${answer}"\n\n`;
        }
      });

      markdown += "---\n\n";
    });

  return markdown;
}

async function testRunner() {
  console.log(
    `Starting test runner with ${technical_test.tests.length} tests, ${modelsToRun.length} models, ${TEST_RUNS_PER_MODEL} runs each`
  );
  console.log(
    `Concurrency limit: ${MAX_CONCURRENCY}, Timeout: ${TIMEOUT_SECONDS}s`
  );

  type TestRun = {
    model: RunnableModel;
    system_prompt: string;
    prompt: string;
    answers: string[];
    negative_answers?: string[];
    runNumber: number;
    testIndex: number;
  };

  const results: Array<{
    model: string;
    testIndex: number;
    runNumber: number;
    prompt: string;
    expectedAnswers: string[];
    result?: any;
    error?: string;
    duration: number;
    cost: number;
  }> = [];

  // Group work items by test index
  const itemsByTest = workQueue.reduce(
    (acc, item) => {
      const idx = item.originalTestIndex;
      (acc[idx] ||= []).push(item);
      return acc;
    },
    {} as Record<number, WorkItem[]>
  );

  async function processJobQueue(jobQueue: TestRun[]) {
    let activeJobs = 0;

    async function worker(): Promise<void> {
      while (jobQueue.length > 0) {
        const testRun = jobQueue.shift();
        if (!testRun) break;

        activeJobs++;
        const startTime = Date.now();

        try {
          console.log(
            `Running test ${testRun.testIndex + 1}.${testRun.runNumber} for ${testRun.model.name}`
          );
          const result = await runTest({
            model: testRun.model,
            system_prompt: testRun.system_prompt,
            prompt: testRun.prompt,
            answers: testRun.answers,
            negative_answers: testRun.negative_answers,
            originalTestIndex: testRun.testIndex,
          });
          const duration = Date.now() - startTime;

          results.push({
            model: testRun.model.name,
            testIndex: testRun.testIndex,
            runNumber: testRun.runNumber,
            prompt: testRun.prompt,
            expectedAnswers: testRun.answers,
            result,
            duration,
            cost: (result as any).cost || 0,
          });

          console.log(
            `✓ Completed test ${testRun.testIndex + 1}.${testRun.runNumber} for ${testRun.model.name} in ${duration}ms`
          );
        } catch (error) {
          const duration = Date.now() - startTime;
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          results.push({
            model: testRun.model.name,
            testIndex: testRun.testIndex,
            runNumber: testRun.runNumber,
            prompt: testRun.prompt,
            expectedAnswers: testRun.answers,
            error: errorMessage,
            duration,
            cost: 0,
          });

          console.log(
            `✗ Failed test ${testRun.testIndex + 1}.${testRun.runNumber} for ${testRun.model.name}: ${errorMessage}`
          );
        } finally {
          activeJobs--;
        }
      }
    }

    const workers = Array.from(
      { length: Math.min(MAX_CONCURRENCY, jobQueue.length) },
      () => worker()
    );

    await Promise.all(workers);
  }

  // Build and process jobs one test at a time, interleaving models per run
  const sortedTestIndices = Object.keys(itemsByTest)
    .map((k) => parseInt(k))
    .sort((a, b) => a - b);

  for (const testIndex of sortedTestIndices) {
    const items = itemsByTest[testIndex]!;

    const jobQueue: TestRun[] = [];
    for (let runNumber = 1; runNumber <= TEST_RUNS_PER_MODEL; runNumber++) {
      for (const item of items) {
        jobQueue.push({
          model: item.model,
          system_prompt: item.system_prompt,
          prompt: item.prompt,
          answers: item.answers,
          negative_answers: item.negative_answers,
          runNumber,
          testIndex,
        });
      }
    }

    console.log(
      `Scheduling Test ${testIndex + 1}: ${jobQueue.length} runs across ${items.length} models`
    );

    await processJobQueue(jobQueue);
  }

  console.log(`\nTest runner completed. Total results: ${results.length}`);

  // Log summary
  const correct = results.filter((r) => !r.error && r.result?.correct).length;
  const incorrect = results.filter(
    (r) => !r.error && !r.result?.correct
  ).length;
  const errors = results.filter((r) => r.error).length;
  console.log(
    `Correct: ${correct}, Incorrect: ${incorrect}, Errors: ${errors}`
  );

  // Save results to file
  try {
    // Ensure output directory exists
    if (!existsSync(OUTPUT_DIRECTORY)) {
      await mkdir(OUTPUT_DIRECTORY, { recursive: true });
      console.log(`Created output directory: ${OUTPUT_DIRECTORY}`);
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `test-results-${timestamp}.json`;
    const filepath = join(OUTPUT_DIRECTORY, filename);

    // Prepare results object with metadata
    const outputData = {
      metadata: {
        timestamp: new Date().toISOString(),
        totalTests: results.length,
        correct,
        incorrect,
        errors,
        successful: correct,
        failed: incorrect + errors,
        config: {
          maxConcurrency: MAX_CONCURRENCY,
          testRunsPerModel: TEST_RUNS_PER_MODEL,
          timeoutSeconds: TIMEOUT_SECONDS,
        },
        testSuite: technical_test.name,
        models: modelsToRun.map((m) => m.name),
      },
      results,
    };

    // Write JSON results to file
    await writeFile(filepath, JSON.stringify(outputData, null, 2), "utf-8");
    console.log(`Results saved to: ${filepath}`);

    // Generate and save markdown report
    const markdownFilename = `test-results-${timestamp}.md`;
    const markdownFilepath = join(OUTPUT_DIRECTORY, markdownFilename);
    const markdownContent = generateMarkdownReport(
      results,
      outputData.metadata
    );

    await writeFile(markdownFilepath, markdownContent, "utf-8");
    console.log(`Markdown report saved to: ${markdownFilepath}`);

    // Generate and save summary JSON
    const summaryFilename = `summary-${timestamp}.json`;
    const summaryFilepath = join(OUTPUT_DIRECTORY, summaryFilename);

    // Calculate model statistics
    const modelStats = results.reduce(
      (acc, result) => {
        if (!acc[result.model]) {
          acc[result.model] = {
            correct: 0,
            incorrect: 0,
            errors: 0,
            totalDuration: 0,
            totalTests: 0,
            totalCost: 0,
          };
        }
        acc[result.model].totalTests++;
        if (result.error) {
          acc[result.model].errors++;
        } else if (result.result?.correct) {
          acc[result.model].correct++;
        } else {
          acc[result.model].incorrect++;
        }
        acc[result.model].totalDuration += result.duration;
        acc[result.model].totalCost += result.cost;
        return acc;
      },
      {} as Record<
        string,
        {
          correct: number;
          incorrect: number;
          errors: number;
          totalDuration: number;
          totalTests: number;
          totalCost: number;
        }
      >
    );

    // Calculate success rates and rank models
    const modelRankings = Object.entries(modelStats)
      .map(([modelName, stats]) => ({
        model: modelName,
        correct: stats.correct,
        incorrect: stats.incorrect,
        errors: stats.errors,
        totalTests: stats.totalTests,
        successRate:
          stats.totalTests > 0 ? (stats.correct / stats.totalTests) * 100 : 0,
        errorRate:
          stats.totalTests > 0 ? (stats.errors / stats.totalTests) * 100 : 0,
        averageDuration:
          stats.totalTests > 0
            ? Math.round(stats.totalDuration / stats.totalTests)
            : 0,
        totalCost: stats.totalCost,
        averageCostPerTest:
          stats.totalTests > 0 ? stats.totalCost / stats.totalTests : 0,
      }))
      .sort((a, b) => {
        // Sort by success rate (descending), then by average duration (ascending) as tiebreaker
        if (b.successRate !== a.successRate) {
          return b.successRate - a.successRate;
        }
        return a.averageDuration - b.averageDuration;
      });

    const summaryData = {
      rankings: modelRankings,
      metadata: {
        timestamp: new Date().toISOString(),
        totalModels: modelRankings.length,
        totalTestsRun: results.length,
        overallCorrect: correct,
        overallIncorrect: incorrect,
        overallErrors: errors,
        overallSuccessRate:
          results.length > 0 ? (correct / results.length) * 100 : 0,
        overallErrorRate:
          results.length > 0 ? (errors / results.length) * 100 : 0,
        totalCost: results.reduce((sum, result) => sum + result.cost, 0),
        averageCostPerTest:
          results.length > 0
            ? results.reduce((sum, result) => sum + result.cost, 0) /
              results.length
            : 0,
        config: {
          maxConcurrency: MAX_CONCURRENCY,
          testRunsPerModel: TEST_RUNS_PER_MODEL,
          timeoutSeconds: TIMEOUT_SECONDS,
        },
        testSuite: technical_test.name,
      },
    };

    await writeFile(
      summaryFilepath,
      JSON.stringify(summaryData, null, 2),
      "utf-8"
    );
    console.log(`Summary saved to: ${summaryFilepath}`);
  } catch (error) {
    console.error("Failed to save results to file:", error);
  }

  return results;
}

// Main execution
async function main() {
  try {
    const results = await testRunner();

    // Could save results to file here if needed
    console.log("\nFinal Results Summary:");
    console.log(`Total tests run: ${results.length}`);

    // Group by model for summary
    const modelSummary = results.reduce(
      (acc, result) => {
        if (!acc[result.model]) {
          acc[result.model] = {
            correct: 0,
            incorrect: 0,
            errors: 0,
            totalDuration: 0,
            totalCost: 0,
          };
        }
        if (result.error) {
          acc[result.model].errors++;
        } else if (result.result?.correct) {
          acc[result.model].correct++;
        } else {
          acc[result.model].incorrect++;
        }
        acc[result.model].totalDuration += result.duration;
        acc[result.model].totalCost += result.cost;
        return acc;
      },
      {} as Record<
        string,
        {
          correct: number;
          incorrect: number;
          errors: number;
          totalDuration: number;
          totalCost: number;
        }
      >
    );

    Object.entries(modelSummary).forEach(([model, stats]) => {
      const totalTests = stats.correct + stats.incorrect + stats.errors;
      const avgDuration = Math.round(stats.totalDuration / totalTests);
      const avgCost =
        totalTests > 0 ? (stats.totalCost / totalTests).toFixed(6) : "0.000000";
      console.log(
        `${model}: ${(stats.correct / (stats.correct + stats.incorrect + stats.errors)) * 100}% success rate, ${stats.correct} correct, ${stats.incorrect} incorrect, ${stats.errors} errors, avg ${avgDuration}ms, total cost $${stats.totalCost.toFixed(6)}, avg cost $${avgCost}/test`
      );
    });
  } catch (error) {
    console.error("Test runner failed:", error);
    process.exit(1);
  }
}

// Export for external use
export { testRunner };

// Run if this is the main module
if (import.meta.main) {
  main();
}
