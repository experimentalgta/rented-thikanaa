import React from 'react';
import { BrandLogo, BrandLogoProps } from './BrandLogo';
import { BrandName, BrandNameProps } from './BrandName';

export interface BrandIdentityProps {
  className?: string;
  logoSize?: BrandLogoProps['size'];
  nameClassName?: string;
  hindi?: boolean;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
}

/**
 * Unified brand identity component combining the official logo emblem
 * and dual-tone typography in a responsive layout.
 */
export const BrandIdentity: React.FC<BrandIdentityProps> = ({
  className = '',
  logoSize = 'md',
  nameClassName = 'text-base sm:text-lg',
  hindi = false,
  subtitle,
  badge,
}) => {
  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 text-left shrink-0 ${className}`}>
      <BrandLogo size={logoSize} priority />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <BrandName className={nameClassName} hindi={hindi} />
          {badge}
        </div>
        {subtitle && (
          typeof subtitle === 'string' ? (
            <p className="text-[11px] text-[#667085] hidden md:block whitespace-nowrap">
              {subtitle}
            </p>
          ) : (
            subtitle
          )
        )}
      </div>
    </div>
  );
};

export { BrandLogo, BrandName };
export default BrandIdentity;
