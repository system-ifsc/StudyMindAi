/** Validação compartilhada pelos fluxos de redefinição de senha. */
export function passwordResetError(password: string, confirmation: string): string | null {
  if (password.length < 8) return "Use pelo menos 8 caracteres.";
  if (password !== confirmation) return "As senhas não coincidem. Confira a confirmação.";
  return null;
}

/** Distingue limites de envio do projeto de limites de tentativas do usuário. */
export function authErrorMessage(error: unknown): string {
  const details = error as { message?: string; code?: string } | null;
  const msg = details?.message || "Não foi possível concluir a autenticação. Tente novamente.";
  if (details?.code === "over_email_send_rate_limit" || /email rate limit exceeded/i.test(msg))
    return "O serviço de e-mail atingiu o limite de envios. Não foi possível enviar a confirmação ou recuperação. Tente mais tarde; se o problema continuar, entre em contato com o responsável pelo site.";
  if (details?.code === "email_address_not_authorized")
    return "O serviço de e-mail ainda não está habilitado para enviar para este endereço. Entre em contato com o responsável pelo site.";
  if (details?.code === "same_password") return "Escolha uma senha diferente da senha atual.";
  if (details?.code === "otp_expired" || details?.code === "session_not_found")
    return "O link de recuperação expirou ou já foi usado. Solicite um novo link.";
  if (/invalid login/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg))
    return "Confirme seu e-mail antes de entrar (verifique a caixa de entrada e o spam).";
  if (/already registered/i.test(msg)) return "Este e-mail já tem conta. Faça login.";
  if (/password/i.test(msg) && /least|short|weak/i.test(msg))
    return "Senha fraca: use pelo menos 8 caracteres.";
  if (details?.code === "over_request_rate_limit" || /rate limit/i.test(msg))
    return "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
  if (/fetch|network|connection/i.test(msg))
    return "Não foi possível conectar. Confira sua conexão e tente novamente.";
  return msg;
}
