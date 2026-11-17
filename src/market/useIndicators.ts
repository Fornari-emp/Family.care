import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { loadIndicators, type LoadIndicatorsResult } from './sgs';

const fetchIndicators = (force: boolean) => loadIndicators(AsyncStorage, fetch, new Date(), force);

/** Indicadores com cache de 12h; `refresh` força nova busca. */
export function useIndicators() {
  const [result, setResult] = useState<LoadIndicatorsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchIndicators(false)
      .then((r) => alive && setResult(r))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchIndicators(true)
      .then(setResult)
      .finally(() => setLoading(false));
  }, []);

  return { result, loading, refresh };
}
