import Fastify from "fastify";
import { z } from "zod";
import type { SdrAgent } from "./agent/sdr-agent.js";
import type { ConversationStore } from "./store/conversation-store.js";

// Formato genérico de webhook. Cada provedor de WhatsApp (uazapi, Z-API, Cloud API...) tem o seu;
// na vida real, um adaptador converte o payload do provedor para este formato.
const WebhookBody = z.object({
  from: z.string().min(8),
  text: z.string().min(1),
  /** true quando a mensagem foi enviada pelo próprio número da empresa (um vendedor respondendo). */
  fromMe: z.boolean().default(false),
});

export function buildApp(agent: SdrAgent, store: ConversationStore) {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  app.get("/health", async () => ({ ok: true }));

  app.post("/webhook/whatsapp", async (request, reply) => {
    const parsed = WebhookBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "payload inválido", issues: parsed.error.issues });

    const { from, text, fromMe } = parsed.data;
    if (fromMe) {
      await agent.handleHumanReply(from, text);
      return { reply: null, silencedBy: "humano_respondendo" };
    }

    const result = await agent.handleIncoming(from, text);
    // Aqui entraria o envio para o provedor de WhatsApp. O demo devolve a resposta no corpo.
    return { reply: result.reply, silencedBy: result.silencedBy ?? null, status: result.conversation.status, score: result.score };
  });

  app.post<{ Params: { phone: string } }>("/leads/:phone/release", async (request) => {
    await agent.releaseToAgent(request.params.phone);
    return { ok: true };
  });

  app.get("/leads", async () => {
    const conversations = await store.list();
    return conversations.map(({ phone, lead, status, visit, updatedAt }) => ({ phone, lead, status, visit, updatedAt }));
  });

  return app;
}
