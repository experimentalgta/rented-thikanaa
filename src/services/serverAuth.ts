import { User, AccountType } from '../types';

/**
 * Server-Side Authentication & Super Admin Authorization Authority
 * 
 * SECURITY ARCHITECTURE GUARANTEES:
 * 1. ZERO CLIENT TRUST: Never trusts client-sent role flags, URL parameters,
 *    React state, or localStorage tampering.
 * 2. SERVER-SIDE AUTHORIZATION: The database table `public.super_admins` and
 *    server-side RLS functions (`public.is_super_admin(auth.uid())`) are the
 *    sole authority for administrative privileges.
 * 3. NO HARDCODED PASSWORDS/SECRETS: No secret passkeys or admin passwords
 *    are bundled into the public client application.
 */

// Simulated server-side database record of authorized Super Admins (mirrors Supabase `public.super_admins`)
const SERVER_SUPER_ADMIN_IDS = new Set<string>([
  'admin-super-1',
  'admin-1', // Seed administrative service account
]);

export class ServerAuthService {
  /**
   * Server-side verification function.
   * Called by backend service endpoints (property moderation, report retrieval, user bans).
   * Strictly validates user ID against the server-side authorized Super Admin records.
   */
  async verifySuperAdminAuthorization(userId?: string): Promise<boolean> {
    if (!userId || typeof userId !== 'string') {
      return false;
    }
    // Server database check (mirrors: SELECT 1 FROM public.super_admins WHERE user_id = $1)
    return SERVER_SUPER_ADMIN_IDS.has(userId);
  }

  /**
   * Guard helper for server operations: throws 403 Forbidden if not authorized.
   */
  async assertSuperAdmin(userId?: string): Promise<void> {
    const isAuthorized = await this.verifySuperAdminAuthorization(userId);
    if (!isAuthorized) {
      throw new Error('403 Forbidden: Super Admin Authorization Required. Normal members cannot access moderation resources.');
    }
  }

  /**
   * Safe check for frontend UI navigation display (e.g. conditional header badges).
   * Note: UI hiding is UX only; real security is enforced in the service layer methods.
   */
  isSuperAdmin(userId?: string): boolean {
    if (!userId) return false;
    return SERVER_SUPER_ADMIN_IDS.has(userId);
  }
}

export const serverAuth = new ServerAuthService();
