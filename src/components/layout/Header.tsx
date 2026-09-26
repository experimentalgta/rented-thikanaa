import React from 'react';
import {
  Heart,
  MessageSquare,
  PlusCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSaved } from '../../context/SavedContext';
import { useChat } from '../../context/ChatContext';
import { UserMenu } from '../auth/UserMenu';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string, param?: any) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate }) => {
  const { currentUser, isAuthenticated, requireAuth } = useAuth();
  const { savedCount } = useSaved();
  const { unreadCount, setIsChatModalOpen } = useChat();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] transition-all w-full max-w-full overflow-hidden">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18 w-full min-w-0">
          {/* Brand Logo */}
          <div className="flex items-center gap-6 shrink-0 min-w-0">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2 sm:gap-2.5 text-left focus:outline-none group shrink-0"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#101828] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
                <span className="text-base font-black text-[#F59E0B] font-heading tracking-tighter">RT</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-base sm:text-lg font-bold text-[#101828] font-heading tracking-tight whitespace-nowrap">
                    Rented Thikana
                  </span>
                  <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">
                    India
                  </span>
                </div>
                <p className="text-[11px] text-[#667085] hidden md:block whitespace-nowrap">
                  Room &amp; Roommate Marketplace
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
                onClick={() => onNavigate('home', 'cities')}
                className="px-3.5 py-2 rounded-xl text-sm font-medium text-[#667085] hover:text-[#101828] hover:bg-[#F8FAFC] transition-colors"
              >
                Explore Cities
              </button>
            </nav>
          </div>

          {/* Right Action Elements */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Saved Rooms Button (All Members) */}
            <button
              type="button"
              onClick={() => {
                if (requireAuth('Sign in with Google to view your saved accommodations.', { type: 'saved' })) {
                  onNavigate('member-dashboard', 'saved');
                }
              }}
              className="relative p-2 sm:p-2.5 text-[#667085] hover:text-[#101828] hover:bg-[#F8FAFC] rounded-xl transition-colors cursor-pointer min-w-[36px] sm:min-w-[40px] min-h-[36px] sm:min-h-[40px] flex items-center justify-center shrink-0"
              title="Saved Properties"
            >
              <Heart className="w-5 h-5" />
              {savedCount > 0 && (
                <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-4 h-4 bg-[#F59E0B] text-[#101828] font-bold text-[10px] rounded-full flex items-center justify-center shadow-xs">
                  {savedCount}
                </span>
              )}
            </button>

            {/* In-App Messaging Button (All Members) */}
            <button
              type="button"
              onClick={() => {
                if (requireAuth('Sign in with Google to access your in-app messages and conversations.', { type: 'chat' })) {
                  setIsChatModalOpen(true);
                }
              }}
              className="relative p-2 sm:p-2.5 text-[#667085] hover:text-[#101828] hover:bg-[#F8FAFC] rounded-xl transition-colors cursor-pointer min-w-[36px] sm:min-w-[40px] min-h-[36px] sm:min-h-[40px] flex items-center justify-center shrink-0"
              title="In-App Messages"
            >
              <MessageSquare className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-2 h-2 bg-[#F97316] rounded-full ring-2 ring-white" />
              )}
            </button>

            {/* Universal Member Primary CTA: List Property */}
            <button
              onClick={() => {
                if (requireAuth('Sign in with Google to list your accommodation or spare room.', { type: 'add-property' })) {
                  onNavigate('add-property');
                }
              }}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#101828] text-white hover:bg-[#1E293B] shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <PlusCircle className="w-4 h-4 text-[#F59E0B]" />
              List Property
            </button>

            {/* Authenticated User Menu vs Anonymous Sign In */}
            {isAuthenticated && currentUser ? (
              <UserMenu onNavigate={onNavigate} />
            ) : (
              <button
                onClick={() => requireAuth('Sign in with Google to view complete room details, contact numbers, and chat with owners.')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#101828] text-white hover:bg-[#1E293B] shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
