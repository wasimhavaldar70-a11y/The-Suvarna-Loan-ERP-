// ========================================================
// Loading Button Component
// Location: src/components/ui/LoadingButton.tsx
// ========================================================

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'gold';
  children: React.ReactNode;
}

export function LoadingButton({
  loading = false,
  variant = 'primary',
  children,
  className = '',
  disabled,
  ...props
}: LoadingButtonProps) {
  const baseStyle = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed';
  
  let variantStyle = 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm';
  if (variant === 'gold') {
    variantStyle = 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 text-white hover:brightness-105 shadow-md gold-glow';
  } else if (variant === 'secondary') {
    variantStyle = 'bg-slate-100 text-slate-800 hover:bg-slate-200';
  } else if (variant === 'outline') {
    variantStyle = 'border border-slate-200 text-slate-700 bg-white hover:bg-slate-50';
  } else if (variant === 'danger') {
    variantStyle = 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm';
  }

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyle} ${variantStyle} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          <span>Processing...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
