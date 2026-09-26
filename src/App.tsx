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
  const { openChatWithContext } = useChat();

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

  const [featuredProperties, setFeaturedProperties] = useState<Property[]>([]);
  const [sampleRoommates, setSampleRoommates] = useState<StudentProfile[]>([]);

  // Track the previous non-detail view for smart back navigation & scroll restoration
  const previousViewRef = useRef<string>('home');

  useEffect(() => {
    if (currentView !== 'property-detail') {
      previousViewRef.current = currentView;
    }
  }, [currentView]);

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

  // History & Deep-Linking Management (Prevents hardware back from exiting the app)
  useEffect(() => {
    // Ensure initial entry has state
    if (!window.history.state) {
      window.history.replaceState({ view: 'home' }, '', window.location.href);
    }

    // Deep link or initial query param check (?roomId=...)
    const initialUrl = new URL(window.location.href);
    const initialRoomId = initialUrl.searchParams.get('roomId');
    if (initialRoomId) {
      propertyRepository.getPropertyById(initialRoomId).then((p) => {
        if (p) {
          setSelectedProperty(p);
          setCurrentView('property-detail');
        }
      });
    }

    const handlePopState = (event: PopStateEvent) => {
      const url = new URL(window.location.href);
      const roomId = url.searchParams.get('roomId');

      if (!roomId) {
        // User popped back from property detail or other route
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
        if (!selectedProperty || selectedProperty.id !== roomId) {
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
  }, [selectedProperty]);

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
    const url = new URL(window.location.href);
    if (url.searchParams.has('roomId')) {
      url.searchParams.delete('roomId');
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

    setCurrentView(view);
  };

  const handleSearchTrigger = (locality: string, propertyType?: string) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSelectedLocality(locality);
    setSelectedPropertyType(propertyType);
    setCurrentView('search');
  };

  const handleSelectProperty = (property: Property) => {
    if (!isAuthenticated) {
      requireAuth(
        `Sign in with Google to view complete room details, verified photos, and contact the owner for "${property.title}".`,
        { type: 'property-detail', propertyId: property.id, property }
      );
      return;
    }

    const previousView = currentView !== 'property-detail' ? currentView : 'home';
    sessionStorage.setItem(`scroll_${previousView}`, String(window.scrollY));

    const url = new URL(window.location.href);
    url.searchParams.set('roomId', property.id);
    window.history.pushState(
      { view: 'property-detail', roomId: property.id, fromView: previousView },
      '',
      url.toString()
    );

    setSelectedProperty(property);
    setCurrentView('property-detail');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

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

            {currentView === 'property-detail' && selectedProperty && (
              <PropertyDetailPage
                property={selectedProperty}
                onBack={handleBackFromProperty}
              />
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
