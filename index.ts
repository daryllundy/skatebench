import technical_test from "./tests/technical.json";
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

const workQueue: {
  model: RunnableModel;
  system_prompt: string;
  prompt: string;
  answers: string[];
  negative_answers?: string[];
  originalTestIndex: number;
}[] = [];

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
  if (input.negative_answers) {
    if (
      input.negative_answers.some((answer) => input.result.includes(answer))
    ) {
      return false;
    }
  }
  return input.answers.some((answer) => input.result.includes(answer));
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

    return {
      model: model.name,
      prompt,
      result: testResult,
      correct: correctness,
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
    `Starting test runner with ${workQueue.length} base tests, ${TEST_RUNS_PER_MODEL} runs each`
  );
  console.log(
    `Concurrency limit: ${MAX_CONCURRENCY}, Timeout: ${TIMEOUT_SECONDS}s`
  );

  // Create all test runs (each base test runs TEST_RUNS_PER_MODEL times)
  const allTestRuns: Array<{
    model: RunnableModel;
    system_prompt: string;
    prompt: string;
    answers: string[];
    negative_answers?: string[];
    runNumber: number;
    testIndex: number;
  }> = [];

  workQueue.forEach((workItem) => {
    for (let runNumber = 1; runNumber <= TEST_RUNS_PER_MODEL; runNumber++) {
      allTestRuns.push({
        ...workItem,
        runNumber,
        testIndex: workItem.originalTestIndex,
      });
    }
  });

  console.log(`Total test runs to execute: ${allTestRuns.length}`);

  const results: Array<{
    model: string;
    testIndex: number;
    runNumber: number;
    prompt: string;
    expectedAnswers: string[];
    result?: any;
    error?: string;
    duration: number;
  }> = [];

  // Create a semaphore to limit concurrency
  let activeJobs = 0;
  const jobQueue = [...allTestRuns];

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
        });

        console.log(
          `✗ Failed test ${testRun.testIndex + 1}.${testRun.runNumber} for ${testRun.model.name}: ${errorMessage}`
        );
      } finally {
        activeJobs--;
      }
    }
  }

  // Start worker threads up to MAX_CONCURRENCY
  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENCY, allTestRuns.length) },
    () => worker()
  );

  // Wait for all workers to complete
  await Promise.all(workers);

  console.log(`\nTest runner completed. Total results: ${results.length}`);

  // Log summary
  const successful = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error).length;
  console.log(`Successful: ${successful}, Failed: ${failed}`);

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
        successful,
        failed,
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
          acc[result.model] = { successful: 0, failed: 0, totalDuration: 0 };
        }
        if (result.error) {
          acc[result.model].failed++;
        } else {
          acc[result.model].successful++;
        }
        acc[result.model].totalDuration += result.duration;
        return acc;
      },
      {} as Record<
        string,
        { successful: number; failed: number; totalDuration: number }
      >
    );

    Object.entries(modelSummary).forEach(([model, stats]) => {
      const avgDuration = Math.round(
        stats.totalDuration / (stats.successful + stats.failed)
      );
      console.log(
        `${model}: ${stats.successful} successful, ${stats.failed} failed, avg ${avgDuration}ms`
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
