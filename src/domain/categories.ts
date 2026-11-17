import type { CategoryId } from './types';

export interface Category {
  id: CategoryId;
  name: string;
  color: string;
}

/** 6 categorias do protótipo + Tesouro IPCA+, LCI/LCA, Previdência e Outros. */
export const CATEGORIES: readonly Category[] = [
  { id: 'tesouro-selic', name: 'Tesouro Selic', color: '#38E08C' },
  { id: 'tesouro-ipca', name: 'Tesouro IPCA+', color: '#7FE0B0' },
  { id: 'cdb', name: 'CDB', color: '#5BC8FF' },
  { id: 'lci-lca', name: 'LCI/LCA', color: '#8FD3FF' },
  { id: 'fii', name: 'Fundo Imobiliário', color: '#FFC53D' },
  { id: 'acoes', name: 'Ações', color: '#FF7A45' },
  { id: 'etf', name: 'ETF', color: '#B78BFF' },
  { id: 'cripto', name: 'Cripto', color: '#FF5F9E' },
  { id: 'previdencia', name: 'Previdência', color: '#F2A65A' },
  { id: 'outros', name: 'Outros', color: '#C2B29A' },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export function getCategory(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? (CATEGORIES[CATEGORIES.length - 1] as Category);
}

/** Nomes usados no protótipo → ids (para migração). */
export function categoryFromLegacyName(name: string): CategoryId {
  return CATEGORIES.find((c) => c.name === name)?.id ?? 'outros';
}
