import React from 'react';
import { Phone, MessageSquare, Lock, Edit3, Loader2 } from 'lucide-react';
import { Property } from '../../types';
import { FormattedPhoneResult } from '../../utils/phoneUtils';

export interface StickyContactBarProps {
  property: Property;
  isAuthenticated: boolean;
  isOwner: boolean;
  contactDetails: FormattedPhoneResult | null;
  isPhoneVisible: boolean;
  isLoadingContact?: boolean;
  isLoadingAuth?: boolean;
  onCall: (e?: React.MouseEvent) => void;
  onWhatsApp: (e?: React.MouseEvent) => void;
  onChat: (e?: React.MouseEvent) => void;
  onManageListing?: () => void;
}

export const StickyContactBar: React.FC<StickyContactBarProps> = ({
  property,
  isAuthenticated,
  isOwner,
  contactDetails,
  isPhoneVisible,
  isLoadingContact = false,
  isLoadingAuth = false,
  onCall,
  onWhatsApp,
  onChat,
  onManageListing,
}) => {
  const formattedRent = property.rent ? property.rent.toLocaleString('en-IN') : '0';
  const isResolving = isLoadingContact || isLoadingAuth;

  return (
    <aside
      aria-label="Contact and booking actions"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#E5E7EB] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-3.5 sm:px-5 py-2.5 pb-[calc(env(safe-area-inset-bottom)+10px)] lg:hidden transition-all duration-200 pointer-events-auto"
    >
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        {/* Left Side: Pricing / Owner Status */}
        <div className="flex flex-col min-w-0 pr-1">
          {isOwner ? (
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-bold font-heading text-[#101828]">
                  ₹{formattedRent}
                </span>
                <span className="text-[11px] text-[#64748B]">/mo</span>
              </div>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Your Listing
              </span>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-base sm:text-lg font-bold font-heading text-[#101828]">
                  ₹{formattedRent}
                </span>
                <span className="text-xs text-[#64748B]">/mo</span>
              </div>
              <span className="text-[11px] text-[#64748B] block truncate max-w-[110px] sm:max-w-[140px]">
                {property.room_type || property.furnishing_status || 'Monthly Rent'}
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {isOwner ? (
            /* OWNER STATE: Manage / Edit button */
            <button
              type="button"
              onClick={onManageListing}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all shadow-xs min-h-[44px] cursor-pointer"
            >
              <Edit3 className="w-4 h-4 text-amber-400" />
              <span>Manage Listing</span>
            </button>
          ) : isResolving ? (
            /* LOADING / RESOLVING AUTH STATE */
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 rounded-xl text-xs text-slate-600 font-medium min-h-[44px]">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              <span>Verifying host...</span>
            </div>
          ) : !isAuthenticated ? (
            /* UNAUTHENTICATED STATE: Call, WhatsApp, Chat (all strictly gated by requireAuth) */
            <>
              <button
                type="button"
                onClick={onCall}
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all shadow-xs min-h-[44px] cursor-pointer"
                title="Sign in to call host"
              >
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>Call</span>
              </button>

              <button
                type="button"
                onClick={onWhatsApp}
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold bg-[#25D366] text-white hover:bg-[#20ba59] active:scale-95 transition-all shadow-xs min-h-[44px] cursor-pointer"
                title="Sign in to chat on WhatsApp"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={onChat}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs font-bold bg-[#F59E0B] text-slate-900 hover:bg-[#D97706] active:scale-95 transition-all shadow-xs min-h-[44px] cursor-pointer"
                title="Sign in to chat with host"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </button>
            </>
          ) : isPhoneVisible && contactDetails ? (
            /* AUTHENTICATED & PHONE VISIBLE STATE (All buttons call validated handlers) */
            <>
              <button
                type="button"
                onClick={onCall}
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all shadow-xs min-h-[44px] cursor-pointer"
                title={`Call host at ${contactDetails.formattedDisplay}`}
              >
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>Call</span>
              </button>

              <button
                type="button"
                onClick={onWhatsApp}
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold bg-[#25D366] text-white hover:bg-[#20ba59] active:scale-95 transition-all shadow-xs min-h-[44px] cursor-pointer"
                title="Open WhatsApp chat"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={onChat}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs font-bold bg-[#F59E0B] text-slate-900 hover:bg-[#D97706] active:scale-95 transition-all shadow-xs min-h-[44px] cursor-pointer"
                title="Message host directly"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </button>
            </>
          ) : (
            /* AUTHENTICATED BUT PHONE PRIVATE STATE */
            <>
              <button
                type="button"
                onClick={onCall}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-2.5 rounded-xl text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 transition-colors min-h-[44px] cursor-pointer"
                title="Phone kept private by host"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Private</span>
              </button>

              <button
                type="button"
                onClick={onChat}
                className="inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold bg-[#F59E0B] text-slate-900 hover:bg-[#D97706] active:scale-95 transition-all shadow-xs min-h-[44px] cursor-pointer flex-1"
                title="Direct messaging with host"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat with Host</span>
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
