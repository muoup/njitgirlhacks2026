import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Each frame is cut a few pixels out of square, in fixed pixels so tall plaques are not more skewed.
const CUTS = [
  "polygon(0 5px, calc(100% - 3px) 0, 100% calc(100% - 6px), 4px 100%)",
  "polygon(4px 0, 100% 4px, calc(100% - 5px) 100%, 0 calc(100% - 3px))",
  "polygon(0 2px, 100% 6px, calc(100% - 2px) calc(100% - 2px), 5px 100%)",
];

/**
 * The wooden plaque that measured data sits on: an uneven wood frame around a flat dark
 * face, the same board as the sign-in page. Written notes go on paper instead.
 */
export function Plaque({
  title,
  action,
  cut = 0,
  className,
  children,
}: {
  title?: string;
  action?: ReactNode;
  /** Which of the frame shapes to use, so neighbouring plaques differ. */
  cut?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("relative m-2.5", className)}>
      {/* The frame is a separate clipped element so focus rings inside the plaque are not clipped with it. */}
      <span
        aria-hidden="true"
        className="absolute -inset-2.5"
        style={{
          background: "linear-gradient(178deg, var(--grove-wood-hi) 50%, var(--grove-wood) 50%)",
          clipPath: CUTS[cut % CUTS.length],
        }}
      />
      <div className="relative h-full bg-[#14271b] p-4 sm:p-5">
        {(title || action) && (
          <header className="mb-4 flex min-h-8 flex-wrap items-center justify-between gap-3">
            {title && <h2 className="m-0 font-brush text-3xl leading-none font-normal text-grove-parchment">{title}</h2>}
            {action}
          </header>
        )}
        {children}
      </div>
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
