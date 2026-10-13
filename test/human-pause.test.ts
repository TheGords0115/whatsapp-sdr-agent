import { describe, expect, it } from "vitest";
import { HumanPause } from "../src/handoff/human-pause.js";

describe("HumanPause", () => {
  it("pausa ao receber resposta humana e expira sozinha", () => {
    let now = 0;
    const pause = new HumanPause(60_000, () => now);

    pause.touch("5562999990000");
    expect(pause.isPaused("5562999990000")).toBe(true);

    now = 59_999;
    expect(pause.isPaused("5562999990000")).toBe(true);

    now = 60_000;
    expect(pause.isPaused("5562999990000")).toBe(false);
  });

  it("renova a pausa a cada nova mensagem do vendedor", () => {
    let now = 0;
    const pause = new HumanPause(60_000, () => now);
    pause.touch("1");
    now = 50_000;
    pause.touch("1");
    now = 100_000;
    expect(pause.isPaused("1")).toBe(true);
  });

  it("não afeta outros números", () => {
    const pause = new HumanPause(60_000, () => 0);
    pause.touch("1");
    expect(pause.isPaused("2")).toBe(false);
  });
});
