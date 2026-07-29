import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-white bg-[linear-gradient(135deg,#4d9fff,#2f6bff)] shadow-[0_8px_28px_rgba(47,107,255,0.4),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110",
        destructive:
          "text-white bg-[linear-gradient(135deg,#ff8080,#ff4d4d)] shadow-[0_8px_28px_rgba(255,107,107,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] hover:brightness-110",
        outline:
          "border border-[rgba(148,170,215,0.2)] bg-[rgba(255,255,255,0.02)] text-[#c8d2e4] hover:bg-[rgba(255,255,255,0.04)] hover:text-foreground",
        secondary:
          "border border-[rgba(148,170,215,0.2)] bg-[rgba(255,255,255,0.02)] text-[#c8d2e4] hover:bg-[rgba(255,255,255,0.04)]",
        ghost: "text-[#c8d2e4] hover:bg-[rgba(255,255,255,0.04)] hover:text-foreground",
        link: "text-[#9ec8ff] underline-offset-4 hover:underline font-medium",
        hero:
          "text-white bg-[linear-gradient(135deg,#4d9fff,#2f6bff)] shadow-[0_8px_28px_rgba(47,107,255,0.4),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 hover:shadow-[0_12px_40px_rgba(47,107,255,0.55),inset_0_1px_0_rgba(255,255,255,0.3)]",
        glass:
          "border border-[rgba(148,170,215,0.2)] bg-[rgba(255,255,255,0.02)] text-[#c8d2e4] hover:bg-[rgba(255,255,255,0.04)]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-[10px] px-3",
        lg: "h-11 rounded-[12px] px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
