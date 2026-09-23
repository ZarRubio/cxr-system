import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius)] text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none',
  {
    variants: {
      variant: {
        default:   'bg-[var(--action)] text-white hover:bg-[#194f3e]',
        secondary: 'bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--surface2)]',
        ghost:     'text-[var(--fg-muted)] hover:bg-[var(--surface2)] hover:text-[var(--fg)]',
        danger:    'bg-[#DC2626] text-white hover:bg-[#B91C1C] active:scale-[0.98]',
        outline:   'border border-[var(--border)] bg-transparent text-[var(--fg)] hover:bg-[var(--surface2)]',
      },
      size: {
        sm:   'h-8  px-3  text-xs',
        md:   'h-10 px-4  text-sm',
        lg:   'h-11 px-6  text-base min-h-[44px]',
        icon: 'h-11 w-11',
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
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {children}
          </>
        ) : children}
      </Comp>
    )
  },
)
Button.displayName = 'Button'
