import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AgentTurnSchema, type AgentTurn } from "../agent/schema.js";
import { SYSTEM_PROMPT } from "../agent/prompt.js";
import type { LlmClient, TurnInput } from "./types.js";

const FALLBACK_REPLY: AgentTurn = {
  reply: "Só um instante, já te respondo!",
  extracted: { name: null, city: null, propertyType: null, monthlyBill: null, isDecisionMaker: null, timelineMonths: null },
  intent: "falar_com_humano",
  chosenSlot: null,
};

export class AnthropicLlm implements LlmClient {
  readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(
    private readonly model: string,
    client?: Anthropic,
  ) {
    this.client = client ?? new Anthropic();
  }

  async nextTurn(input: TurnInput): Promise<AgentTurn> {
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 4000,
      // Conversa de WhatsApp é curta e precisa ser rápida.
      output_config: { effort: "low", format: betaZodOutputFormat(AgentTurnSchema) },
      // Se o modelo recusar a mensagem, a própria API tenta de novo com um modelo de reserva.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // O prompt fixo fica em cache; o estado do lead entra como mensagem de sistema no fim da conversa.
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [...input.history, { role: "system", content: input.stateNote }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      // Sem resposta válida: o agente pede um instante e o lead vai para um humano.
      return FALLBACK_REPLY;
    }
    return response.parsed_output;
  }
}
