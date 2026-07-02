'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

let channelSeq = 0;

interface LiveState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches data and keeps it fresh in real time: re-runs the fetcher whenever
 * any of the given tables change in Supabase (INSERT/UPDATE/DELETE), and
 * whenever `deps` change.
 */
export function useLive<T>(
  fetcher: () => Promise<T>,
  tables: string[],
  deps: unknown[] = [],
) {
  const [state, setState] = useState<LiveState<T>>({ data: null, loading: true, error: null });
  const fetcherRef = useRef<() => Promise<T>>(fetcher);

  // Keep the latest fetcher without re-subscribing (assigned in an effect, not during render)
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const depsKey = JSON.stringify(deps);
  const tablesKey = tables.join(',');

  // Reset to loading when the query inputs change
  const [prevDepsKey, setPrevDepsKey] = useState(depsKey);
  if (prevDepsKey !== depsKey) {
    setPrevDepsKey(depsKey);
    setState({ data: null, loading: true, error: null });
  }

  const refetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setState({ data: result, loading: false, error: null });
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Failed to load data' }));
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [depsKey, refetch]);

  useEffect(() => {
    if (!tablesKey) return;
    const channel = supabase.channel(`live-${tablesKey}-${++channelSeq}`);
    for (const table of tablesKey.split(',')) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => refetch(),
      );
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tablesKey, refetch]);

  return { data: state.data, loading: state.loading, error: state.error, refetch };
}
