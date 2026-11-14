/**
 * Connectivity state types for BeltFlow mobile client
 */

export type ConnectivityStatus =
  | 'online'
  | 'offline'
  | 'checking'
  | 'backend_unavailable'
  | 'recovering';

export interface ConnectivityState {
  status: ConnectivityStatus;
  isInternetReachable: boolean;
  isBackendReachable: boolean;
  lastCheckedAt: Date | null;
  error?: string | null;
}

export type ConnectivityListener = (state: ConnectivityState) => void;
