import React, { createContext, useContext, useState, useEffect } from 'react';
import { Property } from '../types';

interface SavedItem {
  property: Property;
  saved_at_price: number;
  saved_date: string;
}

interface SavedContextType {
  savedItems: SavedItem[];
  isSaved: (propertyId: string) => boolean;
  toggleSave: (property: Property) => void;
  savedCount: number;
}

const STORAGE_KEY = 'prayag_living_saved_properties_v1';

const SavedContext = createContext<SavedContextType | undefined>(undefined);

export const SavedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [savedItems, setSavedItems] = useState<SavedItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedItems));
    } catch (e) {}
  }, [savedItems]);

  const isSaved = (propertyId: string) => {
    return savedItems.some((item) => item.property.id === propertyId);
  };

  const toggleSave = (property: Property) => {
    setSavedItems((prev) => {
      const exists = prev.some((item) => item.property.id === property.id);
      if (exists) {
        return prev.filter((item) => item.property.id !== property.id);
      } else {
        return [
          {
            property,
            saved_at_price: property.rent,
            saved_date: new Date().toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
          },
          ...prev,
        ];
      }
    });
  };

  return (
    <SavedContext.Provider
      value={{
        savedItems,
        isSaved,
        toggleSave,
        savedCount: savedItems.length,
      }}
    >
      {children}
    </SavedContext.Provider>
  );
};

export const useSaved = () => {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used within a SavedProvider');
  return ctx;
};
