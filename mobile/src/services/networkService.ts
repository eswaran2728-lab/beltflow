import { apiClient } from './apiClient';
import { ConnectivityState, ConnectivityListener } from '../types/connectivity';

type ReconnectedListener = () => void | Promise<void>;

class NetworkService {
  private state: ConnectivityState = {
    status: 'online',
    isInternetReachable: true,
    isBackendReachable: true,
    lastCheckedAt: new Date(),
    error: null,
  };

  private listeners: Set<ConnectivityListener> = new Set();
  private reconnectedListeners: Set<ReconnectedListener> = new Set();

  public getState(): ConnectivityState {
    return { ...this.state };
  }

  public setState(updates: Partial<ConnectivityState>): void {
    const previousStatus = this.state.status;
    this.state = {
      ...this.state,
      ...updates,
      lastCheckedAt: new Date(),
    };

    // If transitioned from an outage state (offline / backend_unavailable) to online, trigger reconnection listeners
    if (
      (previousStatus === 'offline' || previousStatus === 'backend_unavailable' || previousStatus === 'recovering') &&
      this.state.status === 'online'
    ) {
      this.notifyReconnected();
    }

    this.notifyListeners();
  }

  public onConnectivityChange(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onReconnected(listener: ReconnectedListener): () => void {
    this.reconnectedListeners.add(listener);
    return () => {
      this.reconnectedListeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(currentState);
      } catch {
        // Prevent listener crashes from corrupting network service
      }
    }
  }

  private notifyReconnected(): void {
    for (const listener of this.reconnectedListeners) {
      try {
        void listener();
      } catch {
        // Ignore listener error
      }
    }
  }

  /**
   * Probes network connectivity and backend health.
   * Distinguishes generic internet reachability from BeltFlow backend API readiness.
   */
  public async checkConnectivity(options?: {
    internetCheck?: () => Promise<boolean>;
    backendTimeoutMs?: number;
  }): Promise<ConnectivityState> {
    const wasOutage = this.state.status === 'offline' || this.state.status === 'backend_unavailable';

    if (wasOutage) {
      this.setState({ status: 'recovering' });
    } else {
      this.setState({ status: 'checking' });
    }

    // Step 1: Probe internet connection
    let isInternetReachable = true;
    if (options?.internetCheck) {
      try {
        isInternetReachable = await options.internetCheck();
      } catch {
        isInternetReachable = false;
      }
    }

    if (!isInternetReachable) {
      this.setState({
        status: 'offline',
        isInternetReachable: false,
        isBackendReachable: false,
        error: 'No internet connection detected.',
      });
      return this.getState();
    }

    // Step 2: Probe BeltFlow Backend Liveness
    try {
      const health = await apiClient.get<{ status?: string }>('/api/health', {
        timeoutMs: options?.backendTimeoutMs || 3000,
        requiresAuth: false,
      });

      if (health && typeof health === 'object') {
        this.setState({
          status: 'online',
          isInternetReachable: true,
          isBackendReachable: true,
          error: null,
        });
        return this.getState();
      }

      this.setState({
        status: 'backend_unavailable',
        isInternetReachable: true,
        isBackendReachable: false,
        error: 'Backend health response invalid.',
      });
      return this.getState();
    } catch (err: any) {
      // If error is network error specifically when trying to connect to backend
      if (err?.isNetworkError && !options?.internetCheck) {
        // If internet check was not explicitly provided and fetch fails, could be offline
        this.setState({
          status: 'offline',
          isInternetReachable: false,
          isBackendReachable: false,
          error: 'Network connection failed.',
        });
        return this.getState();
      }

      // Internet was proven reachable, but backend is failing/503/timeout
      this.setState({
        status: 'backend_unavailable',
        isInternetReachable: true,
        isBackendReachable: false,
        error: err?.message || 'BeltFlow servers are unreachable.',
      });
      return this.getState();
    }
  }

  // Testing helpers
  public simulateOffline(): void {
    this.setState({
      status: 'offline',
      isInternetReachable: false,
      isBackendReachable: false,
      error: 'Device is offline.',
    });
  }

  public simulateBackendUnavailable(): void {
    this.setState({
      status: 'backend_unavailable',
      isInternetReachable: true,
      isBackendReachable: false,
      error: 'BeltFlow service unavailable.',
    });
  }

  public simulateOnline(): void {
    this.setState({
      status: 'online',
      isInternetReachable: true,
      isBackendReachable: true,
      error: null,
    });
  }

  public resetForTesting(): void {
    this.state = {
      status: 'online',
      isInternetReachable: true,
      isBackendReachable: true,
      lastCheckedAt: new Date(),
      error: null,
    };
    this.listeners.clear();
    this.reconnectedListeners.clear();
  }
}

export const networkService = new NetworkService();
