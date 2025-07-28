import {
  modelsToRun,
  type RunnableModel,
  MAX_CONCURRENCY,
  TEST_RUNS_PER_MODEL,
  TIMEOUT_SECONDS,
  OUTPUT_DIRECTORY,
} from "./constants";
import { generateText } from "ai";
import { mkdir, writeFile, readdir, readFile as fsReadFile } from "fs/promises";
import { existsSync } from "fs";
import { join, basename, extname } from "path";

export type TestCase = {
  prompt: string;
  answers: string[];
  negative_answers?: string[];
};

export type TestSuite = {
  id?: string;
  name: string;
  description?: string;
  system_prompt: string;
  tests: TestCase[];
};

type WorkItem = {
  model: RunnableModel;
  system_prompt: string;
  prompt: string;
  answers: string[];
  negative_answers?: string[];
  originalTestIndex: number;
};

type PreviousResultEntry = {
  model: string;
  prompt: string;
  expectedAnswers: string[];
  negativeAnswers?: string[];
  text: string;
  correct?: boolean;
  duration?: number;
  cost?: number;
  sourceFile: string;
};

function computeSuiteId(
  suiteFilePathOrId: string | undefined,
  suiteName: string
) {
  if (suiteFilePathOrId && suiteFilePathOrId.trim().length > 0)
    return suiteFilePathOrId;
  // Fallback to a slugified version of the suite name
  return suiteName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function computeTestSignature(input: {
  system_prompt: string;
  prompt: string;
  answers: string[];
  negative_answers?: string[];
}) {
  // Stable signature for matching previous results
  const normalized = {
    system_prompt: input.system_prompt.trim(),
    prompt: input.prompt.trim(),
    answers: [...input.answers].map((a) => a.trim().toLowerCase()).sort(),
    negative_answers: (input.negative_answers || [])
      .map((a) => a.trim().toLowerCase())
      .sort(),
  };
  return JSON.stringify(normalized);
}

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

function extractTextFromStoredResult(resultObj: any): string | undefined {
  if (!resultObj) return undefined;
  if (typeof resultObj.text === "string") return resultObj.text;
  if (resultObj.result && typeof resultObj.result.text === "string")
    return resultObj.result.text;
  return undefined;
}

async function findPreviousResultsForSuite(options: {
  suiteId: string;
  suite: TestSuite;
}): Promise<Map<string, PreviousResultEntry[]>> {
  const { suiteId, suite } = options;
  const resultsRoot = OUTPUT_DIRECTORY;
  const map = new Map<string, PreviousResultEntry[]>();

  async function walk(dir: string): Promise<string[]> {
    const acc: string[] = [];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          acc.push(...(await walk(full)));
        } else if (
          entry.isFile() &&
          entry.name.endsWith(".json") &&
          !entry.name.startsWith("summary-")
        ) {
          acc.push(full);
        }
      }
    } catch {
      // ignore
    }
    return acc;
  }

  const candidateFiles = [
    // Prefer structured per-suite directory if exists
    join(resultsRoot, suiteId),
    resultsRoot,
  ];

  const discoveredJsonFiles = new Set<string>();
  for (const base of candidateFiles) {
    const files = await walk(base).catch(() => []);
    files.forEach((f) => discoveredJsonFiles.add(f));
  }

  for (const file of discoveredJsonFiles) {
    try {
      const raw = await fsReadFile(file, "utf-8");
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.results || !Array.isArray(parsed.results))
        continue;

      // Light filter by suite name if present
      const suiteNameInFile: string | undefined = parsed.metadata?.testSuite;
      if (suiteNameInFile && suiteNameInFile !== suite.name) continue;

      for (const r of parsed.results) {
        const prompt: string | undefined = r.prompt;
        const expectedAnswers: string[] | undefined = r.expectedAnswers;
        const negativeAnswers: string[] | undefined =
          r.negativeAnswers || r.negative_answers;
        const model: string | undefined = r.model;
        const text = extractTextFromStoredResult(r.result);
        if (!prompt || !expectedAnswers || !model || !text) continue;

        const signature = computeTestSignature({
          system_prompt: suite.system_prompt,
          prompt,
          answers: expectedAnswers,
          negative_answers: negativeAnswers,
        });

        const entry: PreviousResultEntry = {
          model,
          prompt,
          expectedAnswers,
          negativeAnswers,
          text,
          correct: r.result?.correct ?? r.correct,
          duration: r.duration,
          cost: r.cost,
          sourceFile: file,
        };
        const list = map.get(signature) || [];
        list.push(entry);
        map.set(signature, list);
      }
    } catch {
      // ignore malformed files
    }
  }

  return map;
}

function generateMarkdownReport(
  results: Array<{
    model: string;
    testIndex: number;
    runNumber: number;
    prompt: string;
    expectedAnswers: string[];
    negativeAnswers?: string[];
    result?: any;
    error?: string;
    duration: number;
  }>,
  metadata: any,
  suite: TestSuite
): string {
  let markdown = `# ${metadata.testSuite} - Test Results\n\n`;

  // Add metadata
  markdown += `**Date:** ${new Date(metadata.timestamp).toLocaleString()}\n`;
  markdown += `**Version:** ${metadata.version || "(none)"}\n`;
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
      markdown += `**Expected answers:** ${firstResult.expectedAnswers
        .map((a) => `"${a}"`)
        .join(", ")}\n\n`;

      const testData = suite.tests[parseInt(testIndex)];
      if (testData.negative_answers && testData.negative_answers.length > 0) {
        markdown += `**Negative answers (automatic fail):** ${testData.negative_answers
          .map((a) => `"${a}"`)
          .join(", ")}\n\n`;
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

export type TestRunnerOptions = {
  suite: TestSuite;
  suiteFilePath?: string; // used to derive suiteId if provided
  version?: string; // version label for this run
};

export async function testRunner(options: TestRunnerOptions) {
  const { suite, suiteFilePath, version } = options;
  const suiteId = computeSuiteId(
    suite.id ||
      (suiteFilePath
        ? basename(suiteFilePath, extname(suiteFilePath))
        : undefined),
    suite.name
  );

  console.log(
    `Starting test runner for suite "${suite.name}" (id: ${suiteId}) with ${suite.tests.length} tests, ${modelsToRun.length} models, ${TEST_RUNS_PER_MODEL} runs each`
  );
  console.log(
    `Concurrency limit: ${MAX_CONCURRENCY}, Timeout: ${TIMEOUT_SECONDS}s, Version: ${version || "(none)"}`
  );

  const workQueue: WorkItem[] = [];

  suite.tests.forEach((test, testIndex) => {
    modelsToRun.map((model) => {
      workQueue.push({
        model,
        system_prompt: suite.system_prompt,
        prompt: test.prompt,
        answers: test.answers,
        negative_answers: test.negative_answers,
        originalTestIndex: testIndex,
      });
    });
  });

  type TestRun = {
    type: "execute" | "reuse";
    model: RunnableModel;
    system_prompt: string;
    prompt: string;
    answers: string[];
    negative_answers?: string[];
    runNumber: number;
    testIndex: number;
    reuseFrom?: PreviousResultEntry; // when type === 'reuse'
  };

  const previousMap = await findPreviousResultsForSuite({ suiteId, suite });

  const results: Array<{
    model: string;
    testIndex: number;
    runNumber: number;
    prompt: string;
    expectedAnswers: string[];
    negativeAnswers?: string[];
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
          if (testRun.type === "reuse" && testRun.reuseFrom) {
            const duration = Date.now() - startTime;
            const reused = testRun.reuseFrom;
            const text = reused.text;
            const correct = isCorrect({
              answers: testRun.answers,
              negative_answers: testRun.negative_answers,
              result: text,
            });

            results.push({
              model: reused.model,
              testIndex: testRun.testIndex,
              runNumber: testRun.runNumber,
              prompt: testRun.prompt,
              expectedAnswers: testRun.answers,
              negativeAnswers: testRun.negative_answers,
              result: {
                text,
                correct,
                reused: true,
                sourceFile: reused.sourceFile,
              },
              duration,
              cost: reused.cost || 0,
            });

            console.log(
              `↺ Reused result for test ${testRun.testIndex + 1}.${testRun.runNumber} on ${reused.model} from ${basename(
                reused.sourceFile
              )}`
            );
          } else {
            console.log(
              `Running test ${testRun.testIndex + 1}.${testRun.runNumber} for ${testRun.model.name}`
            );
            const runResult = await runTest({
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
              negativeAnswers: testRun.negative_answers,
              result: runResult,
              duration,
              cost: (runResult as any).cost || 0,
            });

            console.log(
              `✓ Completed test ${testRun.testIndex + 1}.${testRun.runNumber} for ${testRun.model.name} in ${duration}ms`
            );
          }
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
            negativeAnswers: testRun.negative_answers,
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

    // Plan reuse per model where possible
    for (const item of items) {
      const signature = computeTestSignature({
        system_prompt: item.system_prompt,
        prompt: item.prompt,
        answers: item.answers,
        negative_answers: item.negative_answers,
      });
      const prev = previousMap.get(signature) || [];
      // Only keep entries matching the specific model
      const prevForModel = prev.filter((p) => p.model === item.model.name);

      // Assign reuse jobs first
      const reuseCount = Math.min(TEST_RUNS_PER_MODEL, prevForModel.length);
      for (let i = 1; i <= reuseCount; i++) {
        jobQueue.push({
          type: "reuse",
          model: item.model,
          system_prompt: item.system_prompt,
          prompt: item.prompt,
          answers: item.answers,
          negative_answers: item.negative_answers,
          runNumber: i,
          testIndex,
          reuseFrom: prevForModel[i - 1],
        });
      }
      // Then schedule the remaining as execute jobs
      for (let i = reuseCount + 1; i <= TEST_RUNS_PER_MODEL; i++) {
        jobQueue.push({
          type: "execute",
          model: item.model,
          system_prompt: item.system_prompt,
          prompt: item.prompt,
          answers: item.answers,
          negative_answers: item.negative_answers,
          runNumber: i,
          testIndex,
        });
      }
    }

    // Interleave jobs by runNumber across models
    jobQueue.sort((a, b) => {
      if (a.runNumber !== b.runNumber) return a.runNumber - b.runNumber;
      if (a.model.name !== b.model.name)
        return a.model.name.localeCompare(b.model.name);
      return 0;
    });

    console.log(
      `Scheduling Test ${testIndex + 1}: ${jobQueue.length} runs across ${items.length} models (${jobQueue.filter((j) => j.type === "reuse").length} reused)`
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
    const suiteDir = join(OUTPUT_DIRECTORY, suiteId, version || "unversioned");
    if (!existsSync(suiteDir)) {
      await mkdir(suiteDir, { recursive: true });
      console.log(`Created output directory: ${suiteDir}`);
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `test-results-${timestamp}.json`;
    const filepath = join(suiteDir, filename);

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
        testSuite: suite.name,
        suiteId,
        version: version || null,
        models: modelsToRun.map((m) => m.name),
      },
      results,
    };

    // Write JSON results to file
    await writeFile(filepath, JSON.stringify(outputData, null, 2), "utf-8");
    console.log(`Results saved to: ${filepath}`);

    // Generate and save markdown report
    const markdownFilename = `test-results-${timestamp}.md`;
    const markdownFilepath = join(suiteDir, markdownFilename);
    const markdownContent = generateMarkdownReport(
      results,
      outputData.metadata,
      suite
    );

    await writeFile(markdownFilepath, markdownContent, "utf-8");
    console.log(`Markdown report saved to: ${markdownFilepath}`);

    // Generate and save summary JSON
    const summaryFilename = `summary-${timestamp}.json`;
    const summaryFilepath = join(suiteDir, summaryFilename);

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
        testSuite: suite.name,
        suiteId,
        version: version || null,
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

// Export utility to load test suites from file path
export async function loadSuiteFromFile(filePath: string): Promise<TestSuite> {
  const raw = await fsReadFile(filePath, "utf-8");
  const json = JSON.parse(raw);
  // If id is missing, will be computed from filename/name where used
  return json as TestSuite;
}
