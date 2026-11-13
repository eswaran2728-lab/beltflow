import { apiClient } from './apiClient';

/**
 * H27: which optional release modules are enabled
 * (GET /api/v1/release/modules, public). When signed in, the request carries
 * the sign-in token, so the server answers for the user's own Persatuan
 * (per-tenant rollout). Signed out, it is the platform list.
 */
export interface ReleaseModulesInfo {
  release: 'R1' | 'R2' | 'R3' | 'R4';
  enabledModules: string[];
}

export const releaseService = {
  /** Returns null when the server cannot be reached; callers then keep their defaults. */
  async getReleaseModules(): Promise<ReleaseModulesInfo | null> {
    try {
      const info = await apiClient.get<ReleaseModulesInfo>('/release/modules');
      return info && Array.isArray(info.enabledModules) ? info : null;
    } catch {
      return null;
    }
  },
};
