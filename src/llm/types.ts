import type { AgentTurn } from "../agent/schema.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TurnInput {
  history: ChatMessage[];
  /** Resumo do estado do lead, gerado pelo código, para guiar a próxima resposta. */
  stateNote: string;
  offeredSlots: string[];
}

/** Qualquer "cérebro" do agente: o Claude em produção, ou um mock determinístico em testes e demos offline. */
export interface LlmClient {
  readonly name: string;
  nextTurn(input: TurnInput): Promise<AgentTurn>;
}
