import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ShieldCheck, MapPin } from 'lucide-react';

interface LocationPickerMapProps {
  latitude: number;
  longitude: number;
  onLocationChange: (lat: number, lng: number) => void | Promise<void>;
  localityName?: string;
  className?: string;
}

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  latitude,
  longitude,
  onLocationChange,
  localityName = 'India',
  className = 'h-72 w-full rounded-2xl overflow-hidden',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 16,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href=https://www.openstreetmap.org/copyright>OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Custom marker icon in Midnight Navy & Warm Amber
      const customIcon = L.divIcon({
        className: 'custom-picker-pin',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
            <div style="background-color: #101828; color: #F59E0B; width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 2px solid #F59E0B; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
              📍
            </div>
            <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid #101828;"></div>
            <div style="width: 10px; height: 4px; background: rgba(0,0,0,0.25); border-radius: 50%; margin-top: 1px;"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      // Draggable marker
      const marker = L.marker([latitude, longitude], {
        draggable: true,
        icon: customIcon,
      }).addTo(map);

      marker.bindTooltip('Drag marker to your exact gate/doorstep', {
        permanent: true,
        direction: 'top',
        offset: [0, -36],
      });

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onLocationChange(pos.lat, pos.lng);
      });

      // Click on map to reposition marker
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        onLocationChange(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update marker position when external coords change
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapInstanceRef.current.setView([latitude, longitude], mapInstanceRef.current.getZoom());
    }
  }, [latitude, longitude]);

  return (
    <div className="relative">
      <div ref={mapContainerRef} className={className} />

      {/* Floating Guidance Badge */}
      <div className="absolute top-2.5 right-2.5 z-10 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-[#E2E8F0] shadow-md text-xs font-semibold text-[#101828] flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-[#F59E0B]" />
        <span>Click or drag marker to adjust building spot</span>
      </div>

      {/* Privacy Notice */}
      <div className="mt-2 p-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-xs text-[#92400E] flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-[#D97706] shrink-0" />
        <span>
          <strong>Lister Setup Guarantee:</strong> Your exact marker pin is stored securely for distance search. Public visitors only see an approximate neighborhood area circle (~220m).
        </span>
      </div>
    </div>
  );
};
