import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Heart,
  PlusCircle,
  ShieldAlert,
  LogOut,
  ChevronDown,
  Building2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface UserMenuProps {
  onNavigate: (view: string, param?: any) => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ onNavigate }) => {
  const { currentUser, isSuperAdmin, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  if (!currentUser) return null;

  const displayName = currentUser.full_name || currentUser.email?.split('@')[0] || 'User';
  const firstName = displayName.split(' ')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase() || 'U';

  const handleItemClick = (view: string, param?: any) => {
    setIsOpen(false);
    onNavigate(view, param);
  };

  const handleLogout = async () => {
    setIsOpen(false);
    await signOut();
    onNavigate('home');
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 pl-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all cursor-pointer shadow-xs active:scale-95"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {currentUser.avatar_url ? (
          <img
            src={currentUser.avatar_url}
            alt={displayName}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover ring-1 ring-slate-200 shrink-0"
          />
        ) : (
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#101828] text-[#F59E0B] font-extrabold text-xs flex items-center justify-center ring-1 ring-slate-200 shrink-0 font-heading">
            {initial}
          </div>
        )}
        <span className="inline-block text-xs font-bold text-[#111827] truncate max-w-[85px] sm:max-w-[120px]">
          {firstName}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* User Details Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
            {currentUser.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={displayName}
                className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-200 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[#101828] text-[#F59E0B] font-extrabold text-sm flex items-center justify-center ring-1 ring-slate-200 shrink-0 font-heading">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
              <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
              {isSuperAdmin && (
                <span className="inline-block mt-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                  Super Admin
                </span>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <div className="py-1">
            <button
              onClick={() => handleItemClick('member-dashboard')}
              className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>My Profile &amp; Dashboard</span>
            </button>

            <button
              onClick={() => handleItemClick('member-dashboard', 'saved')}
              className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Heart className="w-4 h-4 text-slate-400" />
              <span>Saved Accommodations</span>
            </button>

            <button
              onClick={() => handleItemClick('add-property')}
              className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-[#F59E0B]" />
              <span>List a Room or PG</span>
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => handleItemClick('admin-panel')}
                className="w-full px-4 py-2 text-left text-xs font-semibold text-amber-800 hover:bg-amber-50 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Super Admin Panel</span>
              </button>
            )}
          </div>

          {/* Logout Action */}
          <div className="pt-1 border-t border-slate-100">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
