// Perfil do lead e regra de qualificação.
// A IA só extrai dados da conversa; quem decide se o lead está qualificado é este código,
// para a regra ser previsível, testável e igual para todo mundo.

export type PropertyType = "casa" | "apartamento" | "comercio" | "rural";

export interface LeadProfile {
  name?: string;
  city?: string;
  propertyType?: PropertyType;
  /** Valor médio da conta de luz, em reais. */
  monthlyBill?: number;
  /** A pessoa é quem decide a compra (dona do imóvel ou responsável)? */
  isDecisionMaker?: boolean;
  /** Em quantos meses pretende instalar. */
  timelineMonths?: number;
}

export type LeadTier = "quente" | "morno" | "frio" | "incompleto";

export interface LeadScore {
  score: number;
  tier: LeadTier;
  missing: Array<keyof LeadProfile>;
}

/** Cidades atendidas pela empresa fictícia do demo. */
export const SERVICE_AREA = ["goiânia", "aparecida de goiânia", "anápolis", "trindade", "senador canedo"];

const REQUIRED: Array<keyof LeadProfile> = ["city", "propertyType", "monthlyBill", "isDecisionMaker", "timelineMonths"];

export function scoreLead(lead: LeadProfile): LeadScore {
  const missing = REQUIRED.filter((field) => lead[field] === undefined);
  if (missing.length > 0) return { score: 0, tier: "incompleto", missing };

  let score = 0;

  // Conta de luz é o principal indicador de economia (e de ticket).
  const bill = lead.monthlyBill ?? 0;
  if (bill >= 600) score += 40;
  else if (bill >= 300) score += 25;
  else if (bill >= 150) score += 10;

  if (lead.isDecisionMaker) score += 25;

  const timeline = lead.timelineMonths ?? 99;
  if (timeline <= 3) score += 20;
  else if (timeline <= 6) score += 10;

  if (lead.propertyType !== "apartamento") score += 10;

  if (lead.city && isInServiceArea(lead.city)) score += 5;
  else score = Math.min(score, 30); // fora da área atendida nunca passa de frio

  const tier: LeadTier = score >= 70 ? "quente" : score >= 40 ? "morno" : "frio";
  return { score, tier, missing: [] };
}

export function isInServiceArea(city: string): boolean {
  const normalized = city.trim().toLowerCase();
  return SERVICE_AREA.includes(normalized);
}

/** Junta o que a IA extraiu agora com o que já se sabia, sem apagar dados com "não sei". */
export function mergeLead(current: LeadProfile, extracted: Partial<LeadProfile>): LeadProfile {
  const next: LeadProfile = { ...current };
  for (const [key, value] of Object.entries(extracted) as Array<[keyof LeadProfile, unknown]>) {
    if (value !== undefined && value !== null && value !== "") {
      (next as Record<string, unknown>)[key] = value;
    }
  }
  return next;
}
