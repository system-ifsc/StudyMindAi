export async function localRequest<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/local", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as { data: T; error?: string };
  if (!response.ok) throw new Error(result.error || "Não foi possível acessar o servidor.");
  return result.data;
}
