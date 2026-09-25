import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserLocationState, LocationSource } from '../types';
import { locationRepository } from '../services/locationRepository';
import { evaluateLocationAccuracy } from '../services/location/locationAccuracy';
import { locationService } from '../services/location/locationService';

interface LocationContextType {
  userLocation: UserLocationState;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unsupported';
  isDetecting: boolean;
  error: string | null;
  detectCurrentLocation: () => Promise<UserLocationState | null>;
  setManualLocation: (
    localityName: string,
    lat?: number,
    lng?: number,
    cityName?: string,
    stateName?: string,
    source?: LocationSource,
    districtName?: string
  ) => void;
  clearLocation: () => void;
  isPromptDismissed: boolean;
  dismissPrompt: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const EMPTY_LOCATION: UserLocationState = {
  latitude: undefined,
  longitude: undefined,
  country: 'India',
  countryCode: 'IN',
  state: undefined,
  stateCode: undefined,
  district: undefined,
  city: undefined,
  citySlug: undefined,
  locality: '',
  localitySlug: undefined,
  displayName: '',
  source: 'none',
};

const SAVED_LOCATION_KEY = 'rented_thikan_user_location_v1';
const PROMPT_DISMISSED_KEY = 'rented_thikan_location_prompt_dismissed_v1';

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userLocation, setUserLocation] = useState<UserLocationState>(() => {
    try {
      const saved = localStorage.getItem(SAVED_LOCATION_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return EMPTY_LOCATION;
  });

  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>(() => {
    if (typeof window !== 'undefined' && !('geolocation' in navigator)) {
      return 'unsupported';
    }
    return 'prompt';
  });

  const [isPromptDismissed, setIsPromptDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(PROMPT_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        if (result.state === 'granted') {
          setPermissionState('granted');
        } else if (result.state === 'denied') {
          setPermissionState('denied');
        } else {
          setPermissionState('prompt');
        }

        result.onchange = () => {
          if (result.state === 'granted') {
            setPermissionState('granted');
            setError(null);
          } else if (result.state === 'denied') {
            setPermissionState('denied');
            setError('Location access is turned off. You can search for an area manually.');
          } else {
            setPermissionState('prompt');
          }
        };
      }).catch(() => {
        // Ignore permissions query failure
      });
    }
  }, []);

  const detectCurrentLocation = useCallback(async (): Promise<UserLocationState | null> => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setPermissionState('unsupported');
      setError('Location detection is not supported on this browser/device.');
      return null;
    }

    setIsDetecting(true);
    setError(null);

    try {
      const detected = await locationService.detectLocation();
      const detectedLoc = locationService.toUserLocationState(detected);

      setUserLocation(detectedLoc);
      try {
        localStorage.setItem(SAVED_LOCATION_KEY, JSON.stringify(detectedLoc));
      } catch {}

      setPermissionState('granted');
      setIsDetecting(false);

      if (detected.isLowAccuracy) {
        setError(`GPS accuracy is low (~${Math.round(detected.accuracy)}m). Double-check your area.`);
      } else {
        setError(null);
      }
      return detectedLoc;
    } catch (err: any) {
      setIsDetecting(false);
      if (err.code === 1) {
        setPermissionState('denied');
        setError('Location access was denied. You can search for your location manually.');
      } else if (err.code === 2) {
        setError("We couldn't detect your location. Try searching your area manually.");
      } else if (err.code === 3) {
        setError('Location request timed out. Try again or choose your location manually.');
      } else {
        setError(err.message || "We couldn't detect your location. Try choosing your location manually.");
      }
      return null;
    }
  }, []);

  const setManualLocation = useCallback(
    (
      localityName: string,
      lat?: number,
      lng?: number,
      cityName?: string,
      stateName?: string,
      source: LocationSource = 'manual',
      districtName?: string
    ) => {
      let finalLat = lat;
      let finalLng = lng;
      let finalCity = cityName;
      let finalState = stateName;
      let finalLocality = localityName;
      let finalDistrict = districtName;

      // Auto-resolve missing coordinates or context if not provided
      if (!finalLat || !finalLng || !finalCity) {
        const foundLoc = locationRepository.getLocalityBySlugOrName(localityName, cityName);
        if (foundLoc) {
          finalLat = finalLat || foundLoc.latitude;
          finalLng = finalLng || foundLoc.longitude;
          finalCity = finalCity || foundLoc.city_name;
          finalState = finalState || foundLoc.state_name;
          finalDistrict = finalDistrict || foundLoc.district;
          finalLocality = foundLoc.name;
        } else {
          const foundCity = locationRepository.getCityBySlugOrName(localityName);
          if (foundCity) {
            finalLat = finalLat || foundCity.latitude;
            finalLng = finalLng || foundCity.longitude;
            finalCity = foundCity.name;
            finalState = foundCity.state_name;
            finalDistrict = finalDistrict || foundCity.district;
            finalLocality = foundCity.name;
          }
        }
      }

      let displayName = finalLocality;
      if (finalCity && finalCity !== finalLocality) {
        displayName = `${finalLocality}, ${finalCity}`;
      }

      const evalAccuracy = evaluateLocationAccuracy(undefined, source);

      const manualLoc: UserLocationState = {
        latitude: finalLat,
        longitude: finalLng,
        country: 'India',
        countryCode: 'IN',
        locality: finalLocality,
        city: finalCity,
        district: finalDistrict,
        state: finalState,
        displayName,
        formattedAddress: `${displayName}${finalState ? ', ' + finalState : ''}`,
        source,
        accuracyLabel: evalAccuracy.accuracyLabel,
        isLowAccuracy: false,
        timestamp: Date.now(),
      };

      setUserLocation(manualLoc);
      try {
        localStorage.setItem(SAVED_LOCATION_KEY, JSON.stringify(manualLoc));
      } catch {}
      setError(null);
    },
    []
  );

  const clearLocation = useCallback(() => {
    setUserLocation(EMPTY_LOCATION);
    try {
      localStorage.removeItem(SAVED_LOCATION_KEY);
    } catch {}
    setError(null);
  }, []);

  const dismissPrompt = useCallback(() => {
    setIsPromptDismissed(true);
    try {
      sessionStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
    } catch {}
  }, []);

  return (
    <LocationContext.Provider
      value={{
        userLocation,
        permissionState,
        isDetecting,
        error,
        detectCurrentLocation,
        setManualLocation,
        clearLocation,
        isPromptDismissed,
        dismissPrompt,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within a LocationProvider');
  return ctx;
};
