/**
 * Indicadores públicos do Banco Central (SGS), com cache e data de atualização.
 * Apenas informativo: o app não recomenda investimentos.
 */
import type { KeyValueStorage } from '@/store/storage';

export interface IndicatorDef {
  id: 'selic' | 'cdi' | 'ipca12' | 'usd';
  /** Código da série no SGS. */
  code: number;
  label: string;
  unit: '% a.a.' | '% em 12 meses' | 'R$';
}

export const INDICATORS: readonly IndicatorDef[] = [
  { id: 'selic', code: 432, label: 'Selic (meta)', unit: '% a.a.' },
  { id: 'cdi', code: 4389, label: 'CDI', unit: '% a.a.' },
  { id: 'ipca12', code: 13522, label: 'IPCA', unit: '% em 12 meses' },
  { id: 'usd', code: 1, label: 'Dólar (venda)', unit: 'R$' },
];

export interface IndicatorValue {
  id: IndicatorDef['id'];
  value: number;
  /** Data de referência informada pelo BC (YYYY-MM-DD). */
  refDate: string;
}

export interface IndicatorsSnapshot {
  values: IndicatorValue[];
  fetchedAt: string;
}

export const CACHE_KEY = 'invest-level:indicators';
export const CACHE_TTL_MS = 12 * 3600_000;
const TIMEOUT_MS = 8000;

export function sgsUrl(code: number): string {
  return `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`;
}

/** Lê a resposta do SGS: `[{"data":"17/11/2026","valor":"15.00"}]`. */
export function parseSgs(json: unknown): { value: number; refDate: string } | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  const last = json[json.length - 1] as { data?: unknown; valor?: unknown };
  if (typeof last.data !== 'string' || typeof last.valor !== 'string') return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(last.data);
  const value = Number(last.valor.replace(',', '.'));
  if (!m || !Number.isFinite(value)) return null;
  return { value, refDate: `${m[3]}-${m[2]}-${m[1]}` };
}

export function formatIndicator(def: IndicatorDef, value: number): string {
  const n = value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: def.unit === 'R$' ? 4 : 2,
  });
  return def.unit === 'R$' ? `R$ ${n}` : `${n}%`;
}

type Fetch = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

async function fetchOne(fetchFn: Fetch, def: IndicatorDef): Promise<IndicatorValue | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(sgsUrl(def.code), { signal: ctrl.signal });
    if (!res.ok) return null;
    const parsed = parseSgs(await res.json());
    return parsed ? { id: def.id, ...parsed } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isSnapshot(v: unknown): v is IndicatorsSnapshot {
  const s = v as IndicatorsSnapshot;
  return !!s && typeof s.fetchedAt === 'string' && Array.isArray(s.values);
}

export async function readCache(storage: KeyValueStorage): Promise<IndicatorsSnapshot | null> {
  try {
    const raw = await storage.getItem(CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export interface LoadIndicatorsResult {
  snapshot: IndicatorsSnapshot | null;
  source: 'cache' | 'network' | 'stale-cache' | 'none';
}

/** Usa o cache se tiver menos de 12h; senão busca. Sem rede, devolve o cache antigo. */
export async function loadIndicators(
  storage: KeyValueStorage,
  fetchFn: Fetch,
  now: Date,
  force = false,
): Promise<LoadIndicatorsResult> {
  const cached = await readCache(storage);
  const fresh = cached && now.getTime() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS;
  if (cached && fresh && !force) return { snapshot: cached, source: 'cache' };

  const values = (await Promise.all(INDICATORS.map((d) => fetchOne(fetchFn, d)))).filter(
    (v): v is IndicatorValue => v !== null,
  );
  if (values.length === 0) return { snapshot: cached, source: cached ? 'stale-cache' : 'none' };
  const snapshot: IndicatorsSnapshot = { values, fetchedAt: now.toISOString() };
  try {
    await storage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    console.warn('[invest-level] falha ao guardar indicadores', e);
  }
  return { snapshot, source: 'network' };
}
