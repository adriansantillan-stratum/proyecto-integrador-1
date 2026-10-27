import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { errorMessage } from '../utils/operation';

/** A failed source never clears a different source or displays old filter results. */
export function useQuery<T>(url: string | null, scope = '') {
  const [revision, setRevision] = useState(0);
  const key = `${url}:${scope}`;
  const [result, setResult] = useState<{ key: string; revision: number; data?: T; error?: string }>({ key: '', revision: -1 });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    api.get<T>(url, { signal: controller.signal }).then(
      response => { if (!controller.signal.aborted) setResult({ key, revision, data: response.data }); },
      error => { if (!controller.signal.aborted) setResult({ key, revision, error: errorMessage(error) }); },
    );
    return () => controller.abort();
  }, [url, key, revision]);
  return {
    data: result.key === key ? result.data : undefined,
    error: result.key === key ? result.error : undefined,
    loading: !!url && (result.key !== key || result.revision !== revision),
    reload: useCallback(() => setRevision(value => value + 1), []),
  };
}
