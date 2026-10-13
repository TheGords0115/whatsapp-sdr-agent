import Anthropic from "@anthropic-ai/sdk";
import { SdrAgent } from "./agent/sdr-agent.js";
import { HumanPause } from "./handoff/human-pause.js";
import { AnthropicLlm } from "./llm/anthropic.js";
import { MockLlm } from "./llm/mock.js";
import type { LlmClient } from "./llm/types.js";
import { InMemoryStore } from "./store/conversation-store.js";

export const config = {
  port: Number(process.env.PORT ?? 3000),
  model: process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5",
  humanPauseMinutes: Number(process.env.HUMAN_PAUSE_MINUTES ?? 60),
  /** "mock" roda sem chave de API; "anthropic" usa o Claude. */
  llm: process.env.LLM ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : "mock"),
};

export function buildLlm(): LlmClient {
  return config.llm === "anthropic" ? new AnthropicLlm(config.model, new Anthropic()) : new MockLlm();
}

export function buildRuntime(llm: LlmClient = buildLlm()) {
  const store = new InMemoryStore();
  const agent = new SdrAgent(llm, store, new HumanPause(config.humanPauseMinutes * 60_000));
  return { agent, store, llm };
}
