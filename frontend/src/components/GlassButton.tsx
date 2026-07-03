import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/utils';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  wrapClassName?: string;
}

export default function GlassButton({ children, className, wrapClassName, type = 'button', ...props }: GlassButtonProps) {
  return (
    <div className={cn('button-wrap glass-button-wrap', wrapClassName)}>
      <button type={type} className={cn('premium-btn glass-button', className)} {...props}>
        <span>{children}</span>
      </button>
      <div className="button-shadow glass-button-shadow" />
    </div>
  );
}