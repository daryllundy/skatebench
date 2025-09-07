# 🛹 skatebench

**A comprehensive AI model benchmarking tool for testing and comparing language models across custom knowledge domains.**

## Overview

skatebench is a powerful benchmarking framework that allows you to test multiple AI language models against custom test suites, tracking performance, accuracy, cost, and response time. Whether you're evaluating models for domain-specific knowledge (like skateboard tricks) or general reasoning capabilities, skatebench provides detailed insights to help you choose the right model for your needs.

## Key Features

- **Multi-Model Testing**: Benchmark 20+ AI models including GPT-4, Claude, Gemini, and more via OpenRouter
- **Custom Test Suites**: Create JSON-based test definitions with expected answers and negative patterns
- **Real-time Progress Tracking**: Monitor test execution with live statistics and progress bars
- **Cost Analysis**: Track API costs across different models and test runs
- **Result Caching**: Intelligent caching system to avoid re-running identical tests
- **Web Dashboard**: Beautiful Next.js visualizer for exploring benchmark results
- **Concurrent Execution**: Run tests in parallel with configurable concurrency limits

## Architecture

The project consists of two main components:

### 🔧 Benchmarking Engine (`/bench`)
- TypeScript/Bun-based CLI tool for running benchmarks
- Supports multiple AI providers through the Vercel AI SDK
- Generates detailed JSON and Markdown reports
- Built-in result caching and error handling

### 📊 Web Visualizer (`/visualizer`)
- Next.js dashboard for visualizing benchmark results
- Interactive charts and model comparisons
- Filter and analyze results across different test suites
- Export capabilities for further analysis

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.2.0 or later
- OpenRouter API key (for accessing multiple AI models)
- Node.js 18+ (for the visualizer)

### Setting Up the Benchmarking Engine

1. Navigate to the bench directory:
```bash
cd bench
```

2. Install dependencies:
```bash
bun install
```

3. Set up your OpenRouter API key:
```bash
export OPENROUTER_API_KEY="your-api-key-here"
```

4. Run the interactive CLI:
```bash
bun run cli
```

### Setting Up the Web Visualizer

1. Navigate to the visualizer directory:
```bash
cd visualizer
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Running Benchmarks

The CLI provides an interactive interface to:
1. Select from available test suites
2. Set a version label for tracking results
3. Monitor real-time progress across all models
4. View detailed performance metrics

```bash
cd bench
bun run cli
```

### Creating Custom Test Suites

Test suites are JSON files stored in `/bench/tests/`. Here's the format:

```json
{
  "name": "Your Test Suite Name",
  "description": "What this test suite evaluates",
  "system_prompt": "Instructions for the AI model",
  "tests": [
    {
      "prompt": "Your test question or scenario",
      "answers": ["correct answer 1", "correct answer 2"],
      "negative_answers": ["wrong answer to avoid"]
    }
  ]
}
```

#### Example: Skateboard Trick Knowledge
```json
{
  "name": "Technical Trick Terminology",
  "description": "Tests AI knowledge of skateboard trick names",
  "system_prompt": "You are a skateboard trick naming assistant...",
  "tests": [
    {
      "prompt": "Board spins 360 degrees backside and flips in the kickflip direction. The skater does not spin.",
      "answers": ["tre flip", "360 flip"],
      "negative_answers": ["backside 360 kickflip", "backside 360 flip"]
    }
  ]
}
```

### Supported Models

skatebench currently supports these AI models through OpenRouter:

- **OpenAI**: GPT-4.1, GPT-4o, GPT-5 series, O3/O4 models
- **Anthropic**: Claude 4 Sonnet/Opus, Claude 3.5/3.7 Sonnet
- **Google**: Gemini 2.5 Pro/Flash, Gemini 2.0 Flash
- **xAI**: Grok-4, Grok-3 Mini
- **DeepSeek**: V3.1, R1-0528 (with reasoning)
- **Qwen**: QWen3 series with thinking capabilities
- **Others**: Kimi-K2, GLM-4.5, and more

*Note: Model availability depends on OpenRouter's current offerings*

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key | Yes |

### Benchmark Settings

Key configuration options in `/bench/constants.ts`:

```typescript
export const MAX_CONCURRENCY = 30;        // Parallel test limit
export const TEST_RUNS_PER_MODEL = 30;    // Runs per model/test
export const TIMEOUT_SECONDS = 400;       // Request timeout
export const OUTPUT_DIRECTORY = "./results"; // Results storage
```

## Output and Results

### File Structure
```
results/
├── [suite-id]/
│   └── [version]/
│       ├── test-results-[timestamp].json
│       ├── test-results-[timestamp].md
│       └── summary-[timestamp].json
└── cache/
    └── [suite-id]/
        └── [version]/
            └── [cached-results].json
```

### Result Format

Each test run generates:
- **JSON Report**: Complete results with metadata, timings, and costs
- **Markdown Report**: Human-readable summary with test details
- **Summary JSON**: Aggregated statistics and model rankings

## Advanced Features

### Result Caching

skatebench intelligently caches test results to avoid redundant API calls:
- Results are cached by test signature (prompt + expected answers)
- Cache respects versioning to track changes over time
- Automatic cache validation prevents stale results

### Cost Tracking

Monitor API costs across different models:
- Per-request cost tracking
- Aggregated costs by model and test suite
- Average cost per test calculations
- Budget planning capabilities

### Reasoning Models

Some models support enhanced reasoning modes:
- Grok series with X.AI reasoning
- GPT-O series with OpenAI reasoning
- DeepSeek thinking models
- QWen thinking capabilities

## Contributing

We welcome contributions! Please see our contributing guidelines for:
- Adding new AI model integrations
- Creating test suites for new domains
- Improving the visualization dashboard
- Enhancing performance and reliability

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- [OpenRouter](https://openrouter.ai/) - AI model provider
- [Bun](https://bun.sh/) - JavaScript runtime
- [Vercel AI SDK](https://sdk.vercel.ai/) - AI integration framework
