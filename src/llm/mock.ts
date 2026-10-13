import type { AgentTurn } from "../agent/schema.js";
import { SERVICE_AREA } from "../domain/lead.js";
import type { LlmClient, TurnInput } from "./types.js";

// "IA" de mentira, por regras, para rodar o projeto sem chave de API e para testes determinísticos.
// Ela só entende frases simples; a versão real usa o Claude (src/llm/anthropic.ts).

const QUESTIONS: Record<string, string> = {
  city: "Pra começar, de qual cidade você fala?",
  propertyType: "A instalação seria em casa, apartamento, comércio ou propriedade rural?",
  monthlyBill: "Em média, quanto vem a sua conta de luz por mês?",
  isDecisionMaker: "Você é quem decide sobre a instalação, ou tem mais alguém envolvido?",
  timelineMonths: "E em quanto tempo você pensa em instalar?",
};

export class MockLlm implements LlmClient {
  readonly name = "mock";

  async nextTurn(input: TurnInput): Promise<AgentTurn> {
    const last = [...input.history].reverse().find((m) => m.role === "user")?.content ?? "";
    const text = normalize(last);
    const extracted = extract(text);

    let intent: AgentTurn["intent"] = "qualificando";
    if (/\b(atendente|humano|pessoa|consultor)\b/.test(text)) intent = "falar_com_humano";
    else if (/\b(nao tenho interesse|nao quero|pare)\b/.test(text)) intent = "sem_interesse";

    const chosenSlot = input.offeredSlots.find((slot) => matchesSlot(text, slot)) ?? null;
    if (chosenSlot) intent = "agendar_visita";

    const missing = parseMissing(input.stateNote).filter((field) => extracted[field as keyof typeof extracted] == null);
    let reply: string;
    if (intent === "falar_com_humano") reply = "Claro! Vou chamar um consultor pra falar com você.";
    else if (intent === "sem_interesse") reply = "Tudo bem, obrigado pelo contato! Se mudar de ideia, é só chamar.";
    else if (chosenSlot) reply = `Combinado, visita marcada para ${chosenSlot}.`;
    else if (extracted.city && !SERVICE_AREA.includes(extracted.city)) reply = "Poxa, ainda não atendemos a sua cidade. Posso te avisar quando chegarmos aí?";
    else if (missing[0]) reply = QUESTIONS[missing[0]] ?? "Pode me contar um pouco mais?";
    else if (input.offeredSlots.length) reply = `Qual destes horários fica melhor pra visita: ${input.offeredSlots.join(", ")}?`;
    else reply = "Perfeito, anotei tudo!";

    return { reply, extracted, intent, chosenSlot };
  }
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** "quarta às 14h" casa com o horário "quarta 14/10 às 14h". */
function matchesSlot(text: string, slot: string): boolean {
  const [weekday] = normalize(slot).split(" ");
  const hour = /(\d{1,2})h/.exec(slot)?.[1];
  if (!weekday || !hour || !text.includes(weekday)) return false;
  return new RegExp(`\\b${hour}\\s*(h|hora|:00)`).test(text);
}

function parseMissing(stateNote: string): string[] {
  const match = /faltam: (.*)\./.exec(stateNote);
  if (!match?.[1] || match[1] === "nenhum") return [];
  return match[1].split(", ");
}

function extract(text: string): AgentTurn["extracted"] {
  const city = SERVICE_AREA.map((c) => [c, normalize(c)] as const).find(([, n]) => text.includes(n))?.[0] ?? cityOutsideArea(text);
  // Só considera valor de conta quando vem com "R$", "reais" ou "por mês" (evita confundir com hora ou data).
  const bill = /r\$\s*(\d{2,5})|(\d{2,5})(?:,\d{2})?\s*(?:reais|conto|por mes|\/mes)/.exec(text);
  const months = /(\d{1,2})\s*mes(es)?\b/.exec(text);
  return {
    name: null,
    city,
    propertyType: /\bcasa\b/.test(text) ? "casa" : /\bapartamento|\bapto\b/.test(text) ? "apartamento" : /\bcomercio|loja|empresa\b/.test(text) ? "comercio" : /\brural|fazenda|chacara\b/.test(text) ? "rural" : null,
    monthlyBill: bill ? Number(bill[1] ?? bill[2]) : null,
    isDecisionMaker: /\b(sou eu|eu decido|eu mesmo|eu mesma)\b/.test(text) ? true : /\b(meu marido|minha esposa|meu chefe|preciso ver com)\b/.test(text) ? false : null,
    timelineMonths: months ? Number(months[1]) : /\b(agora|urgente|esse mes|o quanto antes)\b/.test(text) ? 1 : null,
  };
}

function cityOutsideArea(text: string): string | null {
  const match = /\b(?:sou de|moro em|fico em)\s+([a-z ]{3,30})/.exec(text);
  return match?.[1]?.trim() ?? null;
}
