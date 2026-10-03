import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The flat night-coloured card that measured data sits in. */
export function Panel({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("h-full rounded-xl border bg-card p-5 text-card-foreground", className)}>
      {(title || action) && (
        <header className="mb-4 flex min-h-8 flex-wrap items-center justify-between gap-3">
          {title && <h2 className="m-0 text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** A storybook line with a plain explanation under it, for empty, missing and failed states. */
export function StateMessage({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mx-auto max-w-md py-14 text-center">
      <h2 className="m-0 font-brush text-4xl leading-tight font-normal text-grove-parchment">{title}</h2>
      {children && <p className="mt-3 mb-0 text-muted-foreground">{children}</p>}
      {action && (
        <Button variant="outline" className="mt-6" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-xl bg-muted", className)} />;
}
