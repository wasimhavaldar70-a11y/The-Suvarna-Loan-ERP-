// ========================================================
// Touch Card & Error State Components
// Location: src/components/ui/TouchCard.tsx
// ========================================================

import React from 'react';

interface TouchCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function TouchCard({ children, className = '', onClick }: TouchCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-amber-200/80 ${
        onClick ? 'cursor-pointer active:scale-[0.99]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
