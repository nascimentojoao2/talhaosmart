const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_CODE_REGEX = /^\d{6}$/;

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeEmail(value: unknown) {
  return normalizeString(value).toLowerCase();
}

export function normalizeVerificationCode(value: unknown) {
  return normalizeString(value).replace(/\s+/g, '');
}

export function validateNome(value: unknown) {
  const nome = normalizeString(value);
  if (!nome) return 'Informe seu nome.';
  if (nome.length < 2) return 'O nome deve ter pelo menos 2 caracteres.';
  return null;
}

export function validateEmail(value: unknown) {
  const email = normalizeEmail(value);
  if (!email) return 'Informe seu email.';
  if (!EMAIL_REGEX.test(email)) return 'Informe um email válido.';
  return null;
}

export function validatePassword(value: unknown, fieldLabel = 'senha') {
  const senha = typeof value === 'string' ? value : '';
  if (!senha.trim()) return `Informe ${fieldLabel}.`;
  if (senha.trim().length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
  return null;
}

export function validateVerificationCode(value: unknown) {
  const codigo = normalizeVerificationCode(value);
  if (!codigo) return 'Informe o código de verificação.';
  if (!VERIFICATION_CODE_REGEX.test(codigo)) return 'O código deve ter 6 dígitos.';
  return null;
}

export function isGoogleAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim() &&
    process.env.GOOGLE_REDIRECT_URI?.trim()
  );
}

export function getAuthProvidersStatus() {
  const googleConfigured = isGoogleAuthConfigured();

  return {
    local: {
      enabled: true,
      ready: true
    },
    google: {
      enabled: true,
      ready: false,
      configured: googleConfigured,
      message: googleConfigured
        ? 'Configuração base detectada. A troca OAuth ainda não está finalizada nesta versão.'
        : 'Defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI para concluir o login com Google.'
    }
  };
}
