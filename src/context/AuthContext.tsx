import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, AccountType } from '../types';
import { serverAuth } from '../services/serverAuth';

interface AuthContextType {
  currentUser: User;
  isSuperAdmin: boolean;
  updateProfile: (updates: Partial<User>) => void;
  setRole: (role: UserRole) => void; // Maintained for backwards compatibility
  switchUser: (role: UserRole) => void;
}

const DEFAULT_MEMBER: User = {
  id: 'user-member-1',
  email: 'ankit.tiwari@allduniv.ac.in',
  full_name: 'Ankit Tiwari',
  account_type: 'user',
  role: 'member',
  avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
  phone_number: '+91 98394 55123',
  is_verified: true,
  college: 'Allahabad University (AU)',
  occupation: 'Student / Civil Services Aspirant',
  bio: 'Preparing for UPSC & State PCS in Katra. Looking for quiet study accommodations and offering a spare room in our 2BHK accommodation.',
  preferred_areas: ['Katra', 'Mumfordganj', 'Civil Lines'],
  budget: 5500,
  created_at: '2026-08-01T00:00:00Z',
};

const SUPER_ADMIN_ACCOUNT: User = {
  id: 'admin-1', // Verified by serverAuth in SERVER_SUPER_ADMIN_IDS
  email: 'moderation@rentedthikan.in',
  full_name: 'Rented Thikan Trust & Safety',
  account_type: 'super_admin',
  role: 'admin',
  avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
  phone_number: '+91 94500 00001',
  is_verified: true,
  created_at: '2026-06-01T00:00:00Z',
};

const USER_STORAGE_KEY = 'prayag_living_current_user_v2';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id) return parsed;
      }
    } catch (e) {}
    return DEFAULT_MEMBER;
  });

  // Server-side authorization authority determines Super Admin UX display
  const isSuperAdmin = serverAuth.isSuperAdmin(currentUser.id);

  const updateProfile = (updates: Partial<User>) => {
    setCurrentUser((prev) => {
      const updated = { ...prev, ...updates };
      try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Backwards compatibility helper
  const setRole = (role: UserRole) => {
    if (role === 'admin') {
      setCurrentUser(SUPER_ADMIN_ACCOUNT);
      try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(SUPER_ADMIN_ACCOUNT));
      } catch (e) {}
    } else {
      setCurrentUser(DEFAULT_MEMBER);
      try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(DEFAULT_MEMBER));
      } catch (e) {}
    }
  };

  const switchUser = (role: UserRole) => {
    setRole(role);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isSuperAdmin,
        updateProfile,
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
