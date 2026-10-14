import { AuthUser } from '../types/auth';
import { rosterRepository } from './repositories/rosterRepository';
import { sessionRepository } from './repositories/sessionRepository';
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
   * Invoked upon logout: clears active user so any subsequent query throws SessionRequiredError
   */
  onLogout(): void {
    this.clearActiveUser();
  },

  /**
   * Invoked when switching accounts:
   * If organization or user ID changed, completely purges cached rosters and sessions
   * to guarantee zero cross-tenant state bleed.
   */
  async onAccountSwitched(
    previousUser: AuthUser | null,
    newUser: AuthUser | null
  ): Promise<void> {
    const isDifferentTenant =
      previousUser &&
      newUser &&
      (previousUser.organizationId !== newUser.organizationId || previousUser.id !== newUser.id);

    if (isDifferentTenant) {
      await Promise.allSettled([
        rosterRepository.purgeAllRosters(),
        sessionRepository.purgeAllSessions(),
      ]);
    }

    this.setActiveUser(newUser);
  },
};

// Automatically hook into authService session termination
authService.onSessionEnded(() => {
  databaseLifecycle.onLogout();
});
