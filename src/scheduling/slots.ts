// Horários de visita técnica: dias úteis, 9h e 14h, a partir do próximo dia útil.

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const HOURS = [9, 14];

export function nextVisitSlots(from: Date, count = 3): string[] {
  const slots: string[] = [];
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  while (slots.length < count) {
    day.setDate(day.getDate() + 1);
    const weekday = day.getDay();
    if (weekday === 0 || weekday === 6) continue;
    for (const hour of HOURS) {
      if (slots.length === count) break;
      const dd = String(day.getDate()).padStart(2, "0");
      const mm = String(day.getMonth() + 1).padStart(2, "0");
      slots.push(`${WEEKDAYS[weekday]} ${dd}/${mm} às ${hour}h`);
    }
  }
  return slots;
}
