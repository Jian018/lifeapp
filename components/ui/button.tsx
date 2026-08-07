import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid/70",
  {
    variants: {
      variant: {
        primary: "bg-acid text-ink hover:bg-[#d7ff72] active:scale-[.98]",
        secondary: "border border-line bg-[#171b20] text-white hover:border-zinc-600 hover:bg-[#1d2228]",
        ghost: "text-zinc-300 hover:bg-white/5 hover:text-white",
        danger: "bg-coral/12 text-coral hover:bg-coral/20",
      },
      size: { default: "h-11", sm: "h-9 min-h-9 rounded-lg px-3 text-xs", lg: "h-12 px-5" },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
