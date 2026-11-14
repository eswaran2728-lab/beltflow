/**
 * Synchronization state UI contracts for future offline engine
 */

export type SyncStateStatus =
  | 'synced'
  | 'pending'
  | 'syncing'
  | 'failed'
  | 'unavailable';

export interface SyncState {
  status: SyncStateStatus;
  pendingCount?: number;
  lastSyncedAt?: Date | string | null;
  errorMessage?: string | null;
  isAvailable: boolean; // false in Phase 1 (offline queue not yet implemented)
}
