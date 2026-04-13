import { Platform } from 'react-native';

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

const defaultBaseUrl =
  'http://192.168.1.15:8001/api/v1';

export const API_BASE_URL = normalizeBaseUrl(envBaseUrl || defaultBaseUrl);

console.log('API_BASE_URL usada:', API_BASE_URL);