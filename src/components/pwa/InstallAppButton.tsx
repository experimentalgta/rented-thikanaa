import React from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';
import { useChat } from '../../context/ChatContext';

export const InstallAppButton: React.FC = () => {
  const { isInstallable, isInstalled, isInstallDismissed, promptInstall, dismissInstallPrompt } =
    usePwa();
  const { isChatModalOpen } = useChat();

  // Do not show if app is already installed, user dismissed it, not installable, or chat modal is open
  if (isInstalled || isInstallDismissed || !isInstallable || isChatModalOpen) {
    return null;
  }

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await promptInstall();
  };

  const handleDismissClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dismissInstallPrompt();
  };

  return (
    <div
      className="fixed z-40 flex items-center transition-all duration-300 animate-in fade-in slide-in-from-bottom-3
        bottom-20 right-3.5 sm:bottom-6 sm:right-6"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center bg-[#101828] text-white rounded-full p-1 pl-3.5 shadow-2xl border border-amber-500/30 hover:border-amber-400 transition-all group backdrop-blur-md">
        <button
          type="button"
          onClick={handleInstallClick}
          aria-label="Install Renter Thikan App"
          className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white hover:text-amber-400 transition-colors cursor-pointer py-1 pr-1.5 focus:outline-hidden"
        >
          <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-[#F59E0B] group-hover:scale-110 transition-transform">
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <span className="whitespace-nowrap tracking-wide">Install App</span>
        </button>

        <button
          type="button"
          onClick={handleDismissClick}
          aria-label="Dismiss install prompt"
          title="Dismiss"
          className="p-1.5 ml-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
