/** O tipo vem do retorno de autenticação, nunca do endereço de e-mail. */
export function isPasswordRecoveryLink(search: string, hash: string): boolean {
  return [search, hash].some(
    (value) => new URLSearchParams(value.replace(/^[?#]/, "")).get("type") === "recovery",
  );
}
