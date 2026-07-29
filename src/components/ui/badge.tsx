import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "border-[rgba(77,159,255,0.25)] bg-[rgba(77,159,255,0.08)] text-[#9ec8ff]",
        secondary:
          "border-[rgba(148,170,215,0.2)] bg-[rgba(255,255,255,0.02)] text-[#c8d2e4]",
        destructive:
          "border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] text-[#ff6b6b]",
        outline:
          "border-[rgba(148,170,215,0.2)] text-[#c8d2e4]",
        good:
          "border-[rgba(61,220,151,0.3)] bg-[rgba(61,220,151,0.08)] text-[#3ddc97]",
        watch:
          "border-[rgba(245,183,78,0.3)] bg-[rgba(245,183,78,0.08)] text-[#f5b74e]",
        bad:
          "border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] text-[#ff6b6b]",
        muted:
          "border-[rgba(148,170,215,0.15)] bg-transparent text-[#8b97ad]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
