import React, { useState } from 'react';
import { X, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, setIsLoginModalOpen, loginModalReason, signInWithGoogle, clearPendingAction } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoginModalOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // Browser will redirect to Google OAuth
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      setError(err.message || 'Unable to connect to Google OAuth. Please check connection and try again.');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return; // Prevent closing while OAuth redirect is starting
    setIsLoginModalOpen(false);
    clearPendingAction();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-left"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header Brand Icon */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#101828] flex items-center justify-center shadow-xs">
              <span className="text-lg font-black text-[#F59E0B] font-heading tracking-tighter">RT</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold text-[#101828] font-heading tracking-tight">
                  Rented Thikan
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">
                  Verified
                </span>
              </div>
              <p className="text-xs text-slate-500">Student Room &amp; Roommate Platform</p>
            </div>
          </div>

          {/* Heading & Context Message */}
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-[#101828] font-heading">
              Sign in to continue
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {loginModalReason || 'To view complete room details, verified contact numbers, and chat with property owners, please sign in with Google.'}
            </p>
          </div>

          {/* Friendly Error Display */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign In CTA */}
          <div className="space-y-3 pt-1">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-800 font-semibold rounded-2xl border-2 border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 text-[#F59E0B] animate-spin" />
                  <span className="text-sm">Connecting to Google...</span>
                </>
              ) : (
                <>
                  {/* Official Google Multicolor Logo */}
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.26 21.36 7.34 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.57H1.26C.46 8.17 0 9.99 0 12s.46 3.83 1.26 5.43l4.02-3.14z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.26 6.57l4.02 3.14c.95-2.83 3.6-4.96 6.72-4.96z"
                    />
                  </svg>
                  <span className="text-sm font-bold text-slate-800 font-heading">
                    Continue with Google
                  </span>
                </>
              )}
            </button>

            {/* Maybe later dismissal */}
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer text-center"
            >
              Maybe later
            </button>
          </div>

          {/* Privacy & Safety Note */}
          <div className="pt-4 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
            <span>
              We only access your basic public profile (name &amp; email) to create a verified student/lister identity. No spam or passwords required.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
