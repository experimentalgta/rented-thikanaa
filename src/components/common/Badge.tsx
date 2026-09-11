import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'amber' | 'navy' | 'orange' | 'neutral' | 'subtle';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  const variantStyles = {
    amber: 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]',
    navy: 'bg-[#101828] text-white',
    orange: 'bg-[#FFF7ED] text-[#C2410C] border border-[#FFEDD5]',
    neutral: 'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]',
    subtle: 'bg-white/90 backdrop-blur-sm text-[#111827] shadow-sm border border-black/5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
