import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseDashboardDataOptions<T> {
  fetcher: () => Promise<T>;
  isOffline?: boolean;
  enabled?: boolean;
}

export interface UseDashboardDataResult<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useDashboardData<T>({
  fetcher,
  enabled = true,
}: UseDashboardDataOptions<T>): UseDashboardDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    if (!enabled) {
      return;
    }

    const runFetch = async () => {
      try {
        const result = await fetcher();
        if (!isCancelled) {
          setData(result);
          setError(null);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void runFetch();

    return () => {
      isCancelled = true;
    };
  }, [enabled, fetcher]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetcher]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [fetcher]);

  return {
    data,
    loading,
    refreshing,
    error,
    reload,
    refresh,
  };
}
