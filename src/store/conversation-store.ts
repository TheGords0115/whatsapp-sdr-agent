import type { LeadProfile } from "../domain/lead.js";
import type { ChatMessage } from "../llm/types.js";

export type LeadStatus = "em_conversa" | "visita_agendada" | "com_humano" | "encerrado";

export interface Conversation {
  phone: string;
  lead: LeadProfile;
  status: LeadStatus;
  history: ChatMessage[];
  visit?: string;
  updatedAt: string;
}

/** Onde as conversas ficam. Em produção seria Redis/PostgreSQL; aqui fica em memória. */
export interface ConversationStore {
  get(phone: string): Promise<Conversation | undefined>;
  save(conversation: Conversation): Promise<void>;
  list(): Promise<Conversation[]>;
}

export class InMemoryStore implements ConversationStore {
  private readonly data = new Map<string, Conversation>();

  constructor(private readonly maxHistory = 30) {}

  async get(phone: string): Promise<Conversation | undefined> {
    const found = this.data.get(phone);
    return found ? structuredClone(found) : undefined;
  }

  async save(conversation: Conversation): Promise<void> {
    // Guarda só as últimas mensagens: o modelo não precisa do histórico inteiro e o custo cai.
    const history = conversation.history.slice(-this.maxHistory);
    this.data.set(conversation.phone, structuredClone({ ...conversation, history }));
  }

  async list(): Promise<Conversation[]> {
    return [...this.data.values()].map((c) => structuredClone(c));
  }
}
