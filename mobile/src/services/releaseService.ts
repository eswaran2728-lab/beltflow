import { apiClient } from './apiClient';

/**
 * H27: which optional release modules this server enables
 * (GET /api/v1/release/modules, public and tenant-free).
 */
export interface ReleaseModulesInfo {
  release: 'R1' | 'R2' | 'R3' | 'R4';
  enabledModules: string[];
}

export const releaseService = {
  /** Returns null when the server cannot be reached; callers then keep their defaults. */
  async getReleaseModules(): Promise<ReleaseModulesInfo | null> {
    try {
      const info = await apiClient.get<ReleaseModulesInfo>('/release/modules', { requiresAuth: false });
      return info && Array.isArray(info.enabledModules) ? info : null;
    } catch {
      return null;
    }
  },
};
