import { useState, useEffect, useCallback } from 'react';
import { networkService } from '../services/networkService';
import { ConnectivityState } from '../types/connectivity';

export function useConnectivity() {
  const [connectivity, setConnectivity] = useState<ConnectivityState>(() => networkService.getState());

  useEffect(() => {
    const unsubscribe = networkService.onConnectivityChange(state => {
      setConnectivity(state);
    });
    return unsubscribe;
  }, []);

  const checkNow = useCallback(async () => {
    return await networkService.checkConnectivity();
  }, []);

  return {
    connectivity,
    status: connectivity.status,
    isOnline: connectivity.status === 'online',
    isOffline: connectivity.status === 'offline',
    isBackendUnavailable: connectivity.status === 'backend_unavailable',
    isChecking: connectivity.status === 'checking',
    isRecovering: connectivity.status === 'recovering',
    checkNow,
  };
}
