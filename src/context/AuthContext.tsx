import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { User, UserRole, PendingAction } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { serverAuth } from '../services/serverAuth';

interface AuthContextType {
  currentUser: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isLoginModalOpen: boolean;
  loginModalReason: string;
  pendingAction: PendingAction | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  requireAuth: (reason?: string, action?: PendingAction) => boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  setPendingAction: (action: PendingAction | null) => void;
  clearPendingAction: () => void;
  consumePendingAction: () => PendingAction | null;
  // Backwards compatibility helpers
  setRole: (role: UserRole) => void;
  switchUser: (role: UserRole) => void;
}

const PENDING_ACTION_KEY = 'rt_pending_action';

// Robust display name resolver adhering to specification
export function resolveUserDisplayName(
  profile?: { full_name?: string | null; name?: string | null } | null,
  authUser?: SupabaseAuthUser | null
): string {
  const profileName = profile?.full_name?.trim() || profile?.name?.trim();
  if (profileName) return profileName;

  const meta = authUser?.user_metadata || {};
  const metaName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    (typeof meta.display_name === 'string' && meta.display_name.trim());
  if (metaName) return metaName;

  if (authUser?.email) {
    const emailPrefix = authUser.email.split('@')[0]?.trim();
    if (emailPrefix) {
      return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    }
  }

  return 'User';
}

// Robust avatar resolver (returns undefined when no real avatar exists, avoiding mock fallbacks)
export function resolveUserAvatar(
  profile?: { avatar_url?: string | null } | null,
  authUser?: SupabaseAuthUser | null
): string | undefined {
  if (profile?.avatar_url && typeof profile.avatar_url === 'string' && profile.avatar_url.trim()) {
    return profile.avatar_url.trim();
  }
  const meta = authUser?.user_metadata || {};
  const metaAvatar = meta.avatar_url || meta.picture;
  if (metaAvatar && typeof metaAvatar === 'string' && metaAvatar.trim()) {
    return metaAvatar.trim();
  }
  return undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginModalReason, setLoginModalReason] = useState<string>('Sign in with Google to continue');
  const [pendingAction, setPendingActionState] = useState<PendingAction | null>(() => {
    try {
      const stored = sessionStorage.getItem(PENDING_ACTION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setPendingAction = useCallback((action: PendingAction | null) => {
    setPendingActionState(action);
    try {
      if (action) {
        sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(action));
      } else {
        sessionStorage.removeItem(PENDING_ACTION_KEY);
      }
    } catch {}
  }, []);

  const clearPendingAction = useCallback(() => {
    setPendingAction(null);
  }, [setPendingAction]);

  const consumePendingAction = useCallback((): PendingAction | null => {
    let action = pendingAction;
    if (!action) {
      try {
        const stored = sessionStorage.getItem(PENDING_ACTION_KEY);
        if (stored) action = JSON.parse(stored);
      } catch {}
    }
    clearPendingAction();
    return action;
  }, [pendingAction, clearPendingAction]);

  // Fetch or construct profile from Supabase
  const loadUserProfile = async (authUser: SupabaseAuthUser): Promise<User> => {
    let dbProfile: any = null;
    let adminStatus = false;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (data && !error) {
          dbProfile = data;
        }
      } catch (err) {
        console.error('Failed to load profile from database:', err);
      }

      try {
        adminStatus = await serverAuth.verifySuperAdminAuthorization(authUser.id);
        setIsSuperAdmin(adminStatus);
      } catch {}
    }

    // ── DEBUG: Print every value used in identity resolution ──
    console.group('[AuthContext] loadUserProfile DEBUG');
    console.log('authUser.id:', authUser.id);
    console.log('authUser.email:', authUser.email);
    console.log('authUser.user_metadata:', authUser.user_metadata);
    console.log('dbProfile (from public.profiles):', dbProfile);
    console.log('supabase configured:', !!supabase, 'isSupabaseConfigured:', isSupabaseConfigured);
    console.groupEnd();

    const resolvedName = resolveUserDisplayName(dbProfile, authUser);
    const resolvedAvatar = resolveUserAvatar(dbProfile, authUser);

    console.log('[AuthContext] Resolved name →', resolvedName, '| avatar →', resolvedAvatar);

    return {
      id: authUser.id,
      email: dbProfile?.email || authUser.email || '',
      full_name: resolvedName,
      account_type: dbProfile?.account_type || (adminStatus ? 'super_admin' : 'user'),
      role: adminStatus ? 'admin' : 'member',
      avatar_url: resolvedAvatar,
      phone_number: dbProfile?.phone_number,
      is_verified: Boolean(dbProfile?.is_verified),
      is_blocked: Boolean(dbProfile?.is_blocked),
      college: dbProfile?.college,
      occupation: dbProfile?.occupation,
      bio: dbProfile?.bio,
      preferred_areas: dbProfile?.preferred_areas,
      budget: dbProfile?.budget,
      created_at: dbProfile?.created_at || authUser.created_at || new Date().toISOString(),
    };
  };

  // Initial session setup & subscription to auth state changes
  useEffect(() => {
    let isMounted = true;

    if (!supabase || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // 1. Get initial session
    supabase.auth
      .getSession()
      .then(async ({ data: { session: initSession }, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error('Error fetching initial auth session:', error);
          setLoading(false);
          return;
        }

        if (initSession && initSession.user) {
          setSession(initSession);
          const profile = await loadUserProfile(initSession.user);
          if (isMounted) {
            setCurrentUser(profile);
          }
        } else {
          setSession(null);
          setCurrentUser(null);
          setIsSuperAdmin(false);
        }
        if (isMounted) setLoading(false);
      })
      .catch((err) => {
        console.error('Unexpected error on auth initialization:', err);
        if (isMounted) setLoading(false);
      });

    // 2. Real-time subscription to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);

      if (newSession && newSession.user) {
        const profile = await loadUserProfile(newSession.user);
        if (isMounted) {
          setCurrentUser(profile);
          setIsLoginModalOpen(false); // Close login modal automatically on successful sign-in
        }
      } else {
        if (isMounted) {
          setCurrentUser(null);
          setIsSuperAdmin(false);
        }
      }

      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!supabase) {
      throw new Error('Supabase client is not configured.');
    }

    const redirectTo = `${window.location.origin}/`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });

    if (error) throw error;
  };

  const signOut = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error('Error signing out of Supabase:', e);
      }
    }
    setSession(null);
    setCurrentUser(null);
    setIsSuperAdmin(false);
    clearPendingAction();
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...updates };
    setCurrentUser(updated);

    if (supabase && currentUser.id) {
      try {
        await supabase
          .from('profiles')
          .update({
            full_name: updated.full_name,
            phone_number: updated.phone_number,
            college: updated.college,
            occupation: updated.occupation,
            bio: updated.bio,
            preferred_areas: updated.preferred_areas,
            budget: updated.budget,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentUser.id);
      } catch (err) {
        console.error('Failed to persist profile updates to Supabase:', err);
      }
    }
  };

  const requireAuth = (reason?: string, action?: PendingAction): boolean => {
    if (currentUser && session) {
      return true;
    }
    setLoginModalReason(
      reason || 'Sign in with Google to view complete room/property details and chat with owners.'
    );
    if (action) {
      setPendingAction(action);
    }
    setIsLoginModalOpen(true);
    return false;
  };

  const setRole = (role: UserRole) => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, role });
    }
  };

  const switchUser = (role: UserRole) => {
    setRole(role);
  };

  const isAuthenticated = Boolean(currentUser && session);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        session,
        loading,
        isAuthenticated,
        isSuperAdmin,
        isLoginModalOpen,
        loginModalReason,
        pendingAction,
        signInWithGoogle,
        signOut,
        updateProfile,
        requireAuth,
        setIsLoginModalOpen,
        setPendingAction,
        clearPendingAction,
        consumePendingAction,
        setRole,
        switchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
