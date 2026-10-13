import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { SdrAgent } from "../src/agent/sdr-agent.js";
import { HumanPause } from "../src/handoff/human-pause.js";
import { MockLlm } from "../src/llm/mock.js";
import { InMemoryStore } from "../src/store/conversation-store.js";

function setup() {
  const store = new InMemoryStore();
  const agent = new SdrAgent(new MockLlm(), store, new HumanPause(60_000));
  return { app: buildApp(agent, store), store };
}

describe("API", () => {
  it("responde o cliente pelo webhook e lista o lead", async () => {
    const { app } = setup();
    const res = await app.inject({ method: "POST", url: "/webhook/whatsapp", payload: { from: "5562999990000", text: "Oi, sou de Anápolis" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().reply).toContain("casa, apartamento");

    const leads = await app.inject({ method: "GET", url: "/leads" });
    expect(leads.json()[0].lead.city).toBe("anápolis");
  });

  it("recusa payload inválido", async () => {
    const { app } = setup();
    const res = await app.inject({ method: "POST", url: "/webhook/whatsapp", payload: { text: "oi" } });
    expect(res.statusCode).toBe(400);
  });

  it("mensagem do próprio número pausa o agente", async () => {
    const { app } = setup();
    await app.inject({ method: "POST", url: "/webhook/whatsapp", payload: { from: "5562999990000", text: "Oi, sou o consultor", fromMe: true } });
    const res = await app.inject({ method: "POST", url: "/webhook/whatsapp", payload: { from: "5562999990000", text: "Oi!" } });
    expect(res.json().reply).toBeNull();
    expect(res.json().silencedBy).toBe("humano_respondendo");
  });
});
