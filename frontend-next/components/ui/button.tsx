import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius)] text-sm font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none',
  {
    variants: {
      variant: {
        default:   'bg-[var(--primary)] text-white hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)] active:scale-[0.98]',
        secondary: 'bg-[var(--surface2)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--muted,#E8F1F6)]',
        ghost:     'text-[var(--fg-muted)] hover:bg-[var(--surface2)] hover:text-[var(--fg)]',
        danger:    'bg-[#DC2626] text-white hover:bg-[#B91C1C] active:scale-[0.98]',
        outline:   'border border-[var(--border)] bg-transparent text-[var(--fg)] hover:bg-[var(--surface2)]',
      },
      size: {
        sm:   'h-8  px-3  text-xs',
        md:   'h-10 px-4  text-sm',
        lg:   'h-11 px-6  text-base min-h-[44px]',
        icon: 'h-9  w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            {children}
          </>
        ) : children}
      </Comp>
    )
  },
)
Button.displayName = 'Button'
