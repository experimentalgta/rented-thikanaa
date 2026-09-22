import React from 'react';
import { Lock, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PendingAction } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  pendingAction?: PendingAction;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  fallbackTitle = 'Sign in Required',
  fallbackDescription = 'Please sign in with Google to view this protected section and access verified details.',
  pendingAction,
}) => {
  const { isAuthenticated, loading, requireAuth } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-medium">Verifying authorization...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/80 shadow-lg text-center space-y-5 animate-in fade-in">
          <div className="w-14 h-14 bg-amber-50 text-[#F59E0B] rounded-2xl flex items-center justify-center mx-auto ring-1 ring-amber-100">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[#101828] font-heading">
              {fallbackTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {fallbackDescription}
            </p>
          </div>

          <button
            onClick={() => requireAuth(fallbackDescription, pendingAction)}
            className="w-full py-3.5 px-4 bg-[#101828] hover:bg-[#1E293B] text-white font-semibold rounded-2xl shadow-xs hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            <span>Continue with Google</span>
            <ArrowRight className="w-4 h-4 text-[#F59E0B]" />
          </button>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Zero spam. Instant Google authentication.</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
