import { useEffect, useState } from 'react';
import { releaseService } from '../services/releaseService';

/**
 * H27: hides optional modules that the server's release setting turns off.
 * Until the server answers (or if it cannot be reached) every module is
 * treated as enabled; the server still blocks disabled modules itself, so
 * this only keeps unavailable features out of the way.
 */
export function useReleaseModules(): { isEnabled: (key: string) => boolean; loaded: boolean } {
  const [enabled, setEnabled] = useState<Set<string> | null>(null);

  useEffect(() => {
    let active = true;
    releaseService.getReleaseModules().then(info => {
      if (active && info) setEnabled(new Set(info.enabledModules));
    });
    return () => {
      active = false;
    };
  }, []);

  return {
    loaded: enabled !== null,
    isEnabled: (key: string) => (enabled ? enabled.has(key) : true),
  };
}
