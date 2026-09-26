import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SavedProvider } from './context/SavedContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { LocationProvider } from './context/LocationContext';
import { Header } from './components/layout/Header';
import { MobileNav } from './components/layout/MobileNav';
import { Footer } from './components/layout/Footer';
import { ChatModal } from './components/chat/ChatModal';
import { LoginModal } from './components/auth/LoginModal';
import { AuthCallback } from './components/auth/AuthCallback';

import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { PropertyDetailPage } from './pages/PropertyDetailPage';
import { RoommatePage } from './pages/RoommatePage';
import { UserDashboard } from './pages/UserDashboard';
import { AddPropertyPage } from './pages/AddPropertyPage';
import { AdminDashboard } from './pages/AdminDashboard';

import { Property, StudentProfile, PendingAction } from './types';
import { propertyRepository } from './services/propertyRepository';
import { roommateRepository } from './services/roommateRepository';

const MainApp: React.FC = () => {
  const { isAuthenticated, requireAuth, isSuperAdmin, consumePendingAction } = useAuth();
  const { openChatWithContext, isChatModalOpen, setIsChatModalOpen } = useChat();

  const isChatModalOpenRef = useRef(isChatModalOpen);
  useEffect(() => {
    isChatModalOpenRef.current = isChatModalOpen;
  }, [isChatModalOpen]);

  const [isCallbackRoute, setIsCallbackRoute] = useState(() => {
    return (
      window.location.pathname === '/auth/callback' ||
      window.location.hash.includes('access_token=') ||
      window.location.search.includes('code=')
    );
  });

  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedLocality, setSelectedLocality] = useState<string>('');
  const [selectedPropertyType, setSelectedPropertyType] = useState<string | undefined>(undefined);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [subTab, setSubTab] = useState<string | undefined>(undefined);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  const [featuredProperties, setFeaturedProperties] = useState<Property[]>([]);
  const [sampleRoommates, setSampleRoommates] = useState<StudentProfile[]>([]);

  // Track the previous non-detail view for smart back navigation & scroll restoration
  const previousViewRef = useRef<string>('home');
  const currentViewRef = useRef<string>('home');
  const selectedPropertyRef = useRef<Property | null>(null);

  useEffect(() => {
    currentViewRef.current = currentView;
    if (currentView !== 'property-detail') {
      previousViewRef.current = currentView;
    }
  }, [currentView]);

  useEffect(() => {
    selectedPropertyRef.current = selectedProperty;
  }, [selectedProperty]);

  // Clean up any body scroll lock on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    // Initial fetch for freshest accommodations (most recent on top) and roommates across India from Supabase
    propertyRepository
      .getRecentProperties(12)
      .then((props) => {
        setFeaturedProperties(props);
      })
      .catch((err) => {
        console.error('Failed to fetch recent properties from Supabase:', err);
      });

    roommateRepository
      .getRoommates()
      .then((rms) => {
        setSampleRoommates(rms);
      })
      .catch((err) => {
        console.error('Failed to fetch initial roommates from Supabase:', err);
      });
  }, []);

  // 1. Initial Cold-Start Deep-Linking Check (Executes STRICTLY ONCE on initial app mount)
  useEffect(() => {
    // Ensure initial entry has state
    if (!window.history.state) {
      window.history.replaceState({ view: 'home' }, '', window.location.href);
    }

    // Deep link or initial query param check (?room=... or ?roomId=...)
    const initialUrl = new URL(window.location.href);
    const initialRoomId = initialUrl.searchParams.get('room') || initialUrl.searchParams.get('roomId');
    if (initialRoomId) {
      propertyRepository.getPropertyById(initialRoomId).then((p) => {
        if (p) {
          setSelectedProperty(p);
          if (window.innerWidth < 768) {
            // For mobile: clean base URL state so back button stays within the app, then push detail sheet
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('room');
            cleanUrl.searchParams.delete('roomId');
            window.history.replaceState({ view: 'home' }, '', cleanUrl.toString());

            window.history.pushState(
              { isMobileDetailOpen: true, roomId: initialRoomId },
              '',
              initialUrl.toString()
            );
            setIsMobileDetailOpen(true);
            document.body.style.overflow = 'hidden';
          } else {
            setCurrentView('property-detail');
          }
        }
      });
    }
  }, []); // Strictly once on cold start!

  // 2. Hardware / Browser PopState Navigation Trap (Attached ONCE, reads latest values via mutable refs)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        // --- MOBILE POPSTATE INTERCEPTION (< md) ---
        // If chat modal is open on mobile, close chat modal first
        if (isChatModalOpenRef.current) {
          setIsChatModalOpen(false);
          return;
        }

        // When user presses phone physical back or gesture swipes back:
        setIsMobileDetailOpen(false);
        setSelectedProperty(null);
        document.body.style.overflow = '';

        // Clean query parameter from URL without navigating away
        const url = new URL(window.location.href);
        if (url.searchParams.has('room') || url.searchParams.has('roomId')) {
          url.searchParams.delete('room');
          url.searchParams.delete('roomId');
          window.history.replaceState({ view: currentViewRef.current }, '', url.toString());
        }
        return;
      }

      // --- DESKTOP POPSTATE (>= md) ---
      const url = new URL(window.location.href);
      const roomId = url.searchParams.get('roomId') || url.searchParams.get('room');

      if (!roomId) {
        // User popped back from desktop property detail
        setSelectedProperty(null);
        const targetView = event.state?.fromView || event.state?.view || previousViewRef.current || 'home';
        setCurrentView(targetView);

        // Restore scroll position
        const savedScroll = sessionStorage.getItem(`scroll_${targetView}`);
        if (savedScroll) {
          setTimeout(() => {
            window.scrollTo({ top: Number(savedScroll), behavior: 'instant' });
          }, 30);
        }
      } else {
        // User popped forward to a property detail
        if (!selectedPropertyRef.current || selectedPropertyRef.current.id !== roomId) {
          propertyRepository.getPropertyById(roomId).then((p) => {
            if (p) {
              setSelectedProperty(p);
              setCurrentView('property-detail');
            }
          });
        } else {
          setCurrentView('property-detail');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const executePendingAction = (action: PendingAction) => {
    if (action.type === 'property-detail' && (action.property || action.propertyId)) {
      if (action.property) {
        handleSelectProperty(action.property);
      } else if (action.propertyId) {
        propertyRepository.getPropertyById(action.propertyId).then((p) => {
          if (p) {
            handleSelectProperty(p);
          }
        });
      }
    } else if (action.type === 'chat' && action.context) {
      openChatWithContext(action.context);
    } else if (action.type === 'dashboard' || action.type === 'saved') {
      if (action.subTab || action.type === 'saved') {
        setSubTab(action.subTab || 'saved');
      }
      setCurrentView('member-dashboard');
    } else if (action.type === 'add-property') {
      setCurrentView('add-property');
    }
  };

  // When user becomes authenticated, resume any pending action
  useEffect(() => {
    if (isAuthenticated) {
      const pending = consumePendingAction();
      if (pending) {
        executePendingAction(pending);
      }
    }
  }, [isAuthenticated, consumePendingAction]);

  const handleAuthComplete = (pending: PendingAction | null) => {
    setIsCallbackRoute(false);
    if (pending) {
      executePendingAction(pending);
    } else {
      setCurrentView('home');
    }
  };

  const handleMobileClose = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setIsMobileDetailOpen(false);
      setSelectedProperty(null);
      document.body.style.overflow = '';
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      url.searchParams.delete('roomId');
      window.history.replaceState({ view: currentViewRef.current }, '', url.toString());
    }
  }, []);

  const handleBackFromProperty = useCallback(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('roomId') && window.history.length > 1) {
      window.history.back();
    } else {
      url.searchParams.delete('roomId');
      const targetView = previousViewRef.current || 'home';
      window.history.replaceState({ view: targetView }, '', url.toString());
      setSelectedProperty(null);
      setCurrentView(targetView);
      const savedScroll = sessionStorage.getItem(`scroll_${targetView}`);
      if (savedScroll) {
        setTimeout(() => {
          window.scrollTo({ top: Number(savedScroll), behavior: 'instant' });
        }, 30);
      }
    }
  }, []);

  const handleNavigate = (view: string, param?: any) => {
    setIsChatModalOpen(false);
    if (isMobileDetailOpen) {
      setIsMobileDetailOpen(false);
      document.body.style.overflow = '';
    }

    const url = new URL(window.location.href);
    if (url.searchParams.has('roomId') || url.searchParams.has('room')) {
      url.searchParams.delete('roomId');
      url.searchParams.delete('room');
      window.history.replaceState({ view }, '', url.toString());
    } else {
      window.history.replaceState({ view }, '', window.location.href);
    }
    setSelectedProperty(null);

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (view === 'property-detail' && param) {
      handleSelectProperty(param);
      return;
    }

    if (
      param &&
      (view === 'student-dashboard' ||
        view === 'owner-dashboard' ||
        view === 'member-dashboard' ||
        view === 'user-dashboard')
    ) {
      setSubTab(param);
    }

    if (
      view === 'student-dashboard' ||
      view === 'owner-dashboard' ||
      view === 'user-dashboard' ||
      view === 'member-dashboard'
    ) {
      if (
        !requireAuth(
          'Sign in with Google to view your profile, saved properties, and member dashboard.',
          { type: 'dashboard', subTab: param }
        )
      ) {
        return;
      }
      setCurrentView('member-dashboard');
      return;
    }

    if (view === 'owner-add' || view === 'add-property' || view === 'list-room') {
      if (
        !requireAuth(
          'Sign in with Google to create and publish your room or PG listing.',
          { type: 'add-property' }
        )
      ) {
        return;
      }
      setCurrentView('add-property');
      return;
    }

    if (view === 'admin-panel') {
      if (
        !requireAuth(
          'Sign in with an authorized Google Super Admin account to access moderation.',
          { type: 'dashboard' }
        )
      ) {
        return;
      }
      if (!isSuperAdmin) {
        alert('Access denied: You do not have super admin permissions.');
        return;
      }
      setCurrentView('admin-panel');
      return;
    }

    if (view === 'home' && param === 'areas') {
      setCurrentView('home');
      setTimeout(() => {
        const el = document.getElementById('areas');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }

    if (view === 'search') {
      if (param !== undefined) {
        setSelectedLocality(param);
      }
      setCurrentView('search');
      return;
    }

    setCurrentView(view);
  };

  const handleSearchTrigger = (locality: string, propertyType?: string) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSelectedLocality(locality);
    setSelectedPropertyType(propertyType);
    setCurrentView('search');
  };

  const handleSelectProperty = useCallback((property: Property) => {
    setSelectedProperty(property);

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    if (isMobile) {
      // --- MOBILE FULL-SCREEN SHEET FLOW (< md) ---
      // Lock background body scroll so the listings screen maintains exact scroll position
      document.body.style.overflow = 'hidden';

      // Push history state specifically for mobile modal
      const url = new URL(window.location.href);
      url.searchParams.set('room', property.id);
      window.history.pushState(
        { isMobileDetailOpen: true, roomId: property.id },
        '',
        url.toString()
      );

      setIsMobileDetailOpen(true);
    } else {
      // --- DESKTOP ROUTE FLOW (>= md) ---
      setCurrentView((prevView) => {
        const previousView = prevView !== 'property-detail' ? prevView : 'home';
        sessionStorage.setItem(`scroll_${previousView}`, String(window.scrollY));

        const url = new URL(window.location.href);
        url.searchParams.set('roomId', property.id);
        window.history.pushState(
          { view: 'property-detail', roomId: property.id, fromView: previousView },
          '',
          url.toString()
        );

        window.scrollTo({ top: 0, behavior: 'instant' });
        return 'property-detail';
      });
    }
  }, []);

  return (
    <div className="w-full max-w-full overflow-x-hidden relative min-h-screen flex flex-col bg-[#F8FAFC] text-[#111827]">
      {/* Universal Desktop & Mobile Header */}
      <Header currentView={currentView} onNavigate={handleNavigate} />

      {/* Main Routed Content */}
      <main className="w-full max-w-full overflow-x-hidden md:overflow-x-visible flex-1 pb-28 md:pb-0">
        {isCallbackRoute ? (
          <AuthCallback onAuthComplete={handleAuthComplete} />
        ) : (
          <>
            {currentView === 'home' && (
              <HomePage
                featuredProperties={featuredProperties}
                sampleRoommates={sampleRoommates}
                onSearch={handleSearchTrigger}
                onSelectProperty={handleSelectProperty}
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'search' && (
              <SearchPage
                initialLocality={selectedLocality}
                initialPropertyType={selectedPropertyType}
                onSelectProperty={handleSelectProperty}
                onNavigate={handleNavigate}
              />
            )}

            {/* Desktop Property Detail Page (>= md) */}
            {currentView === 'property-detail' && selectedProperty && (
              <div className="hidden md:block">
                <PropertyDetailPage
                  property={selectedProperty}
                  onBack={handleBackFromProperty}
                />
              </div>
            )}

            {currentView === 'roommates' && <RoommatePage />}

            {(currentView === 'member-dashboard' ||
              currentView === 'student-dashboard' ||
              currentView === 'owner-dashboard' ||
              currentView === 'user-dashboard') && (
              <UserDashboard
                initialTab={subTab || 'overview'}
                onAddProperty={() => handleNavigate('add-property')}
                onSelectProperty={handleSelectProperty}
                onNavigate={handleNavigate}
              />
            )}

            {(currentView === 'add-property' || currentView === 'owner-add') && (
              <AddPropertyPage
                onSuccess={(newProp) => {
                  setFeaturedProperties((prev) => [newProp, ...prev.filter((p) => p.id !== newProp.id)]);
                  handleSelectProperty(newProp);
                }}
                onCancel={() => handleNavigate('member-dashboard')}
              />
            )}

            {currentView === 'admin-panel' && (
              <AdminDashboard onSelectProperty={handleSelectProperty} />
            )}
          </>
        )}
      </main>

      {/* MOBILE-ONLY FULL-SCREEN ROOM DETAIL SHEET (< md) */}
      {isMobileDetailOpen && selectedProperty && (
        <div
          className="md:hidden fixed inset-0 z-[60] bg-[#F8FAFC] overflow-y-auto overscroll-y-contain flex flex-col animate-sheet-enter"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <PropertyDetailPage
            property={selectedProperty}
            onBack={handleMobileClose}
          />
        </div>
      )}

      {/* Global In-App Messaging Modal */}
      <ChatModal />

      {/* Global Google Authentication Modal */}
      <LoginModal />

      {/* Mobile-Only Dedicated Bottom Navigation */}
      <MobileNav currentView={currentView} onNavigate={handleNavigate} />

      {/* Footer */}
      <Footer
        onSelectLocality={(loc) => handleSearchTrigger(loc)}
        onNavigate={handleNavigate}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SavedProvider>
        <ChatProvider>
          <LocationProvider>
            <MainApp />
          </LocationProvider>
        </ChatProvider>
      </SavedProvider>
    </AuthProvider>
  );
}
