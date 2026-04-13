const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX = /^\d{6}$/;

function normalize(value: string) {
  return value.trim();
}

export function validateLoginForm(email: string, senha: string) {
  const normalizedEmail = normalize(email).toLowerCase();
  if (!normalizedEmail) return 'Informe seu email.';
  if (!EMAIL_REGEX.test(normalizedEmail)) return 'Informe um email válido.';
  if (!normalize(senha)) return 'Informe sua senha.';
  return null;
}

export function validateRegisterForm(nome: string, email: string, senha: string) {
  const normalizedName = normalize(nome);
  if (!normalizedName) return 'Informe seu nome.';
  if (normalizedName.length < 2) return 'O nome deve ter pelo menos 2 caracteres.';

  const loginError = validateLoginForm(email, senha);
  if (loginError) return loginError;

  if (normalize(senha).length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
  return null;
}

export function validateVerificationForm(email: string, codigo: string) {
  const normalizedEmail = normalize(email).toLowerCase();
  if (!normalizedEmail) return 'Informe seu email.';
  if (!EMAIL_REGEX.test(normalizedEmail)) return 'Informe um email válido.';

  const normalizedCode = normalize(codigo).replace(/\s+/g, '');
  if (!normalizedCode) return 'Informe o código recebido.';
  if (!CODE_REGEX.test(normalizedCode)) return 'O código deve ter 6 dígitos.';
  return null;
}

export function validateForgotPasswordForm(email: string) {
  const normalizedEmail = normalize(email).toLowerCase();
  if (!normalizedEmail) return 'Informe seu email.';
  if (!EMAIL_REGEX.test(normalizedEmail)) return 'Informe um email válido.';
  return null;
}

export function validateResetPasswordForm(email: string, codigo: string, novaSenha: string) {
  const verificationError = validateVerificationForm(email, codigo);
  if (verificationError) return verificationError;
  if (!normalize(novaSenha)) return 'Informe a nova senha.';
  if (normalize(novaSenha).length < 6) return 'A nova senha deve ter pelo menos 6 caracteres.';
  return null;
}
