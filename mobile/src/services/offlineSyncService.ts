import { AppState, AppStateStatus } from 'react-native';
import { apiClient } from './apiClient';
import { networkService } from './networkService';
import { mutationQueueRepository } from '../database/repositories/mutationQueueRepository';
import { conflictRepository } from '../database/repositories/conflictRepository';
import { AuthUser } from '../types/auth';
import { AttendanceMutation } from '../database/types';

export interface SyncEngineState {
  status: 'idle' | 'syncing' | 'success' | 'error' | 'conflict';
  pendingCount: number;
  conflictCount: number;
  lastSyncAt: Date | null;
  lastError: string | null;
}

export type SyncStateListener = (state: SyncEngineState) => void;

export interface SyncOptions {
  maxBatchSize?: number;
  silent?: boolean;
}

export interface SyncMutationPayload {
  mutationId: string;
  sessionId: string;
  studentId: string;
  status: string;
  clientTimestamp: string;
  baseVersion: number;
  sequenceNumber: number;
  correctionOfMutationId: string | null;
}

export interface ServerSyncResponse {
  message?: string;
  synced: string[];
  conflicts: {
    mutationId: string;
    code: string;
    reason: string;
    serverStatus?: string | null;
    serverTimestamp?: string | null;
  }[];
  errors: {
    mutationId: string;
    error: string;
  }[];
}

/**
 * Calculates exponential backoff with pseudo-random jitter.
 */
export function calculateBackoffWithJitter(
  retryCount: number,
  baseMs = 1000,
  maxMs = 30000
): number {
  const exp = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, retryCount)));
  const jitter = Math.random() * (exp * 0.2); // 20% jitter
  return Math.floor(exp + jitter);
}

class OfflineSyncService {
  private isSyncing = false;
  private currentUser: AuthUser | null = null;
  private state: SyncEngineState = {
    status: 'idle',
    pendingCount: 0,
    conflictCount: 0,
    lastSyncAt: null,
    lastError: null,
  };

  private listeners: Set<SyncStateListener> = new Set();
  private retryTimeout: any = null;
  private appStateSubscription: any = null;
  private networkUnsubscribe: (() => void) | null = null;

  constructor() {
    this.initListeners();
  }

  private initListeners(): void {
    // 1. Connection recovery auto-sync
    this.networkUnsubscribe = networkService.onReconnected(() => {
      if (this.currentUser && !this.isSyncing) {
        void this.syncNow(this.currentUser, { silent: true });
      }
    });

    // 2. Foreground reconnection auto-sync
    if (AppState && typeof AppState.addEventListener === 'function') {
      this.appStateSubscription = AppState.addEventListener(
        'change',
        (nextState: AppStateStatus) => {
          if (nextState === 'active' && this.currentUser && !this.isSyncing) {
            void this.syncNow(this.currentUser, { silent: true });
          }
        }
      );
    }
  }

  public setUser(user: AuthUser | null): void {
    if (this.currentUser?.id !== user?.id || this.currentUser?.organizationId !== user?.organizationId) {
      // Abort any pending retry timeouts
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }
    }
    this.currentUser = user;
    if (user) {
      void this.refreshCounts(user);
    } else {
      this.setState({
        status: 'idle',
        pendingCount: 0,
        conflictCount: 0,
        lastError: null,
      });
    }
  }

  public getState(): SyncEngineState {
    return { ...this.state };
  }

  public onSyncStateChange(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(updates: Partial<SyncEngineState>): void {
    this.state = {
      ...this.state,
      ...updates,
    };
    for (const listener of this.listeners) {
      try {
        listener(this.getState());
      } catch {
        // prevent crashes in subscriber
      }
    }
  }

  public async refreshCounts(user: AuthUser): Promise<{ pending: number; conflicts: number }> {
    try {
      const pendingMutations = await mutationQueueRepository.getPendingMutations(user);
      const conflictCount = await mutationQueueRepository.getConflictCount(user);
      this.setState({
        pendingCount: pendingMutations.length,
        conflictCount,
      });
      return { pending: pendingMutations.length, conflicts: conflictCount };
    } catch {
      return { pending: this.state.pendingCount, conflicts: this.state.conflictCount };
    }
  }

  /**
   * Main synchronization entry point.
   * Enforces single-worker lock, bounded batch processing, and server-authoritative reconciliation.
   */
  public async syncNow(
    user: AuthUser,
    options: SyncOptions = {}
  ): Promise<{ syncedCount: number; conflictCount: number; error: string | null }> {
    // 1. Guard against concurrent sync workers
    if (this.isSyncing) {
      return {
        syncedCount: 0,
        conflictCount: 0,
        error: 'Sync is already in progress.',
      };
    }

    // 2. Validate user identity & role
    if (!user || user.role !== 'MASTER') {
      return {
        syncedCount: 0,
        conflictCount: 0,
        error: 'Only authenticated Masters can synchronize attendance.',
      };
    }

    this.isSyncing = true;
    this.currentUser = user;
    this.setState({ status: 'syncing', lastError: null });

    const maxBatchSize = options.maxBatchSize || 25;
    let totalSynced = 0;
    let totalConflicts = 0;
    let syncError: string | null = null;

    try {
      // 3. Reset any orphaned IN_FLIGHT mutations from interrupted runs
      await mutationQueueRepository.resetInFlightMutations(user.id);

      // 4. Bounded Batch Loop
      let hasMore = true;

      while (hasMore) {
        // Check if user changed mid-loop
        if (this.currentUser?.id !== user.id) {
          throw new Error('Account switched during synchronization.');
        }

        const pendingList: AttendanceMutation[] = await mutationQueueRepository.getPendingMutations(user);
        this.setState({ pendingCount: pendingList.length });

        if (pendingList.length === 0) {
          hasMore = false;
          break;
        }

        // Bounded slice preserving sequential order
        const batch = pendingList.slice(0, maxBatchSize);

        // Mark items as IN_FLIGHT in local SQLite
        for (const item of batch) {
          await mutationQueueRepository.markMutationInFlight(user, item.id);
        }

        // Prepare server payload
        const payload: SyncMutationPayload[] = batch.map(m => ({
          mutationId: m.id,
          sessionId: m.session_id,
          studentId: m.student_id,
          status: m.status,
          clientTimestamp: m.client_timestamp,
          baseVersion: m.base_version,
          sequenceNumber: m.sequence_number,
          correctionOfMutationId: m.correction_of_mutation_id,
        }));

        let response: ServerSyncResponse;
        try {
          response = await apiClient.post<ServerSyncResponse>(
            '/api/v1/attendance/sync',
            { mutations: payload },
            { requiresAuth: true }
          );
        } catch (netErr: any) {
          // Revert IN_FLIGHT back to PENDING and record failure with retry count
          for (const item of batch) {
            await mutationQueueRepository.recordMutationFailure(
              user,
              item.id,
              netErr.message || 'Network sync request failed',
              true
            );
          }

          // Handle 403 authorization revoked
          if (netErr?.status === 403) {
            // Quarantine mutations rather than deleting them
            await mutationQueueRepository.quarantineMutationsForActor(user.id, 'AUTH_REVOKED');
            syncError = 'Master authorization has been revoked on server.';
          } else {
            syncError = netErr?.message || 'Network sync failed.';
          }

          throw new Error(syncError || 'Network sync failed.');
        }

        // 5. Process Acknowledged Successful Mutations
        if (response && Array.isArray(response.synced)) {
          for (const syncedId of response.synced) {
            await mutationQueueRepository.markMutationSynced(user, syncedId);
            totalSynced++;
          }
        }

        // 6. Process Server Conflicts
        if (response && Array.isArray(response.conflicts)) {
          for (const conf of response.conflicts) {
            const matchingMutation = batch.find(m => m.id === conf.mutationId);
            if (matchingMutation) {
              await conflictRepository.recordConflict(user, {
                mutationId: conf.mutationId,
                sessionId: matchingMutation.session_id,
                studentId: matchingMutation.student_id,
                localStatus: matchingMutation.status,
                serverStatus: conf.serverStatus || 'Unknown',
                serverTimestamp: conf.serverTimestamp || new Date().toISOString(),
                conflictReason: conf.reason || conf.code,
              });

              await mutationQueueRepository.markMutationConflict(
                user,
                conf.mutationId,
                conf.reason || conf.code
              );
              totalConflicts++;
            }
          }
        }

        // If batch was smaller than maxBatchSize, we've exhausted current queue
        if (batch.length < maxBatchSize) {
          hasMore = false;
        }
      }

      const counts = await this.refreshCounts(user);
      const finalStatus =
        counts.conflicts > 0
          ? 'conflict'
          : counts.pending > 0
          ? 'idle'
          : 'success';

      this.setState({
        status: finalStatus,
        lastSyncAt: new Date(),
        lastError: null,
      });

      return {
        syncedCount: totalSynced,
        conflictCount: totalConflicts,
        error: null,
      };
    } catch (err: any) {
      syncError = err?.message || 'Sync failed.';
      const counts = await this.refreshCounts(user);
      this.setState({
        status: counts.conflicts > 0 ? 'conflict' : 'error',
        lastError: syncError,
      });

      return {
        syncedCount: totalSynced,
        conflictCount: totalConflicts,
        error: syncError,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  public resetForTesting(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.isSyncing = false;
    this.currentUser = null;
    this.state = {
      status: 'idle',
      pendingCount: 0,
      conflictCount: 0,
      lastSyncAt: null,
      lastError: null,
    };
    this.listeners.clear();
    this.destroy();
    this.initListeners();
  }

  public destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    if (this.appStateSubscription && typeof this.appStateSubscription.remove === 'function') {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export const offlineSyncService = new OfflineSyncService();
