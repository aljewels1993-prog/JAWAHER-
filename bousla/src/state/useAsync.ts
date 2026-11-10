import { useCallback, useEffect, useRef, useState } from 'react';

/** Loads data with loading / error state and a reload function. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): {
  data: T | undefined; error: unknown; loading: boolean; reload: () => Promise<void>; setData: (v: T) => void;
} {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const v = await run();
      if (id === seq.current) { setData(v); setError(null); }
    } catch (e) {
      if (id === seq.current) setError(e);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [run]);

  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}
