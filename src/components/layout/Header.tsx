import React from 'react';
import {
  Home,
  Users,
  Heart,
  MessageSquare,
  PlusCircle,
  ShieldCheck,
  Building2,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSaved } from '../../context/SavedContext';
import { useChat } from '../../context/ChatContext';
import { UserRole } from '../../types';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string, param?: any) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate }) => {
  const { currentUser, setRole } = useAuth();
  const { savedCount } = useSaved();
  const { unreadCount, setIsChatModalOpen } = useChat();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Brand Logo */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2.5 text-left focus:outline-none group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#101828] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <span className="text-xl font-black text-[#F59E0B] font-heading">P</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold text-[#101828] font-heading tracking-tight">
                    PrayagLiving
                  </span>
                  <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">
                    Prayagraj
                  </span>
                </div>
                <p className="text-[11px] text-[#667085] hidden md:block">
                  Student Housing &amp; Roommates
                </p>
              </div>
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 ml-4">
              <button
                onClick={() => onNavigate('search')}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                  currentView === 'search'
                    ? 'text-[#101828] bg-[#F1F5F9]'
                    : 'text-[#667085] hover:text-[#101828] hover:bg-[#F8FAFC]'
                }`}
              >
                Browse Rooms
              </button>
              <button
                onClick={() => onNavigate('roommates')}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                  currentView === 'roommates'
                    ? 'text-[#101828] bg-[#F1F5F9]'
                    : 'text-[#667085] hover:text-[#101828] hover:bg-[#F8FAFC]'
                }`}
              >
                Find Roommates
              </button>
              <button
                onClick={() => onNavigate('home', 'areas')}
                className="px-3.5 py-2 rounded-xl text-sm font-medium text-[#667085] hover:text-[#101828] hover:bg-[#F8FAFC] transition-colors"
              >
                Student Localities
              </button>
            </nav>
          </div>

          {/* Right Action Elements & Role Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Role Simulation Switcher for Testing */}
            <div className="hidden sm:flex items-center bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0] text-xs font-medium">
              <button
                onClick={() => setRole('student')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  currentUser.role === 'student'
                    ? 'bg-white text-[#101828] font-semibold shadow-xs'
                    : 'text-[#667085] hover:text-[#101828]'
                }`}
                title="Switch to Student Mode"
              >
                <GraduationCap className="w-3.5 h-3.5 text-[#F59E0B]" />
                Student
              </button>
              <button
                onClick={() => setRole('owner')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  currentUser.role === 'owner'
                    ? 'bg-white text-[#101828] font-semibold shadow-xs'
                    : 'text-[#667085] hover:text-[#101828]'
                }`}
                title="Switch to Owner Mode"
              >
                <Building2 className="w-3.5 h-3.5 text-[#101828]" />
                Owner
              </button>
              <button
                onClick={() => setRole('admin')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  currentUser.role === 'admin'
                    ? 'bg-white text-[#101828] font-semibold shadow-xs'
                    : 'text-[#667085] hover:text-[#101828]'
                }`}
                title="Switch to Admin Moderation"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#667085]" />
                Admin
              </button>
            </div>

            {/* Saved Rooms Button (Student) */}
            {currentUser.role === 'student' && (
              <button
                onClick={() => onNavigate('student-dashboard', 'saved')}
                className="relative p-2.5 text-[#667085] hover:text-[#101828] hover:bg-[#F8FAFC] rounded-xl transition-colors"
                title="Saved Properties"
              >
                <Heart className="w-5 h-5" />
                {savedCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#F59E0B] text-[#101828] font-bold text-[10px] rounded-full flex items-center justify-center shadow-xs">
                    {savedCount}
                  </span>
                )}
              </button>
            )}

            {/* In-App Messaging Button */}
            <button
              onClick={() => setIsChatModalOpen(true)}
              className="relative p-2.5 text-[#667085] hover:text-[#101828] hover:bg-[#F8FAFC] rounded-xl transition-colors"
              title="In-App Messages"
            >
              <MessageSquare className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F97316] rounded-full ring-2 ring-white" />
              )}
            </button>

            {/* Role-Specific Primary CTA */}
            {currentUser.role === 'student' && (
              <button
                onClick={() => onNavigate('owner-add')}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#101828] text-white hover:bg-[#1E293B] shadow-xs transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4 text-[#F59E0B]" />
                List Property
              </button>
            )}

            {currentUser.role === 'owner' && (
              <button
                onClick={() => onNavigate('owner-add')}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#F59E0B] text-[#101828] hover:bg-[#D97706] shadow-xs transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                + Add Property
              </button>
            )}

            {currentUser.role === 'admin' && (
              <button
                onClick={() => onNavigate('admin-panel')}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#101828] text-white hover:bg-[#1E293B] shadow-xs transition-all"
              >
                <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
                Moderation Panel
              </button>
            )}

            {/* User Profile Avatar / Dashboard Link */}
            <button
              onClick={() => {
                if (currentUser.role === 'owner') onNavigate('owner-dashboard');
                else if (currentUser.role === 'admin') onNavigate('admin-panel');
                else onNavigate('student-dashboard');
              }}
              className="flex items-center gap-2 p-1.5 pl-2 rounded-xl hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0] transition-all"
            >
              <img
                src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                alt={currentUser.full_name}
                className="w-8 h-8 rounded-lg object-cover ring-1 ring-[#E2E8F0]"
              />
              <span className="text-xs font-semibold text-[#111827] hidden md:inline">
                {currentUser.full_name.split(' ')[0]}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
