import React from 'react';

export interface BrandNameProps {
  className?: string;
  hindi?: boolean;
  /** Custom space or separator between parts, default is a small margin */
  separator?: string;
}

/**
 * Reusable official BrandName component enforcing the dual-tone visual identity:
 * - Part 1: "Rented" / "रेंटेड" -> #183661 (Primary Navy, font-bold)
 * - Part 2: "Thikanaa" / "ठिकाना" -> #F26E22 (Accent Orange, font-extrabold)
 */
export const BrandName: React.FC<BrandNameProps> = ({
  className = '',
  hindi = false,
}) => {
  if (hindi) {
    return (
      <span className={`inline-flex items-baseline whitespace-nowrap font-heading ${className}`}>
        <span className="font-bold text-[#183661]">रेंटेड</span>
        <span className="font-extrabold text-[#F26E22] ml-1">ठिकाना</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-baseline whitespace-nowrap font-heading ${className}`}>
      <span className="font-bold text-[#183661]">Rented</span>
      <span className="font-extrabold text-[#F26E22] ml-1">Thikanaa</span>
    </span>
  );
};

export default BrandName;
