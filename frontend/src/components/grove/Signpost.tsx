import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";

import { cn } from "@/lib/utils";

function Board({
  href,
  variant,
  className,
  children,
}: {
  href: string;
  /** `lit` is the painted, lantern-coloured board; `plain` is bare wood. */
  variant: "lit" | "plain";
  className?: string;
  children: ReactNode;
}) {
  const lit = variant === "lit";
  return (
    <Link
      to={href}
      className={cn(
        "grove-board absolute inline-flex items-center whitespace-nowrap font-brush leading-none no-underline",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-grove-ember-hi",
        lit ? "min-h-[3.5em] pr-[3em] pl-[1.75em] text-primary-foreground" : "min-h-[3em] pr-[1.5em] pl-[2.75em] text-grove-parchment",
        className,
      )}
      style={{ "--tilt": lit ? "-3deg" : "2deg", "--nudge": lit ? "6px" : "-6px" } as CSSProperties}
    >
      {/* The plank is a separate clipped element so the focus outline on the link is not clipped with it. */}
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={
          lit
            ? {
                background: "linear-gradient(176deg, #efc592 48%, var(--grove-ember) 48%)",
                clipPath: "polygon(0 6%, 88% 0, 100% 48%, 89% 100%, 1% 92%)",
              }
            : {
                background: "linear-gradient(183deg, var(--grove-wood-hi) 50%, var(--grove-wood) 50%)",
                clipPath: "polygon(11% 0, 100% 5%, 99% 95%, 12% 100%, 0 52%)",
              }
        }
      />
      <span className={cn("relative", lit ? "text-[1.75em]" : "text-[1.5em]")}>{children}</span>
    </Link>
  );
}

/** The page's two actions, as boards on a signpost standing on the forest floor. */
export function Signpost() {
  return (
    <nav
      aria-label="Start here"
      className="grove-signpost grove-drift"
      style={{ "--dx": 40, "--dy": 8 } as CSSProperties}
    >
      <div
        aria-hidden="true"
        className="grove-glow pointer-events-none absolute -top-[2.5em] left-[4.4em] h-[10.6em] w-[21em]"
        style={{ background: "radial-gradient(closest-side, rgb(227 171 118 / 0.2), transparent)" }}
      />
      <div
        aria-hidden="true"
        className="absolute top-0 -bottom-[1.25em] left-[9.375em] w-[0.875em]"
        style={{
          background: "linear-gradient(90deg, var(--grove-wood) 50%, var(--grove-wood-lo) 50%)",
          clipPath: "polygon(0 0.6em, 50% 0, 100% 0.6em, 100% 100%, 0 100%)",
        }}
      />
      <Board href="/signin" variant="lit" className="top-[1.125em] left-[7.875em]">
        Get started
      </Board>
      <Board href="/about" variant="plain" className="top-[5.75em] right-[8.5em]">
        Learn more
      </Board>
    </nav>
  );
}
