import type { ReactNode } from "react";

export function TwentyPage({
  children,
  inLayout = false,
}: {
  children: ReactNode;
  /** When true, drop the twenty-theme scope and min-h-screen — use inside a layout that already provides them. */
  inLayout?: boolean;
}) {
  if (inLayout) {
    return <div className="flex flex-col h-full min-h-0">{children}</div>;
  }
  return <div className="twenty-theme min-h-screen flex flex-col">{children}</div>;
}
