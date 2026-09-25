import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { PendingAction } from '../../types';

interface AuthCallbackProps {
  onAuthComplete: (pendingAction: PendingAction | null) => void;
}

export const AuthCallback: React.FC<AuthCallbackProps> = ({ onAuthComplete }) => {
  const { consumePendingAction } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const processCallback = async () => {
      if (!supabase) {
        setStatus('error');
        setErrorMessage('Supabase client is not available.');
        return;
      }

      try {
        // 1. Check if session is already established or wait for token parsing
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (session) {
          setStatus('success');
          // Retrieve and consume pending action
          const pending = consumePendingAction();
          // Clean up URL hash / search params and callback path back to root without refreshing
          window.history.replaceState({}, document.title, '/');
          timer = setTimeout(() => {
            onAuthComplete(pending);
          }, 800);
        } else {
          // If no session immediately, listen for authStateChange
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            if (newSession) {
              subscription.unsubscribe();
              setStatus('success');
              const pending = consumePendingAction();
              window.history.replaceState({}, document.title, '/');
              timer = setTimeout(() => {
                onAuthComplete(pending);
              }, 800);
            }
          });

          // Timeout after 6 seconds if no session arrives
          setTimeout(() => {
            subscription.unsubscribe();
            if (status === 'loading') {
              setStatus('error');
              setErrorMessage('Authentication timed out or was cancelled. Please try signing in again.');
            }
          }, 6000);
        }
      } catch (err: any) {
        console.error('Error during OAuth callback processing:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Failed to complete sign in.');
      }
    };

    processCallback();

    return () => {
      clearTimeout(timer);
    };
  }, [consumePendingAction, onAuthComplete]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-100 shadow-xl text-center space-y-4">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 bg-amber-50 text-[#F59E0B] rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 font-heading">
              Completing Google Sign In...
            </h2>
            <p className="text-xs text-slate-500">
              Securing session and verifying your student identity...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs animate-in zoom-in-90">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 font-heading">
              Successfully Signed In!
            </h2>
            <p className="text-xs text-slate-500">
              Taking you to your destination...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto shadow-xs animate-in zoom-in-90">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 font-heading">
              Authentication Notice
            </h2>
            <p className="text-xs text-rose-600">
              {errorMessage}
            </p>
            <button
              onClick={() => onAuthComplete(null)}
              className="mt-4 px-6 py-2.5 bg-[#101828] text-white text-xs font-semibold rounded-xl hover:bg-[#1E293B] transition cursor-pointer"
            >
              Return to Listings
            </button>
          </>
        )}
      </div>
    </div>
  );
};
