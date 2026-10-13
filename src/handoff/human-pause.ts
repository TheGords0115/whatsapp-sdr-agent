// Quando um vendedor responde pelo mesmo número, o agente se cala por um tempo.
// A pausa expira sozinha (TTL): se o humano esquecer de "devolver" a conversa, a IA volta a atender.

export type Clock = () => number;

export class HumanPause {
  private readonly until = new Map<string, number>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: Clock = Date.now,
  ) {}

  /** Chamado a cada mensagem enviada por um humano: renova a pausa. */
  touch(phone: string): void {
    this.until.set(phone, this.now() + this.ttlMs);
  }

  isPaused(phone: string): boolean {
    const until = this.until.get(phone);
    if (until === undefined) return false;
    if (this.now() >= until) {
      this.until.delete(phone);
      return false;
    }
    return true;
  }

  release(phone: string): void {
    this.until.delete(phone);
  }
}
