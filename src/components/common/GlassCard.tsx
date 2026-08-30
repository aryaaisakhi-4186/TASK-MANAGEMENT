import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: 'gold' | 'emerald' | 'none';
  variant?: 'default' | 'elevated' | 'subtle';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  glow = 'none',
  variant = 'default',
  ...props
}) => {
  const glowClasses = {
    gold: 'border-amber-400/40 shadow-[0_4px_20px_rgba(218,165,32,0.15)] dark:shadow-glow-gold hover:border-amber-500/60',
    emerald: 'border-emerald-400/40 shadow-[0_4px_20px_rgba(30,81,40,0.15)] dark:shadow-glow-emerald hover:border-emerald-500/60',
    none: 'border-slate-200/90 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600',
  };

  const variantClasses = {
    default: 'bg-white/85 dark:bg-slate-900/75 backdrop-blur-md shadow-sm',
    elevated: 'bg-gradient-to-br from-white/95 to-slate-50/90 dark:from-slate-900/90 dark:to-slate-950/90 backdrop-blur-lg shadow-lg border-slate-200/90 dark:border-slate-800',
    subtle: 'bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm',
  };

  return (
    <div
      className={twMerge(
        clsx(
          'rounded-2xl border transition-all duration-300',
          variantClasses[variant],
          glowClasses[glow],
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
