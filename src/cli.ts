import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { COMPANY } from "./agent/prompt.js";
import { buildRuntime } from "./config.js";

// Simulador de WhatsApp no terminal.
// Comandos: /lead mostra o perfil do lead, /vendedor <texto> responde como humano, /devolver devolve ao agente, /sair.

const { agent, store, llm } = buildRuntime();
const phone = "5562999990000";
const rl = createInterface({ input, output, prompt: "você> " });

console.log(`Conversa com a ${COMPANY.agentName}, da ${COMPANY.name} (IA: ${llm.name}). Digite /sair para encerrar.\n`);
rl.prompt();

for await (const line of rl) {
  const text = line.trim();
  if (text === "/sair") break;
  if (text) await handle(text);
  rl.prompt();
}
rl.close();

async function handle(text: string): Promise<void> {
  if (text === "/lead") {
    const conversation = await store.get(phone);
    console.log(JSON.stringify({ lead: conversation?.lead, status: conversation?.status, visit: conversation?.visit }, null, 2));
    return;
  }
  if (text.startsWith("/vendedor ")) {
    await agent.handleHumanReply(phone, text.slice("/vendedor ".length));
    console.log("(agente pausado: um vendedor assumiu a conversa)");
    return;
  }
  if (text === "/devolver") {
    await agent.releaseToAgent(phone);
    console.log("(conversa devolvida ao agente)");
    return;
  }

  const result = await agent.handleIncoming(phone, text);
  if (result.reply) console.log(`${COMPANY.agentName.toLowerCase()}> ${result.reply}`);
  else console.log(`(sem resposta: ${result.silencedBy})`);
  const points = result.score.score ? `, ${result.score.score} pts` : "";
  console.log(`   [lead: ${result.score.tier}${points} · status: ${result.conversation.status}]\n`);
}
