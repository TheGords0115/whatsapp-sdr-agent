import { describe, expect, it } from "vitest";
import { mergeLead, scoreLead } from "../src/domain/lead.js";

const complete = {
  city: "Goiânia",
  propertyType: "casa" as const,
  monthlyBill: 800,
  isDecisionMaker: true,
  timelineMonths: 2,
};

describe("scoreLead", () => {
  it("lista o que falta enquanto o perfil está incompleto", () => {
    const result = scoreLead({ city: "Goiânia", monthlyBill: 500 });
    expect(result.tier).toBe("incompleto");
    expect(result.missing).toEqual(["propertyType", "isDecisionMaker", "timelineMonths"]);
  });

  it("classifica como quente conta alta, decisor e prazo curto", () => {
    expect(scoreLead(complete)).toEqual({ score: 100, tier: "quente", missing: [] });
  });

  it("rebaixa quem não decide e não tem pressa", () => {
    const result = scoreLead({ ...complete, isDecisionMaker: false, timelineMonths: 12 });
    expect(result.tier).toBe("morno");
  });

  it("nunca qualifica fora da área atendida", () => {
    const result = scoreLead({ ...complete, city: "Recife" });
    expect(result.tier).toBe("frio");
    expect(result.score).toBeLessThanOrEqual(30);
  });
});

describe("mergeLead", () => {
  it("não apaga dados já conhecidos com valores vazios", () => {
    const merged = mergeLead({ city: "Anápolis", monthlyBill: 400 }, { city: undefined, monthlyBill: 450 });
    expect(merged).toEqual({ city: "Anápolis", monthlyBill: 450 });
  });
});
