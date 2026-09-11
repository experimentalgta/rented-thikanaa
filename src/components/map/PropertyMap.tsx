import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Property } from '../../types';

interface PropertyMapProps {
  properties: Property[];
  centerCoordinates?: { latitude: number; longitude: number };
  onSelectProperty?: (property: Property) => void;
  className?: string;
}

export const PropertyMap: React.FC<PropertyMapProps> = ({
  properties,
  centerCoordinates = { latitude: 25.4563, longitude: 81.8546 },
  onSelectProperty,
  className = 'h-96 w-full rounded-2xl overflow-hidden',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerCoordinates.latitude, centerCoordinates.longitude],
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      markersGroupRef.current = markersGroup;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update center when reference coordinates change
  useEffect(() => {
    if (mapInstanceRef.current && centerCoordinates) {
      mapInstanceRef.current.setView(
        [centerCoordinates.latitude, centerCoordinates.longitude],
        mapInstanceRef.current.getZoom()
      );
    }
  }, [centerCoordinates.latitude, centerCoordinates.longitude]);

  // Render markers using presentation-layer fuzzed coordinates (preserving privacy)
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();

    const bounds = L.latLngBounds([]);

    // Reference center circle
    const centerCircle = L.circle([centerCoordinates.latitude, centerCoordinates.longitude], {
      radius: 600,
      color: '#F59E0B',
      fillColor: '#F59E0B',
      fillOpacity: 0.1,
      weight: 1.5,
      dashArray: '4, 4',
    }).bindTooltip('Search Reference Area', { permanent: false });
    markersGroupRef.current.addLayer(centerCircle);
    bounds.extend([centerCoordinates.latitude, centerCoordinates.longitude]);

    properties.forEach((property) => {
      // Use fuzzed coordinates to protect exact house location
      const mapLat = property.display_latitude || property.latitude;
      const mapLng = property.display_longitude || property.longitude;

      // Custom styled HTML marker badge with rent
      const markerHtml = `
        <div style="
          background-color: #101828;
          color: #ffffff;
          padding: 4px 8px;
          border-radius: 9999px;
          font-weight: 700;
          font-size: 11px;
          border: 2px solid #F59E0B;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);
          white-space: nowrap;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <span>₹${property.rent.toLocaleString('en-IN')}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-map-marker',
        iconSize: [64, 28],
        iconAnchor: [32, 14],
      });

      const marker = L.marker([mapLat, mapLng], { icon: customIcon });

      const popupContent = document.createElement('div');
      popupContent.style.width = '200px';
      popupContent.innerHTML = `
        <div style="font-family: inherit;">
          <div style="font-weight: 700; font-size: 13px; color: #101828; margin-bottom: 2px;">
            ${property.title}
          </div>
          <div style="font-size: 11px; color: #64748B; margin-bottom: 6px;">
            ${property.locality} • ${property.distance_formatted || 'Near target'}
          </div>
          <div style="font-weight: 800; font-size: 14px; color: #101828; margin-bottom: 8px;">
            ₹${property.rent.toLocaleString('en-IN')} <span style="font-size: 10px; font-weight: normal; color: #667085;">/mo</span>
          </div>
          <div style="font-size: 10px; color: #94A3B8; font-style: italic; margin-bottom: 6px;">
            🔒 Approximate neighborhood location shown for privacy
          </div>
          <button id="btn-view-${property.id}" style="
            width: 100%;
            background-color: #F59E0B;
            color: #101828;
            border: none;
            border-radius: 8px;
            padding: 6px 10px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
          ">
            View Details
          </button>
        </div>
      `;

      popupContent.querySelector(`#btn-view-${property.id}`)?.addEventListener('click', () => {
        if (onSelectProperty) onSelectProperty(property);
      });

      marker.bindPopup(popupContent);
      markersGroupRef.current?.addLayer(marker);
      bounds.extend([mapLat, mapLng]);
    });

    // Auto-fit if multiple properties exist
    if (properties.length > 0 && bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [properties, onSelectProperty, centerCoordinates]);

  return (
    <div className={`relative ${className} border border-[#E5E7EB] bg-[#F1F5F9]`}>
      <div ref={mapContainerRef} className="w-full h-full" />
      {/* Privacy note overlay badge */}
      <div className="absolute bottom-2 left-2 z-[400] bg-white/90 backdrop-blur-xs text-[10px] text-[#475569] px-2.5 py-1 rounded-md border border-[#E2E8F0] shadow-xs flex items-center gap-1.5 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
        <span>Map pins approximate (~200m) for privacy</span>
      </div>
    </div>
  );
};
