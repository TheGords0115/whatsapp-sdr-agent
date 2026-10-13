import { z } from "zod";

// Formato que o modelo devolve a cada mensagem. A API garante esse formato via structured outputs,
// então o código nunca precisa "adivinhar" o que a IA quis dizer.
export const AgentTurnSchema = z.object({
  reply: z.string().describe("Mensagem curta para enviar ao cliente no WhatsApp, em português do Brasil."),
  extracted: z
    .object({
      name: z.string().nullable(),
      city: z.string().nullable(),
      propertyType: z.enum(["casa", "apartamento", "comercio", "rural"]).nullable(),
      monthlyBill: z.number().nullable().describe("Valor médio da conta de luz em reais."),
      isDecisionMaker: z.boolean().nullable(),
      timelineMonths: z.number().nullable().describe("Em quantos meses pretende instalar."),
    })
    .describe("Somente dados que o cliente informou nesta conversa; null quando não informado."),
  intent: z
    .enum(["qualificando", "agendar_visita", "falar_com_humano", "sem_interesse", "outro"])
    .describe("O que o cliente quer neste momento."),
  chosenSlot: z
    .string()
    .nullable()
    .describe("Horário escolhido pelo cliente, copiado exatamente da lista de horários oferecidos; null se não escolheu."),
});

export type AgentTurn = z.infer<typeof AgentTurnSchema>;
