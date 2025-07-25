export const OUTPUT_DIRECTORY = "./results";

export const MAX_CONCURRENCY = 25;
export const TEST_RUNS_PER_MODEL = 4;
export const TIMEOUT_SECONDS = 200;

import { type LanguageModel } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
export type RunnableModel = {
  name: string;
  llm: LanguageModel;
  providerOptions?: any;
  reasoning?: boolean;
};

export const modelsToRun: RunnableModel[] = [
  {
    name: "grok-4",
    llm: openrouter("x-ai/grok-4"),
    reasoning: true,
  },
  {
    name: "kimi-k2",
    llm: openrouter("moonshotai/kimi-k2"),
    reasoning: true,
  },
  // {
  //   name: "gemini-2.0-flash",
  //   llm: openrouter("google/gemini-2.0-flash-001"),
  // },
  {
    name: "gemini-2.5-pro",
    llm: openrouter("google/gemini-2.5-pro-preview"),
    reasoning: true,
  },
  // {
  //   name: "grok-3-mini",
  //   llm: openrouter("x-ai/grok-3-mini-beta"),
  //   reasoning: true,
  // },
  {
    name: "qwen-3-32b",
    llm: openrouter("qwen/qwen3-32b"),
    reasoning: true,
  },
  {
    name: "claude-4-sonnet",
    llm: openrouter("anthropic/claude-sonnet-4"),
    reasoning: true,
  },
  {
    name: "claude-4-opus",
    llm: openrouter("anthropic/claude-opus-4"),
    reasoning: true,
  },
  // {
  //   name: "claude-3-5-sonnet",
  //   llm: openrouter("anthropic/claude-3.5-sonnet"),
  // },
  // {
  //   name: "claude-3-7-sonnet",
  //   llm: openrouter("anthropic/claude-3.7-sonnet"),
  // },
  // {
  //   name: "claude-3-7-sonnet-thinking",
  //   llm: openrouter("anthropic/claude-3.7-sonnet:thinking"),
  //   reasoning: true,
  // },
  {
    name: "o4-mini",
    llm: openrouter("openai/o4-mini"),
    reasoning: true,
  },
];
