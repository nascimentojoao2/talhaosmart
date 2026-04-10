"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEmail = normalizeEmail;
exports.normalizeVerificationCode = normalizeVerificationCode;
exports.validateNome = validateNome;
exports.validateEmail = validateEmail;
exports.validatePassword = validatePassword;
exports.validateVerificationCode = validateVerificationCode;
exports.isGoogleAuthConfigured = isGoogleAuthConfigured;
exports.getAuthProvidersStatus = getAuthProvidersStatus;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_CODE_REGEX = /^\d{6}$/;
function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function normalizeEmail(value) {
    return normalizeString(value).toLowerCase();
}
function normalizeVerificationCode(value) {
    return normalizeString(value).replace(/\s+/g, '');
}
function validateNome(value) {
    const nome = normalizeString(value);
    if (!nome)
        return 'Informe seu nome.';
    if (nome.length < 2)
        return 'O nome deve ter pelo menos 2 caracteres.';
    return null;
}
function validateEmail(value) {
    const email = normalizeEmail(value);
    if (!email)
        return 'Informe seu email.';
    if (!EMAIL_REGEX.test(email))
        return 'Informe um email válido.';
    return null;
}
function validatePassword(value, fieldLabel = 'senha') {
    const senha = typeof value === 'string' ? value : '';
    if (!senha.trim())
        return `Informe ${fieldLabel}.`;
    if (senha.trim().length < 6)
        return 'A senha deve ter pelo menos 6 caracteres.';
    return null;
}
function validateVerificationCode(value) {
    const codigo = normalizeVerificationCode(value);
    if (!codigo)
        return 'Informe o código de verificação.';
    if (!VERIFICATION_CODE_REGEX.test(codigo))
        return 'O código deve ter 6 dígitos.';
    return null;
}
function isGoogleAuthConfigured() {
    return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() &&
        process.env.GOOGLE_CLIENT_SECRET?.trim() &&
        process.env.GOOGLE_REDIRECT_URI?.trim());
}
function getAuthProvidersStatus() {
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
