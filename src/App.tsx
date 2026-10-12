import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SavedProvider } from './context/SavedContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { LocationProvider } from './context/LocationContext';
import { NearbyRoomsProvider } from './context/NearbyRoomsContext';
import { Header } from './components/layout/Header';
import { MobileNav } from './components/layout/MobileNav';
import { Footer } from './components/layout/Footer';
import { ChatModal } from './components/chat/ChatModal';
import { MessageNotificationToast } from './components/chat/MessageNotificationToast';
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
import { getPhoneContactDetails } from './utils/phoneUtils';

interface AppNavigationState {
  view: string;
  propertyType?: string;
  locality?: string;
  subTab?: string;
  roomId?: string | null;
  fromView?: string;
  isMobileDetailOpen?: boolean;
  isChatModalOpen?: boolean;
  isChatActive?: boolean;
  chatConvId?: string | null;
  chatLevel?: number;
  hadListStep?: boolean;
  internalIndex: number;
}

const buildRouteUrl = (
  view: string,
  options?: {
    locality?: string;
    propertyType?: string;
    subTab?: string;
    roomId?: string | null;
  }
): URL => {
  const url = new URL(window.location.origin + window.location.pathname);

  if (view === 'home') {
    if (options?.locality) {
      url.searchParams.set('locality', options.locality);
    }
  } else if (view === 'search') {
    url.searchParams.set('view', 'search');
    if (options?.locality) {
      url.searchParams.set('locality', options.locality);
    }
    if (options?.propertyType && options.propertyType !== 'all') {
      url.searchParams.set('type', options.propertyType);
    }
  } else if (view === 'roommates') {
    url.searchParams.set('view', 'roommates');
  } else if (
    view === 'member-dashboard' ||
    view === 'student-dashboard' ||
    view === 'owner-dashboard' ||
    view === 'user-dashboard'
  ) {
    url.searchParams.set('view', 'member-dashboard');
    if (options?.subTab && options.subTab !== 'overview') {
      url.searchParams.set('tab', options.subTab);
    }
  } else if (view === 'add-property' || view === 'owner-add' || view === 'list-room') {
    url.searchParams.set('view', 'add-property');
  } else if (view === 'admin-panel') {
    url.searchParams.set('view', 'admin-panel');
  } else if (view === 'property-detail') {
    if (options?.roomId) {
      url.searchParams.set('roomId', options.roomId);
    }
  }

  // Mobile detail sheet overlay maintains underlying view with room param
  if (options?.roomId && view !== 'property-detail') {
    url.searchParams.set('room', options.roomId);
  }

  return url;
};

const parseRouteFromUrl = (): {
  view: string;
  propertyType?: string;
  locality: string;
  subTab?: string;
  roomId: string | null;
} => {
  try {
    const url = new URL(window.location.href);
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const viewParam = url.searchParams.get('view')?.toLowerCase();
    const adminParam = url.searchParams.get('admin');
    const typeParam = url.searchParams.get('type') || url.searchParams.get('propertyType') || undefined;
    const localityParam = url.searchParams.get('locality') || '';
    const tabParam = url.searchParams.get('tab') || undefined;
    const roomParam = url.searchParams.get('roomId') || url.searchParams.get('room') || null;

    if (
      path === '/admin' ||
      path === '/admin-panel' ||
      hash === '#admin' ||
      viewParam === 'admin-panel' ||
      viewParam === 'admin' ||
      adminParam === 'true'
    ) {
      return { view: 'admin-panel', propertyType: undefined, locality: '', subTab: undefined, roomId: null };
    }

    if (roomParam && typeof window !== 'undefined' && window.innerWidth >= 768) {
      return { view: 'property-detail', propertyType: typeParam, locality: localityParam, subTab: undefined, roomId: roomParam };
    }

    if (viewParam === 'search' || typeParam || (localityParam && viewParam !== 'home')) {
      return { view: 'search', propertyType: typeParam, locality: localityParam, subTab: undefined, roomId: roomParam };
    }

    if (viewParam === 'roommates') {
      return { view: 'roommates', propertyType: undefined, locality: '', subTab: undefined, roomId: null };
    }

    if (
      viewParam === 'member-dashboard' ||
      viewParam === 'user-dashboard' ||
      viewParam === 'student-dashboard' ||
      viewParam === 'owner-dashboard'
    ) {
      return { view: 'member-dashboard', propertyType: undefined, locality: '', subTab: tabParam, roomId: null };
    }

    if (viewParam === 'add-property' || viewParam === 'owner-add' || viewParam === 'list-room') {
      return { view: 'add-property', propertyType: undefined, locality: '', subTab: undefined, roomId: null };
    }

    return { view: 'home', propertyType: typeParam, locality: localityParam, subTab: undefined, roomId: roomParam };
  } catch {
    return { view: 'home', propertyType: undefined, locality: '', subTab: undefined, roomId: null };
  }
};

const initialRoute = typeof window !== 'undefined'
  ? parseRouteFromUrl()
  : { view: 'home', propertyType: undefined, locality: '', subTab: undefined, roomId: null };

const MainApp: React.FC = () => {
  const { isAuthenticated, requireAuth, isSuperAdmin, consumePendingAction, currentUser } = useAuth();
  const {
    openChatForListing,
    openChatWithContext,
    isChatModalOpen,
    setIsChatModalOpen,
    openMessagesList,
    clearActiveConversation,
    activeConversation,
  } = useChat();

  const isChatModalOpenRef = useRef(isChatModalOpen);
  useEffect(() => {
    isChatModalOpenRef.current = isChatModalOpen;
  }, [isChatModalOpen]);

  const activeConversationRef = useRef(activeConversation);
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  const [isCallbackRoute, setIsCallbackRoute] = useState(() => {
    return (
      window.location.pathname === '/auth/callback' ||
      window.location.hash.includes('access_token=') ||
      window.location.search.includes('code=')
    );
  });

  const [currentView, setCurrentView] = useState<string>(initialRoute.view);
  const [selectedLocality, setSelectedLocality] = useState<string>(initialRoute.locality);
  const [selectedPropertyType, setSelectedPropertyType] = useState<string | undefined>(initialRoute.propertyType);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [subTab, setSubTab] = useState<string | undefined>(initialRoute.subTab);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  const isMobileDetailOpenRef = useRef(isMobileDetailOpen);
  useEffect(() => {
    isMobileDetailOpenRef.current = isMobileDetailOpen;
  }, [isMobileDetailOpen]);

  const currentInternalIndexRef = useRef<number>(
    typeof window !== 'undefined' && typeof window.history.state?.internalIndex === 'number'
      ? window.history.state.internalIndex
      : 0
  );

  const selectedPropertyTypeRef = useRef<string | undefined>(selectedPropertyType);
  useEffect(() => {
    selectedPropertyTypeRef.current = selectedPropertyType;
  }, [selectedPropertyType]);

  const selectedLocalityRef = useRef<string>(selectedLocality);
  useEffect(() => {
    selectedLocalityRef.current = selectedLocality;
  }, [selectedLocality]);

  const subTabRef = useRef<string | undefined>(subTab);
  useEffect(() => {
    subTabRef.current = subTab;
  }, [subTab]);

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
    const route = parseRouteFromUrl();

    // Ensure initial entry has internalIndex: 0 and valid state
    if (!window.history.state || typeof window.history.state.internalIndex !== 'number') {
      window.history.replaceState(
        {
          view: route.view,
          propertyType: route.propertyType,
          locality: route.locality,
          subTab: route.subTab,
          roomId: route.roomId,
          internalIndex: 0,
        },
        '',
        window.location.href
      );
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
            const baseView = route.view !== 'property-detail' ? route.view : 'home';
            const cleanUrl = buildRouteUrl(baseView, {
              locality: route.locality,
              propertyType: route.propertyType,
            });
            window.history.replaceState(
              {
                view: baseView,
                propertyType: route.propertyType,
                locality: route.locality,
                internalIndex: 0,
              },
              '',
              cleanUrl.toString()
            );

            currentInternalIndexRef.current = 1;
            const mobileUrl = buildRouteUrl(baseView, {
              locality: route.locality,
              propertyType: route.propertyType,
              roomId: initialRoomId,
            });
            window.history.pushState(
              {
                view: baseView,
                propertyType: route.propertyType,
                locality: route.locality,
                isMobileDetailOpen: true,
                roomId: initialRoomId,
                internalIndex: 1,
              },
              '',
              mobileUrl.toString()
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
      const state = event.state as AppNavigationState | null;
      const url = new URL(window.location.href);

      // Track the internal sequence index
      if (typeof state?.internalIndex === 'number') {
        currentInternalIndexRef.current = state.internalIndex;
      }

      // Handle chat back navigation hierarchy
      if (isChatModalOpenRef.current) {
        // Condition 1: User is popping from an active chat view back to the Messages conversation list
        const isPoppingToMessageList =
          state?.isChatModalOpen === true && !state?.isChatActive;

        if (isPoppingToMessageList || (activeConversationRef.current && state?.isChatModalOpen)) {
          // STEP 3: Individual Chat -> Return to Messages list
          // Clear active conversation selection, stay inside chat modal, do NOT close modal, do NOT navigate away!
          clearActiveConversation();
          return;
        }

        // Condition 2: If popped state is outside the chat modal, close it cleanly
        if (!state?.isChatModalOpen) {
          setIsChatModalOpen(false);
          clearActiveConversation();
        }
      }

      // Handle forward pop into Messages list
      if (!isChatModalOpenRef.current && state?.isChatModalOpen) {
        if (!state?.isChatActive) {
          openMessagesList();
          return;
        }
      }

      // Handle mobile detail sheet closing
      if (isMobileDetailOpenRef.current) {
        setIsMobileDetailOpen(false);
        setSelectedProperty(null);
        document.body.style.overflow = '';
      }

      // Extract target state from popstate or URL
      const roomId = url.searchParams.get('roomId') || url.searchParams.get('room') || state?.roomId;
      const viewParam = url.searchParams.get('view')?.toLowerCase();
      const typeParam = state?.propertyType !== undefined
        ? state.propertyType
        : (url.searchParams.get('type') || url.searchParams.get('propertyType') || undefined);
      const localityParam = state?.locality !== undefined
        ? state.locality
        : (url.searchParams.get('locality') || '');
      const tabParam = state?.subTab !== undefined
        ? state.subTab
        : (url.searchParams.get('tab') || undefined);

      let targetView = state?.view || viewParam || 'home';

      // If popping forward or directly to a room
      if (roomId) {
        if (isMobile) {
          document.body.style.overflow = 'hidden';
          setIsMobileDetailOpen(true);
          if (!selectedPropertyRef.current || selectedPropertyRef.current.id !== roomId) {
            propertyRepository.getPropertyById(roomId, currentUser?.id).then((p) => {
              if (p) setSelectedProperty(p);
            });
          }
          return;
        } else {
          targetView = 'property-detail';
          if (!selectedPropertyRef.current || selectedPropertyRef.current.id !== roomId) {
            propertyRepository.getPropertyById(roomId, currentUser?.id).then((p) => {
              if (p) {
                setSelectedProperty(p);
                setCurrentView('property-detail');
              }
            });
          } else {
            setCurrentView('property-detail');
          }
          return;
        }
      }

      // If moving away from property detail
      setSelectedProperty(null);
      setIsMobileDetailOpen(false);
      document.body.style.overflow = '';

      if (targetView === 'property-detail') {
        targetView = state?.fromView || previousViewRef.current || 'home';
      }

      setSelectedLocality(localityParam);
      setSelectedPropertyType(typeParam);
      setSubTab(tabParam);
      setCurrentView(targetView);

      // Restore scroll position
      const savedScroll = sessionStorage.getItem(`scroll_${targetView}`);
      if (savedScroll) {
        setTimeout(() => {
          window.scrollTo({ top: Number(savedScroll), behavior: 'instant' });
        }, 30);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser?.id, setIsChatModalOpen]);

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
    } else if (action.type === 'chat') {
      if (action.property) {
        openChatForListing(action.property);
      } else if (action.context) {
        openChatWithContext(action.context);
      } else if (action.propertyId) {
        propertyRepository.getPropertyById(action.propertyId).then((p) => {
          if (p) openChatForListing(p);
        });
      }
    } else if (action.type === 'contact-call' || action.type === 'contact-whatsapp') {
      const prop = action.property;
      const propId = action.propertyId || prop?.id;
      if (prop) {
        handleSelectProperty(prop);
      }
      if (propId) {
        propertyRepository.getPropertyContactDetails(propId).then((details) => {
          if (details?.authorized && details.phone_number) {
            const formatted = getPhoneContactDetails(details.phone_number, prop?.title);
            if (formatted) {
              if (action.type === 'contact-call') {
                window.location.href = formatted.telUrl;
              } else {
                window.open(formatted.whatsappUrl, '_blank', 'noopener,noreferrer');
              }
            }
          }
        });
      }
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

  const handleSelectProperty = useCallback((property: Property) => {
    setSelectedProperty(property);

    // Refresh complete property details with owner contact details in background
    if (property?.id) {
      propertyRepository
        .getPropertyById(property.id, currentUser?.id)
        .then((fresh) => {
          if (fresh) {
            setSelectedProperty(fresh);
          }
        })
        .catch((err) => {
          console.warn('Could not refresh selected property details:', err);
        });
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const currentIdx = typeof window.history.state?.internalIndex === 'number'
      ? window.history.state.internalIndex
      : currentInternalIndexRef.current;
    const nextIdx = currentIdx + 1;
    currentInternalIndexRef.current = nextIdx;

    if (isMobile) {
      // --- MOBILE FULL-SCREEN SHEET FLOW (< md) ---
      // Lock background body scroll so the listings screen maintains exact scroll position
      document.body.style.overflow = 'hidden';

      const targetUrl = buildRouteUrl(currentViewRef.current, {
        locality: selectedLocalityRef.current,
        propertyType: selectedPropertyTypeRef.current,
        roomId: property.id,
      });

      const nextState: AppNavigationState = {
        view: currentViewRef.current,
        locality: selectedLocalityRef.current,
        propertyType: selectedPropertyTypeRef.current,
        roomId: property.id,
        isMobileDetailOpen: true,
        fromView: currentViewRef.current,
        internalIndex: nextIdx,
      };

      window.history.pushState(nextState, '', targetUrl.toString());
      setIsMobileDetailOpen(true);
    } else {
      // --- DESKTOP ROUTE FLOW (>= md) ---
      const previousView = currentViewRef.current !== 'property-detail' ? currentViewRef.current : 'home';
      sessionStorage.setItem(`scroll_${previousView}`, String(window.scrollY));

      const targetUrl = buildRouteUrl('property-detail', {
        roomId: property.id,
      });

      const nextState: AppNavigationState = {
        view: 'property-detail',
        locality: selectedLocalityRef.current,
        propertyType: selectedPropertyTypeRef.current,
        roomId: property.id,
        fromView: previousView,
        internalIndex: nextIdx,
      };

      window.history.pushState(nextState, '', targetUrl.toString());
      window.scrollTo({ top: 0, behavior: 'instant' });
      setCurrentView('property-detail');
    }
  }, [currentUser?.id]);

  const handleNavigate = useCallback((view: string, param?: any, options?: { replace?: boolean }) => {
    setIsChatModalOpen(false);
    clearActiveConversation();
    if (isMobileDetailOpenRef.current) {
      setIsMobileDetailOpen(false);
      document.body.style.overflow = '';
    }
    setSelectedProperty(null);

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (view === 'property-detail' && param) {
      handleSelectProperty(param);
      return;
    }

    let nextSubTab = subTabRef.current;
    if (
      param &&
      (view === 'student-dashboard' ||
        view === 'owner-dashboard' ||
        view === 'member-dashboard' ||
        view === 'user-dashboard')
    ) {
      nextSubTab = param;
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
      view = 'member-dashboard';
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
      view = 'add-property';
    }

    if (view === 'home' && param === 'areas') {
      setCurrentView('home');
      setTimeout(() => {
        const el = document.getElementById('areas');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }

    let nextLocality = selectedLocalityRef.current;
    if (view === 'search') {
      nextLocality = param !== undefined ? param : selectedLocalityRef.current;
      setSelectedLocality(nextLocality);
    }

    // Save scroll position for previous view before navigating
    sessionStorage.setItem(`scroll_${currentViewRef.current}`, String(window.scrollY));

    const targetUrl = buildRouteUrl(view, {
      locality: view === 'search' ? nextLocality : '',
      propertyType: view === 'search' ? selectedPropertyTypeRef.current : undefined,
      subTab: nextSubTab,
    });

    const currentIdx = typeof window.history.state?.internalIndex === 'number'
      ? window.history.state.internalIndex
      : currentInternalIndexRef.current;
    const nextIdx = options?.replace ? currentIdx : currentIdx + 1;
    currentInternalIndexRef.current = nextIdx;

    const nextState: AppNavigationState = {
      view,
      locality: view === 'search' ? nextLocality : '',
      propertyType: view === 'search' ? selectedPropertyTypeRef.current : undefined,
      subTab: nextSubTab,
      roomId: null,
      internalIndex: nextIdx,
    };

    if (options?.replace) {
      window.history.replaceState(nextState, '', targetUrl.toString());
    } else {
      window.history.pushState(nextState, '', targetUrl.toString());
    }

    setCurrentView(view);
  }, [requireAuth, handleSelectProperty, setIsChatModalOpen]);

  const handleSearchTrigger = useCallback((locality: string, propertyType?: string, options?: { replace?: boolean }) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSelectedLocality(locality);
    setSelectedPropertyType(propertyType);
    setCurrentView('search');

    // Save scroll position for previous view before navigating
    sessionStorage.setItem(`scroll_${currentViewRef.current}`, String(window.scrollY));

    const targetUrl = buildRouteUrl('search', {
      locality,
      propertyType,
    });

    const currentIdx = typeof window.history.state?.internalIndex === 'number'
      ? window.history.state.internalIndex
      : currentInternalIndexRef.current;
    const nextIdx = options?.replace ? currentIdx : currentIdx + 1;
    currentInternalIndexRef.current = nextIdx;

    const nextState: AppNavigationState = {
      view: 'search',
      locality,
      propertyType,
      subTab: undefined,
      roomId: null,
      internalIndex: nextIdx,
    };

    if (options?.replace) {
      window.history.replaceState(nextState, '', targetUrl.toString());
    } else {
      window.history.pushState(nextState, '', targetUrl.toString());
    }
  }, []);

  const handleMobileClose = useCallback(() => {
    const hasInternalHistory = Boolean(
      window.history.state &&
      typeof window.history.state.internalIndex === 'number' &&
      window.history.state.internalIndex > 0
    );

    if (hasInternalHistory) {
      window.history.back();
    } else {
      setIsMobileDetailOpen(false);
      setSelectedProperty(null);
      document.body.style.overflow = '';
      const fallbackView = previousViewRef.current && previousViewRef.current !== 'property-detail'
        ? previousViewRef.current
        : (selectedPropertyTypeRef.current || selectedLocalityRef.current ? 'search' : 'home');

      handleNavigate(fallbackView, undefined, { replace: true });
    }
  }, [handleNavigate]);

  const handleBackFromProperty = useCallback(() => {
    const hasInternalHistory = Boolean(
      window.history.state &&
      typeof window.history.state.internalIndex === 'number' &&
      window.history.state.internalIndex > 0
    );

    if (hasInternalHistory) {
      window.history.back();
    } else {
      setSelectedProperty(null);
      const fallbackView = previousViewRef.current && previousViewRef.current !== 'property-detail'
        ? previousViewRef.current
        : (selectedPropertyTypeRef.current || selectedLocalityRef.current ? 'search' : 'home');

      handleNavigate(fallbackView, undefined, { replace: true });
    }
  }, [handleNavigate]);

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
                  onManageListing={() => handleNavigate('member-dashboard', 'my-listings')}
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
              <AdminDashboard
                onSelectProperty={handleSelectProperty}
                onNavigateHome={() => handleNavigate('home')}
              />
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
            onManageListing={() => {
              handleMobileClose();
              handleNavigate('member-dashboard', 'my-listings');
            }}
          />
        </div>
      )}

      {/* In-App Incoming Message Toast Notification */}
      <MessageNotificationToast />

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
            <NearbyRoomsProvider>
              <MainApp />
            </NearbyRoomsProvider>
          </LocationProvider>
        </ChatProvider>
      </SavedProvider>
    </AuthProvider>
  );
}
