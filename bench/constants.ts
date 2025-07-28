export const OUTPUT_DIRECTORY = "./results";

export const MAX_CONCURRENCY = 30;
export const TEST_RUNS_PER_MODEL = 30;
export const TIMEOUT_SECONDS = 200;

import { type LanguageModel } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";

export type RunnableModel = {
  name: string;
  llm: LanguageModel;
  providerOptions?: any;
  reasoning?: boolean;
};

// Include "usage" so we can log cost
const defaultProviderOptions = {
  usage: {
    include: true,
  },
};

export const modelsToRun: RunnableModel[] = [
  // {
  //   name: "grok-4",
  //   llm: openrouter("x-ai/grok-4", defaultProviderOptions),
  //   reasoning: true,
  // },
  {
    name: "kimi-k2",
    llm: openrouter("moonshotai/kimi-k2", defaultProviderOptions),
  },
  // {
  //   name: "gemini-2.5-pro",
  //   llm: openrouter("google/gemini-2.5-pro-preview", defaultProviderOptions),
  //   reasoning: true,
  // },
  {
    name: "grok-3-mini",
    llm: openrouter("x-ai/grok-3-mini-beta", defaultProviderOptions),
    reasoning: true,
  },
  {
    name: "qwen-3-32b",
    llm: openrouter("qwen/qwen3-32b", defaultProviderOptions),
    reasoning: true,
  },
  // {
  //   name: "claude-4-sonnet",
  //   llm: openrouter("anthropic/claude-sonnet-4", defaultProviderOptions),
  //   reasoning: true,
  // },
  // {
  //   name: "claude-4-opus",
  //   llm: openrouter("anthropic/claude-opus-4", defaultProviderOptions),
  //   reasoning: true,
  // },
  // {
  //   name: "o4-mini",
  //   llm: openrouter("openai/o4-mini", defaultProviderOptions),
  //   reasoning: true,
  // },
  // {
  //   name: "o3",
  //   llm: openrouter("openai/o3", defaultProviderOptions),
  //   reasoning: true,
  // },
  // {
  //   name: "gpt-4.1",
  //   llm: openrouter("openai/gpt-4.1", defaultProviderOptions),
  //   reasoning: true,
  // },
  // {
  //   name: "gpt-4o",
  //   llm: openrouter("openai/gpt-4o", defaultProviderOptions),
  //   reasoning: true,
  // },

  // Unused at this point
  // {
  //   name: "gemini-2.0-flash",
  //   llm: openrouter("google/gemini-2.0-flash-001", defaultProviderOptions),
  // },
  // {
  //   name: "claude-3-5-sonnet",
  //   llm: openrouter("anthropic/claude-3.5-sonnet", defaultProviderOptions),
  // },
  // {
  //   name: "claude-3-7-sonnet",
  //   llm: openrouter("anthropic/claude-3.7-sonnet", defaultProviderOptions),
  // },
  // {
  //   name: "claude-3-7-sonnet-thinking",
  //   llm: openrouter(
  //     "anthropic/claude-3.7-sonnet:thinking",
  //     defaultProviderOptions
  //   ),
  //   reasoning: true,
  // },
];
