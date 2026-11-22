import { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';

/**
 * The signed-in person's own Persatuan name, for headers. The server returns
 * an organisation only to its own members. Names are cached for the app
 * session; while loading (or offline) the caller shows a neutral fallback.
 */
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

function load(orgId: string): Promise<string | null> {
  const existing = pending.get(orgId);
  if (existing) return existing;
  const p = apiClient
    .get<{ organization?: { name?: string } }>(`/api/v1/organizations/${encodeURIComponent(orgId)}`)
    .then(res => {
      const name = res?.organization?.name?.trim();
      if (name) cache.set(orgId, name);
      return name || null;
    })
    .catch(() => null)
    .finally(() => pending.delete(orgId));
  pending.set(orgId, p);
  return p;
}

export function useOrganizationName(orgId?: string | null): string | null {
  const [name, setName] = useState<string | null>(orgId ? cache.get(orgId) ?? null : null);
  useEffect(() => {
    if (!orgId) return;
    let active = true;
    const known = cache.get(orgId);
    if (known) {
      Promise.resolve().then(() => active && setName(known));
      return () => { active = false; };
    }
    load(orgId).then(n => {
      if (active && n) setName(n);
    });
    return () => {
      active = false;
    };
  }, [orgId]);
  return name;
}
