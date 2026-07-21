import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

type IconType = ComponentType<{ className?: string }>;

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon?: IconType;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="h-14 flex items-center justify-between gap-4 px-4 md:px-6 border-b border-border bg-background shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && (
          <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-foreground leading-tight truncate">{title}</h1>
          {description && (
            <p className="text-[11px] text-muted-foreground leading-tight truncate">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
    </header>
  );
}

export function NavPill({
  to,
  icon: Icon,
  children,
  onClick,
}: {
  to?: string;
  icon?: IconType;
  children: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </>
  );
  if (to) {
    return (
      <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs hover:bg-muted gap-1">
        <Link to={to}>{content}</Link>
      </Button>
    );
  }
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="h-7 px-2 text-xs hover:bg-muted gap-1">
      {content}
    </Button>
  );
}

export function NavDivider() {
  return <div className="h-5 w-px bg-border mx-1" />;
}
