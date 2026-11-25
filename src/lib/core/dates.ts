/** Datas no formato AAAA-MM-DD, sempre no fuso local do navegador. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function parseISODate(s: string): Date {
  const [y = 1970, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s: string, n: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}
export function today(): string {
  return toISODate(new Date());
}
/** 0 = segunda … 6 = domingo */
export function weekdayIndex(s: string): number {
  return (parseISODate(s).getDay() + 6) % 7;
}
export function startOfWeek(s: string): string {
  return addDays(s, -weekdayIndex(s));
}
export const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
export const WEEKDAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export function formatBR(s: string): string {
  return parseISODate(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60),
    m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
