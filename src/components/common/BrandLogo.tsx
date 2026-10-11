import React from 'react';
import logoPng from '../../assets/logo.png';

export interface BrandLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  alt?: string;
  priority?: boolean;
}

const sizeClasses: Record<string, string> = {
  xs: 'h-7 sm:h-8',
  sm: 'h-8 sm:h-9',
  md: 'h-9 sm:h-10',
  lg: 'h-10 sm:h-12',
  xl: 'h-14 sm:h-16',
  custom: '',
};

/**
 * Reusable official BrandLogo component:
 * - Renders the official Rented Thikanaa emblem
 * - Uses object-contain and natural aspect ratio (w-auto)
 * - Scaled responsively for mobile (h-8 to h-10) and desktop (h-10 to h-12)
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  alt = 'Rented Thikanaa Official Brand Logo',
  priority = false,
}) => {
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <img
      src={logoPng}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={`w-auto object-contain shrink-0 select-none ${sizeClass} ${className}`}
    />
  );
};

export default BrandLogo;
