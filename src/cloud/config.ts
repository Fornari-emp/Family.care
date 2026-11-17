/**
 * Configuração do Supabase via variáveis públicas do Expo (`.env`).
 * Sem configuração, o app funciona 100% local (como antes da Fase 4).
 */
export interface CloudConfig {
  url: string;
  anonKey: string;
}

export function readCloudConfig(env: Record<string, string | undefined>): CloudConfig | null {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  if (!/^https:\/\/[^\s/]+/.test(url) || url.includes('SEU-PROJETO')) return null;
  return { url: url.replace(/\/+$/, ''), anonKey };
}

/** Config do app (o Expo substitui `process.env.EXPO_PUBLIC_*` no build). */
export const cloudConfig: CloudConfig | null = readCloudConfig({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});
