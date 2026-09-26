import React from 'react';
import {
  Home,
  Search,
  Plus,
  MessageSquare,
  User,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';

interface MobileNavProps {
  currentView: string;
  onNavigate: (view: string, param?: any) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentView, onNavigate }) => {
  const { unreadCount, setIsChatModalOpen } = useChat();
  const { requireAuth } = useAuth();

  const isDashboard =
    currentView === 'member-dashboard' ||
    currentView === 'student-dashboard' ||
    currentView === 'owner-dashboard' ||
    currentView === 'user-dashboard';

  const isListingActive =
    currentView === 'add-property' ||
    currentView === 'owner-add' ||
    currentView === 'list-room';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 block md:hidden pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 w-full max-w-full">
      <div className="flex items-center justify-around h-14 max-w-md mx-auto px-2 relative w-full">
        {/* 1. Home */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className={`flex flex-col items-center justify-center w-14 h-full transition-colors cursor-pointer ${
            currentView === 'home' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Home className={`w-5 h-5 ${currentView === 'home' ? 'text-[#F59E0B]' : ''}`} />
          <span className="text-[10px] mt-0.5">Home</span>
        </button>

        {/* 2. Search */}
        <button
          type="button"
          onClick={() => onNavigate('search')}
          className={`flex flex-col items-center justify-center w-14 h-full transition-colors cursor-pointer ${
            currentView === 'search' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Search className={`w-5 h-5 ${currentView === 'search' ? 'text-[#F59E0B]' : ''}`} />
          <span className="text-[10px] mt-0.5">Search</span>
        </button>

        {/* 3. Center Floating Action Button (FAB / List Room) */}
        <div className="flex flex-col items-center justify-center w-14 relative -top-4">
          <button
            type="button"
            onClick={() => {
              if (
                requireAuth('Sign in with Google to create and publish your room or PG listing.', {
                  type: 'add-property',
                })
              ) {
                onNavigate('add-property');
              }
            }}
            aria-label="List a Room"
            title="List a Room"
            className={`w-12 h-12 rounded-full bg-[#F59E0B] hover:bg-[#D97706] active:scale-95 text-[#101828] flex items-center justify-center shadow-lg shadow-amber-500/30 border-4 border-slate-900 transition-all duration-200 cursor-pointer ${
              isListingActive ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''
            }`}
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
          <span
            className={`text-[10px] mt-0.5 font-bold transition-colors ${
              isListingActive ? 'text-amber-400' : 'text-slate-300'
            }`}
          >
            List
          </span>
        </div>

        {/* 4. Messages */}
        <button
          type="button"
          onClick={() => {
            if (
              requireAuth('Sign in with Google to access your in-app messages and conversations.', {
                type: 'chat',
              })
            ) {
              setIsChatModalOpen(true);
            }
          }}
          className="relative flex flex-col items-center justify-center w-14 h-full text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-3 w-2 h-2 bg-[#F97316] rounded-full ring-2 ring-slate-900" />
          )}
          <span className="text-[10px] mt-0.5">Messages</span>
        </button>

        {/* 5. Profile / Dashboard */}
        <button
          type="button"
          onClick={() => {
            if (
              requireAuth('Sign in with Google to view your profile and student dashboard.', {
                type: 'dashboard',
              })
            ) {
              onNavigate('member-dashboard');
            }
          }}
          className={`flex flex-col items-center justify-center w-14 h-full transition-colors cursor-pointer ${
            isDashboard ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className={`w-5 h-5 ${isDashboard ? 'text-[#F59E0B]' : ''}`} />
          <span className="text-[10px] mt-0.5">Dashboard</span>
        </button>
      </div>
    </nav>
  );
};
