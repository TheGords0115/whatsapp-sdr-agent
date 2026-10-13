import { buildApp } from "./app.js";
import { buildRuntime, config } from "./config.js";

const { agent, store, llm } = buildRuntime();
const app = buildApp(agent, store);

await app.listen({ port: config.port, host: "0.0.0.0" });
app.log.info(`Agente SDR no ar na porta ${config.port} (IA: ${llm.name})`);
