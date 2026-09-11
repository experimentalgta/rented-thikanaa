import React from 'react';
import {
  Home,
  Search,
  Heart,
  MessageSquare,
  User,
  LayoutDashboard,
  Building2,
  PlusCircle,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSaved } from '../../context/SavedContext';
import { useChat } from '../../context/ChatContext';

interface MobileNavProps {
  currentView: string;
  onNavigate: (view: string, param?: any) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentView, onNavigate }) => {
  const { currentUser } = useAuth();
  const { savedCount } = useSaved();
  const { unreadCount, setIsChatModalOpen } = useChat();

  if (currentUser.role === 'owner') {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5E7EB] lg:hidden safe-area-pb">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
          {/* Dashboard */}
          <button
            onClick={() => onNavigate('owner-dashboard')}
            className={`flex flex-col items-center justify-center w-14 h-full transition-colors ${
              currentView === 'owner-dashboard' ? 'text-[#F59E0B]' : 'text-[#667085]'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">Dashboard</span>
          </button>

          {/* Listings */}
          <button
            onClick={() => onNavigate('search')}
            className={`flex flex-col items-center justify-center w-14 h-full transition-colors ${
              currentView === 'search' ? 'text-[#F59E0B]' : 'text-[#667085]'
            }`}
          >
            <Building2 className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">Listings</span>
          </button>

          {/* Add Property (Prominent Center Button) */}
          <button
            onClick={() => onNavigate('owner-add')}
            className="flex flex-col items-center justify-center -mt-5"
          >
            <div className="w-12 h-12 rounded-full bg-[#101828] text-[#F59E0B] flex items-center justify-center shadow-lg border-2 border-white hover:scale-105 transition-transform">
              <PlusCircle className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-semibold text-[#101828] mt-1">Add</span>
          </button>

          {/* Messages */}
          <button
            onClick={() => setIsChatModalOpen(true)}
            className="relative flex flex-col items-center justify-center w-14 h-full text-[#667085]"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-3 w-2 h-2 bg-[#F97316] rounded-full" />
            )}
            <span className="text-[10px] font-medium mt-1">Messages</span>
          </button>

          {/* Profile */}
          <button
            onClick={() => onNavigate('owner-dashboard')}
            className="flex flex-col items-center justify-center w-14 h-full text-[#667085]"
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">Profile</span>
          </button>
        </div>
      </nav>
    );
  }

  // Student / Default Bottom Nav
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5E7EB] lg:hidden safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {/* Home */}
        <button
          onClick={() => onNavigate('home')}
          className={`flex flex-col items-center justify-center w-14 h-full transition-colors ${
            currentView === 'home' ? 'text-[#101828] font-bold' : 'text-[#667085]'
          }`}
        >
          <Home className={`w-5 h-5 ${currentView === 'home' ? 'text-[#F59E0B]' : ''}`} />
          <span className="text-[10px] mt-1">Home</span>
        </button>

        {/* Search */}
        <button
          onClick={() => onNavigate('search')}
          className={`flex flex-col items-center justify-center w-14 h-full transition-colors ${
            currentView === 'search' ? 'text-[#101828] font-bold' : 'text-[#667085]'
          }`}
        >
          <Search className={`w-5 h-5 ${currentView === 'search' ? 'text-[#F59E0B]' : ''}`} />
          <span className="text-[10px] mt-1">Search</span>
        </button>

        {/* Saved */}
        <button
          onClick={() => onNavigate('student-dashboard', 'saved')}
          className={`relative flex flex-col items-center justify-center w-14 h-full transition-colors ${
            currentView === 'student-dashboard' ? 'text-[#101828] font-bold' : 'text-[#667085]'
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

        {/* Messages */}
        <button
          onClick={() => setIsChatModalOpen(true)}
          className="relative flex flex-col items-center justify-center w-14 h-full text-[#667085]"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-3 w-2 h-2 bg-[#F97316] rounded-full" />
          )}
          <span className="text-[10px] mt-1">Messages</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => onNavigate('student-dashboard')}
          className="flex flex-col items-center justify-center w-14 h-full text-[#667085]"
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] mt-1">Profile</span>
        </button>
      </div>
    </nav>
  );
};
