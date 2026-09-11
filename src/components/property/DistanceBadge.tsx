import React from 'react';
import { MapPin } from 'lucide-react';

interface DistanceBadgeProps {
  distanceFormatted?: string;
  className?: string;
}

export const DistanceBadge: React.FC<DistanceBadgeProps> = ({
  distanceFormatted,
  className = '',
}) => {
  if (!distanceFormatted) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#334155] border border-[#E2E8F0] shrink-0 ${className}`}
    >
      <MapPin className="w-3 h-3 text-[#F59E0B]" />
      <span>{distanceFormatted}</span>
    </span>
  );
};
