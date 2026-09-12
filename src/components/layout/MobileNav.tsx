import React from 'react';
import {
  Home,
  Search,
  Heart,
  MessageSquare,
  User,
} from 'lucide-react';
import { useSaved } from '../../context/SavedContext';
import { useChat } from '../../context/ChatContext';

interface MobileNavProps {
  currentView: string;
  onNavigate: (view: string, param?: any) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentView, onNavigate }) => {
  const { savedCount } = useSaved();
  const { unreadCount, setIsChatModalOpen } = useChat();

  const isDashboard = currentView === 'member-dashboard' || currentView === 'student-dashboard' || currentView === 'owner-dashboard';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5E7EB] lg:hidden safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {/* 1. Home */}
        <button
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
          onClick={() => onNavigate('search')}
          className={`flex flex-col items-center justify-center w-14 h-full transition-colors cursor-pointer ${
            currentView === 'search' ? 'text-[#101828] font-bold' : 'text-[#667085]'
          }`}
        >
          <Search className={`w-5 h-5 ${currentView === 'search' ? 'text-[#F59E0B]' : ''}`} />
          <span className="text-[10px] mt-1">Search</span>
        </button>

        {/* 3. Saved */}
        <button
          onClick={() => onNavigate('member-dashboard', 'saved')}
          className={`relative flex flex-col items-center justify-center w-14 h-full transition-colors cursor-pointer ${
            isDashboard ? 'text-[#101828] font-bold' : 'text-[#667085]'
          }`}
        >
          <Heart className="w-5 h-5" />
          {savedCount > 0 && (
            <span className="absolute top-2 right-3 w-4 h-4 bg-[#F59E0B] text-[#101828] font-bold text-[9px] rounded-full flex items-center justify-center">
              {savedCount}
            </span>
          )}
          <span className="text-[10px] mt-1">Saved</span>
        </button>

        {/* 4. Messages */}
        <button
          onClick={() => setIsChatModalOpen(true)}
          className="relative flex flex-col items-center justify-center w-14 h-full text-[#667085] cursor-pointer"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-3 w-2 h-2 bg-[#F97316] rounded-full ring-2 ring-white" />
          )}
          <span className="text-[10px] mt-1">Messages</span>
        </button>

        {/* 5. Profile / Dashboard */}
        <button
          onClick={() => onNavigate('member-dashboard')}
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
