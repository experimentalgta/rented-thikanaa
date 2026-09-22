import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SavedProvider } from './context/SavedContext';
import { ChatProvider } from './context/ChatContext';
import { LocationProvider } from './context/LocationContext';
import { Header } from './components/layout/Header';
import { MobileNav } from './components/layout/MobileNav';
import { Footer } from './components/layout/Footer';
import { ChatModal } from './components/chat/ChatModal';

import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { PropertyDetailPage } from './pages/PropertyDetailPage';
import { RoommatePage } from './pages/RoommatePage';
import { UserDashboard } from './pages/UserDashboard';
import { AddPropertyPage } from './pages/AddPropertyPage';
import { AdminDashboard } from './pages/AdminDashboard';

import { Property, StudentProfile } from './types';
import { propertyRepository } from './services/propertyRepository';
import { roommateRepository } from './services/roommateRepository';

const MainApp: React.FC = () => {
  const { currentUser } = useAuth();

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

  const handleNavigate = (view: string, param?: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (view === 'property-detail' && param) {
      setSelectedProperty(param);
      setCurrentView('property-detail');
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
      view === 'user-dashboard'
    ) {
      setCurrentView('member-dashboard');
      return;
    }
    if (view === 'owner-add') {
      setCurrentView('add-property');
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
    setSelectedProperty(property);
    setCurrentView('property-detail');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#111827]">
      {/* Universal Desktop & Mobile Header */}
      <Header currentView={currentView} onNavigate={handleNavigate} />

      {/* Main Routed Content */}
      <main className="flex-1">
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
            onAddProperty={() => setCurrentView('add-property')}
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
            onCancel={() => setCurrentView('member-dashboard')}
          />
        )}

        {currentView === 'admin-panel' && (
          <AdminDashboard onSelectProperty={handleSelectProperty} />
        )}
      </main>

      {/* Global In-App Messaging Modal */}
      <ChatModal />

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
