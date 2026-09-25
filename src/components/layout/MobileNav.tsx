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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5E7EB] block md:hidden safe-area-pb w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2 relative w-full">
        {/* 1. Home */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className={`flex flex-col items-center justify-center w-14 h-full transition-colors cursor-pointer ${
            currentView === 'home' ? 'text-[#101828] font-bold' : 'text-[#667085]'
          }`}
        >
          <Home className={`w-5 h-5 ${currentView === 'home' ? 'text-[#F59E0B]' : ''}`} />
          <span className="text-[10px] mt-1">Home</span>
        </button>

        {/* 2. Search */}
        <button
          type="button"
          onClick={() => onNavigate('search')}
          className={`flex flex-col items-center justify-center w-14 h-full transition-colors cursor-pointer ${
            currentView === 'search' ? 'text-[#101828] font-bold' : 'text-[#667085]'
          }`}
        >
          <Search className={`w-5 h-5 ${currentView === 'search' ? 'text-[#F59E0B]' : ''}`} />
          <span className="text-[10px] mt-1">Search</span>
        </button>

        {/* 3. Center Floating Action Button (FAB / List Room) */}
        <div className="flex flex-col items-center justify-center w-14 h-full relative">
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
            className={`-mt-5 w-13 h-13 rounded-full bg-[#F59E0B] hover:bg-[#D97706] active:scale-95 text-[#101828] flex items-center justify-center shadow-lg shadow-amber-500/25 border-4 border-white transition-all duration-200 cursor-pointer ${
              isListingActive ? 'ring-2 ring-[#101828] ring-offset-2' : ''
            }`}
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
          <span
            className={`text-[10px] mt-0.5 font-bold transition-colors ${
              isListingActive ? 'text-[#101828]' : 'text-[#475569]'
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
          className="relative flex flex-col items-center justify-center w-14 h-full text-[#667085] hover:text-[#101828] transition-colors cursor-pointer"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-3 w-2 h-2 bg-[#F97316] rounded-full ring-2 ring-white" />
          )}
          <span className="text-[10px] mt-1">Messages</span>
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
            isDashboard ? 'text-[#101828] font-bold' : 'text-[#667085]'
          }`}
        >
          <User className={`w-5 h-5 ${isDashboard ? 'text-[#F59E0B]' : ''}`} />
          <span className="text-[10px] mt-1">Dashboard</span>
        </button>
      </div>
    </nav>
  );
};
