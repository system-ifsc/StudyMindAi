/** Server-only configuration for a Chat Completions compatible provider. */
export function aiProviderConfig() {
  const apiKey = process.env["AI_API_KEY"]?.trim();
  const baseURL = process.env["AI_BASE_URL"]?.trim();
  const model = process.env["AI_MODEL"]?.trim();
  if (!apiKey || !baseURL || !model) return null;
  try {
    const url = new URL(baseURL);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    return { apiKey, baseURL: baseURL.replace(/\/+$/, ""), model };
  } catch {
    return null;
  }
}
