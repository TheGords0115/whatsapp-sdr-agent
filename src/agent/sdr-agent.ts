import { mergeLead, scoreLead, type LeadProfile, type LeadScore } from "../domain/lead.js";
import type { Clock, HumanPause } from "../handoff/human-pause.js";
import type { LlmClient } from "../llm/types.js";
import { nextVisitSlots } from "../scheduling/slots.js";
import type { Conversation, ConversationStore } from "../store/conversation-store.js";
import { stateNote } from "./prompt.js";
import type { AgentTurn } from "./schema.js";

export interface AgentResult {
  /** Texto a enviar ao cliente; null quando o agente deve ficar calado. */
  reply: string | null;
  conversation: Conversation;
  score: LeadScore;
  /** Por que o agente não respondeu (quando reply é null). */
  silencedBy?: "humano_respondendo" | "conversa_com_humano" | "conversa_encerrada";
}

export class SdrAgent {
  constructor(
    private readonly llm: LlmClient,
    private readonly store: ConversationStore,
    private readonly humanPause: HumanPause,
    private readonly now: Clock = Date.now,
  ) {}

  /** Mensagem que chegou do cliente. */
  async handleIncoming(phone: string, text: string): Promise<AgentResult> {
    const conversation = (await this.store.get(phone)) ?? this.newConversation(phone);
    conversation.history.push({ role: "user", content: text });
    conversation.updatedAt = new Date(this.now()).toISOString();

    const silencedBy = this.silenceReason(conversation);
    if (silencedBy) {
      await this.store.save(conversation);
      return { reply: null, conversation, score: scoreLead(conversation.lead), silencedBy };
    }

    const before = scoreLead(conversation.lead);
    const offeredSlots = isQualified(before) ? nextVisitSlots(new Date(this.now())) : [];

    const turn = await this.llm.nextTurn({
      history: conversation.history,
      stateNote: stateNote({ missing: before.missing, offeredSlots }),
      offeredSlots,
    });

    conversation.lead = mergeLead(conversation.lead, withoutNulls(turn.extracted));
    const after = scoreLead(conversation.lead);
    let reply = turn.reply;

    if (turn.intent === "falar_com_humano") {
      conversation.status = "com_humano";
    } else if (turn.intent === "sem_interesse") {
      conversation.status = "encerrado";
    } else if (turn.intent === "agendar_visita" && turn.chosenSlot && offeredSlots.includes(turn.chosenSlot)) {
      // Só aceita horário que o sistema ofereceu: a IA não pode inventar agenda.
      conversation.status = "visita_agendada";
      conversation.visit = turn.chosenSlot;
    } else if (!isQualified(before) && isQualified(after)) {
      // O lead acabou de completar o perfil: o código oferece os horários na mesma mensagem.
      const slots = nextVisitSlots(new Date(this.now()));
      reply = `${reply}\n\nPelo que você me contou, energia solar faz sentido pra você! Posso agendar uma visita técnica gratuita: ${slots.join(", ")}. Qual fica melhor?`;
    }

    conversation.history.push({ role: "assistant", content: reply });
    await this.store.save(conversation);
    return { reply, conversation, score: after };
  }

  /** Mensagem enviada por um vendedor pelo mesmo número: pausa o agente. */
  async handleHumanReply(phone: string, text: string): Promise<void> {
    const conversation = (await this.store.get(phone)) ?? this.newConversation(phone);
    conversation.history.push({ role: "assistant", content: `[vendedor] ${text}` });
    conversation.updatedAt = new Date(this.now()).toISOString();
    this.humanPause.touch(phone);
    await this.store.save(conversation);
  }

  /** Devolve a conversa para o agente. */
  async releaseToAgent(phone: string): Promise<void> {
    const conversation = await this.store.get(phone);
    if (!conversation) return;
    this.humanPause.release(phone);
    conversation.status = "em_conversa";
    await this.store.save(conversation);
  }

  private silenceReason(conversation: Conversation): AgentResult["silencedBy"] {
    if (this.humanPause.isPaused(conversation.phone)) return "humano_respondendo";
    if (conversation.status === "com_humano") return "conversa_com_humano";
    if (conversation.status === "encerrado") return "conversa_encerrada";
    return undefined;
  }

  private newConversation(phone: string): Conversation {
    return { phone, lead: {}, status: "em_conversa", history: [], updatedAt: new Date(this.now()).toISOString() };
  }
}

function isQualified(score: LeadScore): boolean {
  return score.tier === "quente" || score.tier === "morno";
}

function withoutNulls(extracted: AgentTurn["extracted"]): Partial<LeadProfile> {
  const result: Partial<LeadProfile> = {};
  for (const [key, value] of Object.entries(extracted)) {
    if (value !== null) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
