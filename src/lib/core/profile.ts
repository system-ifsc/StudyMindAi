/** Os limites são os mesmos no formulário, no backup e nos dois bancos. */
export function availabilityError(minutes: number[]): string | null {
  if (minutes.length !== 7 || minutes.some((n) => !Number.isInteger(n) || n < 0 || n > 960))
    return "Informe entre 0 e 960 minutos inteiros por dia.";
  const total = minutes.reduce((sum, n) => sum + n, 0);
  if (total < 30) return "Informe pelo menos 30 minutos por semana.";
  if (total > 6000) return "A disponibilidade deve somar no máximo 100 horas por semana.";
  return null;
}
