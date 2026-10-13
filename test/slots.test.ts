import { describe, expect, it } from "vitest";
import { nextVisitSlots } from "../src/scheduling/slots.js";

describe("nextVisitSlots", () => {
  it("oferece horários a partir do próximo dia útil, pulando o fim de semana", () => {
    // Sexta-feira, 16/10/2026
    const slots = nextVisitSlots(new Date(2026, 9, 16, 10, 0));
    expect(slots).toEqual(["segunda 19/10 às 9h", "segunda 19/10 às 14h", "terça 20/10 às 9h"]);
  });
});
