import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

import { Slot } from '@radix-ui/react-slot';

const buttonVariants = cva(
  // Base styles (mirrors .btn in globals.css)
  'inline-flex items-center justify-center gap-[6px] rounded-lg font-semibold cursor-pointer transition-all border-none outline-none disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]',
        secondary: 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-solid border-[var(--border)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]',
        danger: 'bg-[rgba(239,68,68,0.15)] text-[#f87171] border border-solid border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.25)]',
        'danger-ghost': 'bg-transparent text-[var(--danger)] hover:bg-[rgba(239,68,68,0.05)]',
        ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]',
      },
      size: {
        default: 'px-4 py-2 text-[13px]',
        sm: 'px-2.5 py-1.5 text-[12px]',
        xs: 'px-2 py-1 text-[11px]',
        icon: 'w-8 h-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  icon?: string;
  iconClassName?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      icon,
      iconClassName,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const effectiveSize = size || (icon && !children ? 'icon' : 'default');

    return (
      <Comp
        className={cn(buttonVariants({ variant, size: effectiveSize, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : loading ? (
          <span
            className="material-symbols-outlined animate-spin text-[16px] leading-none shrink-0"
            aria-hidden="true"
          >
            progress_activity
          </span>
        ) : icon ? (
          <span
            className={cn('material-symbols-outlined text-[16px] leading-none shrink-0', iconClassName)}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
