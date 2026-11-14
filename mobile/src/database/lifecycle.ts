import { AuthUser } from '../types/auth';
import { rosterRepository } from './repositories/rosterRepository';
import { sessionRepository } from './repositories/sessionRepository';
import { mutationQueueRepository } from './repositories/mutationQueueRepository';
import { authService } from '../services/authService';

let activeUser: AuthUser | null = null;

export const databaseLifecycle = {
  /**
   * Sets the active authenticated user identity for local database operations
   */
  setActiveUser(user: AuthUser | null): void {
    activeUser = user;
  },

  /**
   * Retrieves currently active authenticated user identity
   */
  getActiveUser(): AuthUser | null {
    return activeUser;
  },

  /**
   * Clears the active identity
   */
  clearActiveUser(): void {
    activeUser = null;
  },

  /**
   * Invoked upon logout:
   * 1. Quarantines pending mutations for the actor to prevent inadvertent upload under a different identity.
   * 2. Clears active user so any subsequent query throws SessionRequiredError.
   */
  async onLogout(user?: AuthUser | null): Promise<void> {
    const targetUser = user || activeUser;
    if (targetUser?.id) {
      try {
        await mutationQueueRepository.quarantineMutationsForActor(targetUser.id, 'LOGGED_OUT');
      } catch {
        // Safe fallback if database is already closed
      }
    }
    this.clearActiveUser();
  },

  /**
   * Invoked when switching accounts:
   * 1. Safely quarantines pending mutations of previous user.
   * 2. Purges cached rosters and sessions if organization or user changed to eliminate cross-user bleed.
   * 3. Restores any previously quarantined mutations belonging to the new user.
   */
  async onAccountSwitched(
    previousUser: AuthUser | null,
    newUser: AuthUser | null
  ): Promise<void> {
    if (previousUser?.id) {
      try {
        await mutationQueueRepository.quarantineMutationsForActor(
          previousUser.id,
          'ACCOUNT_SWITCHED'
        );
      } catch {
        // Safe fallback
      }
    }

    const isDifferentIdentity =
      previousUser &&
      newUser &&
      (previousUser.organizationId !== newUser.organizationId || previousUser.id !== newUser.id);

    if (isDifferentIdentity) {
      await Promise.allSettled([
        rosterRepository.purgeAllRosters(),
        sessionRepository.purgeAllSessions(),
      ]);
    }

    if (newUser?.id) {
      try {
        await mutationQueueRepository.restoreQuarantinedMutationsForActor(newUser.id);
      } catch {
        // Safe fallback
      }
    }

    this.setActiveUser(newUser);
  },
};

// Automatically hook into authService session termination
authService.onSessionEnded(() => {
  databaseLifecycle.onLogout();
});
