import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    // Initial fetch for featured accommodations and roommates across India from Supabase
    propertyRepository
      .searchProperties({})
      .then((res) => {
        setFeaturedProperties(res.properties);
      })
      .catch((err) => {
        console.error('Failed to fetch initial properties from Supabase:', err);
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

  const executePendingAction = (action: PendingAction) => {
    if (action.type === 'property-detail' && (action.property || action.propertyId)) {
      if (action.property) {
        setSelectedProperty(action.property);
        setCurrentView('property-detail');
      } else if (action.propertyId) {
        propertyRepository.getPropertyById(action.propertyId).then((p) => {
          if (p) {
            setSelectedProperty(p);
            setCurrentView('property-detail');
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

  const handleNavigate = (view: string, param?: any) => {
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
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (!isAuthenticated) {
      requireAuth(
        `Sign in with Google to view complete room details, verified photos, and contact the owner for "${property.title}".`,
        { type: 'property-detail', propertyId: property.id, property }
      );
      return;
    }

    setSelectedProperty(property);
    setCurrentView('property-detail');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#111827]">
      {/* Universal Desktop & Mobile Header */}
      <Header currentView={currentView} onNavigate={handleNavigate} />

      {/* Main Routed Content */}
      <main className="flex-1 pb-28 md:pb-0">
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
                onBack={() => setCurrentView('search')}
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
                  setSelectedProperty(newProp);
                  setCurrentView('property-detail');
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
