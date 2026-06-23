import { config } from '../../config/env.js';

// Mock de envio. Em produção iria para um provedor (SES, Sendgrid...). Aqui, em
// dev, deixo o token no log para dar para seguir o fluxo na mão; em teste fico
// quieto e o próprio teste lê o token direto do Redis.
export function enviarEmailVerificacao(email: string, token: string): void {
  if (config.NODE_ENV === 'test') {
    return;
  }
  console.info(
    `[email] Verificação para ${email} — POST /v1/auth/verify-email com { "token": "${token}" }`,
  );
}

export function enviarEmailResetSenha(email: string, token: string): void {
  if (config.NODE_ENV === 'test') {
    return;
  }
  console.info(
    `[email] Reset de senha para ${email} — POST /v1/auth/reset-password com { "token": "${token}", "novaSenha": "..." }`,
  );
}
