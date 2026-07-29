import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[10px] border border-[rgba(148,170,215,0.2)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-base text-foreground placeholder:text-[#8b97ad] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground transition-all focus-visible:outline-none focus-visible:border-[rgba(77,159,255,0.5)] focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
