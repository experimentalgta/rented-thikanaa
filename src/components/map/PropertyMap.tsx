import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Property } from '../../types';

interface PropertyMapProps {
  properties: Property[];
  centerCoordinates?: { latitude: number; longitude: number };
  onSelectProperty?: (property: Property) => void;
  className?: string;
  zoom?: number;
}

export const PropertyMap: React.FC<PropertyMapProps> = ({
  properties,
  centerCoordinates,
  onSelectProperty,
  className = 'h-96 w-full rounded-2xl overflow-hidden',
  zoom = 14,
}) => {
  // Determine dynamic default center
  const effectiveCenter = centerCoordinates || (properties.length > 0 && properties[0].display_latitude
    ? { latitude: properties[0].display_latitude, longitude: properties[0].display_longitude || 78.9629 }
    : { latitude: 20.5937, longitude: 78.9629 });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [effectiveCenter.latitude, effectiveCenter.longitude],
        zoom,
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
    if (mapInstanceRef.current && effectiveCenter) {
      mapInstanceRef.current.setView(
        [effectiveCenter.latitude, effectiveCenter.longitude],
        mapInstanceRef.current.getZoom()
      );
    }
  }, [effectiveCenter.latitude, effectiveCenter.longitude]);

  // Render markers using STRICTLY presentation-layer approximate coordinates
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();

    const bounds = L.latLngBounds([]);

    // Reference center circle for the search locality/neighborhood
    const centerCircle = L.circle([effectiveCenter.latitude, effectiveCenter.longitude], {
      radius: 650,
      color: '#101828',
      fillColor: '#F59E0B',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '4, 4',
    }).bindTooltip('Target Area Vicinity', { permanent: false });
    markersGroupRef.current.addLayer(centerCircle);
    bounds.extend([effectiveCenter.latitude, effectiveCenter.longitude]);

    properties.forEach((property) => {
      // STRICT LOCATION PRIVACY:
      // Always use display_latitude / display_longitude (neighborhood jitter).
      // NEVER place marker on exact building/doorstep.
      const mapLat = property.display_latitude || effectiveCenter.latitude;
      const mapLng = property.display_longitude || effectiveCenter.longitude;

      // Draw an approximate neighborhood area circle (~220m) representing general vicinity
      const approxAreaCircle = L.circle([mapLat, mapLng], {
        radius: 220,
        color: '#F59E0B',
        fillColor: '#F59E0B',
        fillOpacity: 0.12,
        weight: 1,
        dashArray: '3, 3',
      });
      markersGroupRef.current?.addLayer(approxAreaCircle);

      // Custom styled HTML marker badge showing rent & neighborhood label
      const markerHtml = `
        <div style="
          background-color: #101828;
          color: #ffffff;
          padding: 4px 9px;
          border-radius: 9999px;
          font-weight: 700;
          font-size: 11px;
          border: 2px solid #F59E0B;
          box-shadow: 0 4px 8px -1px rgba(0,0,0,0.25);
          white-space: nowrap;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:#F59E0B;"></span>
          <span>₹${property.rent.toLocaleString('en-IN')}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-map-marker',
        iconSize: [72, 28],
        iconAnchor: [36, 14],
      });

      const marker = L.marker([mapLat, mapLng], { icon: customIcon });

      const popupContent = document.createElement('div');
      popupContent.style.width = '220px';
      popupContent.innerHTML = `
        <div style="font-family: inherit;">
          <div style="font-weight: 700; font-size: 13px; color: #101828; margin-bottom: 3px;">
            ${property.title}
          </div>
          <div style="font-size: 11px; color: #64748B; margin-bottom: 6px;">
            ${property.locality}${property.city ? ', ' + property.city : ''} ${property.distance_formatted ? `• ${property.distance_formatted}` : ''}
          </div>
          <div style="font-weight: 800; font-size: 14px; color: #101828; margin-bottom: 6px;">
            ₹${property.rent.toLocaleString('en-IN')} <span style="font-size: 10px; font-weight: normal; color: #667085;">/mo</span>
          </div>
          <div style="
            background-color: #FFFBEB;
            border: 1px solid #FDE68A;
            border-radius: 6px;
            padding: 5px 8px;
            font-size: 10px;
            color: #92400E;
            font-weight: 600;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <span>🔒 Approximate location shown for privacy</span>
          </div>
          <button id="btn-view-${property.id}" style="
            width: 100%;
            background-color: #101828;
            color: #ffffff;
            border: none;
            border-radius: 8px;
            padding: 7px 10px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s;
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
    if (properties.length > 1 && bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [properties, onSelectProperty, centerCoordinates]);

  return (
    <div className={`relative ${className} border border-[#E5E7EB] bg-[#F1F5F9]`}>
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {/* Privacy note overlay badge */}
      <div className="absolute bottom-2.5 left-2.5 z-[400] bg-white/95 backdrop-blur-md text-[11px] font-semibold text-[#101828] px-3 py-1.5 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center gap-2 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse"></span>
        <span>Approximate location shown for privacy</span>
      </div>
    </div>
  );
};
