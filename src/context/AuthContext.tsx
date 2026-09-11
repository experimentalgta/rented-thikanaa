import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  currentUser: User;
  setRole: (role: UserRole) => void;
  switchUser: (role: UserRole) => void;
}

const DEMO_USERS: Record<UserRole, User> = {
  student: {
    id: 'user-stud-1',
    email: 'ankit.tiwari@allduniv.ac.in',
    full_name: 'Ankit Tiwari',
    role: 'student',
    avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
    phone_number: '+91 98394 55123',
    is_verified: true,
    created_at: '2026-08-01T00:00:00Z',
  },
  owner: {
    id: 'owner-101',
    email: 'pandey.nilayam@gmail.com',
    full_name: 'Pandey Nilayam Residency',
    role: 'owner',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    phone_number: '+91 94152 38472',
    is_verified: true,
    created_at: '2026-07-15T00:00:00Z',
  },
  admin: {
    id: 'admin-1',
    email: 'moderation@prayagliving.in',
    full_name: 'PrayagLiving Trust & Safety',
    role: 'admin',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
    phone_number: '+91 94500 00001',
    is_verified: true,
    created_at: '2026-06-01T00:00:00Z',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const savedRole = localStorage.getItem('prayag_living_active_role') as UserRole;
      if (savedRole && DEMO_USERS[savedRole]) {
        return DEMO_USERS[savedRole];
      }
    } catch (e) {}
    return DEMO_USERS.student;
  });

  const setRole = (role: UserRole) => {
    const user = DEMO_USERS[role];
    setCurrentUser(user);
    try {
      localStorage.setItem('prayag_living_active_role', role);
    } catch (e) {}
  };

  const switchUser = (role: UserRole) => {
    setRole(role);
  };

  return (
    <AuthContext.Provider value={{ currentUser, setRole, switchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
