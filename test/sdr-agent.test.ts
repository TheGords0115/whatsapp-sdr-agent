import { beforeEach, describe, expect, it } from "vitest";
import type { AgentTurn } from "../src/agent/schema.js";
import { SdrAgent } from "../src/agent/sdr-agent.js";
import { HumanPause } from "../src/handoff/human-pause.js";
import { MockLlm } from "../src/llm/mock.js";
import type { LlmClient, TurnInput } from "../src/llm/types.js";
import { InMemoryStore } from "../src/store/conversation-store.js";

const PHONE = "5562999990000";
const NOW = new Date(2026, 9, 16, 10, 0).getTime(); // sexta-feira

const empty: AgentTurn["extracted"] = {
  name: null,
  city: null,
  propertyType: null,
  monthlyBill: null,
  isDecisionMaker: null,
  timelineMonths: null,
};

/** LLM roteirizado: devolve respostas prontas e guarda o que recebeu. */
class ScriptedLlm implements LlmClient {
  readonly name = "scripted";
  readonly inputs: TurnInput[] = [];
  constructor(private readonly turns: AgentTurn[]) {}
  async nextTurn(input: TurnInput): Promise<AgentTurn> {
    this.inputs.push(structuredClone(input));
    const turn = this.turns.shift();
    if (!turn) throw new Error("roteiro acabou");
    return turn;
  }
}

describe("SdrAgent", () => {
  let store: InMemoryStore;
  let pause: HumanPause;
  let now: number;

  beforeEach(() => {
    store = new InMemoryStore();
    now = NOW;
    pause = new HumanPause(60 * 60_000, () => now);
  });

  it("qualifica o lead com o mock e oferece visita quando o perfil fica completo", async () => {
    const agent = new SdrAgent(new MockLlm(), store, pause, () => now);

    await agent.handleIncoming(PHONE, "Oi, quero saber de energia solar");
    await agent.handleIncoming(PHONE, "Sou de Goiânia");
    await agent.handleIncoming(PHONE, "É uma casa");
    await agent.handleIncoming(PHONE, "Uns 700 reais por mês");
    await agent.handleIncoming(PHONE, "Sou eu mesmo que decido");
    const last = await agent.handleIncoming(PHONE, "Queria instalar em 2 meses");

    expect(last.score.tier).toBe("quente");
    expect(last.reply).toContain("visita técnica gratuita");
    expect(last.reply).toContain("segunda 19/10 às 9h");
  });

  it("só agenda horário que o sistema ofereceu", async () => {
    await store.save({
      phone: PHONE,
      lead: { city: "Goiânia", propertyType: "casa", monthlyBill: 800, isDecisionMaker: true, timelineMonths: 2 },
      status: "em_conversa",
      history: [],
      updatedAt: new Date(now).toISOString(),
    });
    const llm = new ScriptedLlm([
      { reply: "Fechado!", extracted: empty, intent: "agendar_visita", chosenSlot: "sábado 17/10 às 8h" },
      { reply: "Combinado!", extracted: empty, intent: "agendar_visita", chosenSlot: "segunda 19/10 às 14h" },
    ]);
    const agent = new SdrAgent(llm, store, pause, () => now);

    const invented = await agent.handleIncoming(PHONE, "pode ser sábado 8h?");
    expect(invented.conversation.status).toBe("em_conversa");

    const valid = await agent.handleIncoming(PHONE, "segunda às 14h então");
    expect(valid.conversation.status).toBe("visita_agendada");
    expect(valid.conversation.visit).toBe("segunda 19/10 às 14h");
    expect(llm.inputs[1]?.offeredSlots).toContain("segunda 19/10 às 14h");
  });

  it("fica em silêncio enquanto um vendedor responde e volta depois do TTL", async () => {
    const llm = new ScriptedLlm([{ reply: "Oi de novo!", extracted: empty, intent: "qualificando", chosenSlot: null }]);
    const agent = new SdrAgent(llm, store, pause, () => now);

    await agent.handleHumanReply(PHONE, "Oi, aqui é o Carlos, consultor");
    const silenced = await agent.handleIncoming(PHONE, "Oi Carlos!");
    expect(silenced.reply).toBeNull();
    expect(silenced.silencedBy).toBe("humano_respondendo");
    expect(llm.inputs).toHaveLength(0);

    now += 61 * 60_000;
    const back = await agent.handleIncoming(PHONE, "alguém aí?");
    expect(back.reply).toBe("Oi de novo!");
  });

  it("passa para um humano quando o cliente pede e não responde mais sozinho", async () => {
    const agent = new SdrAgent(new MockLlm(), store, pause, () => now);
    const handoff = await agent.handleIncoming(PHONE, "quero falar com um atendente");
    expect(handoff.conversation.status).toBe("com_humano");

    const next = await agent.handleIncoming(PHONE, "oi?");
    expect(next.reply).toBeNull();
    expect(next.silencedBy).toBe("conversa_com_humano");

    await agent.releaseToAgent(PHONE);
    const released = await agent.handleIncoming(PHONE, "oi de novo");
    expect(released.reply).not.toBeNull();
  });
});
