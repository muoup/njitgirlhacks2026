import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

const TILTS = ["-1.4deg", "1deg", "-0.6deg", "1.6deg"];

/**
 * Written words as a slip of paper, so they look different from measured numbers.
 * `pin` is the colour of the pin holding it up; a slip without one is simply laid down.
 */
export function Slip({
  title,
  pin,
  tilt = 0,
  className,
  children,
}: {
  title?: string;
  pin?: string;
  /** Which of the fixed tilts to use, so neighbouring slips lean differently. */
  tilt?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{ "--tilt": TILTS[tilt % TILTS.length] } as CSSProperties}
      className={cn(
        "relative rotate-(--tilt) bg-grove-parchment px-4 pt-5 pb-4 text-[#2b2116] shadow-[0_8px_18px_rgb(0_0_0/0.35)]",
        className,
      )}
    >
      {pin && (
        <svg aria-hidden="true" viewBox="-8 -8 16 16" className="absolute -top-2 left-1/2 size-4 -translate-x-1/2">
          <polygon points="0,-8 7,-2 4,7 -4,7 -7,-2" style={{ fill: pin }} />
          <polygon points="0,-8 7,-2 0,0" fill="rgb(255 255 255 / 0.35)" />
        </svg>
      )}
      {title && <p className="m-0 mb-2 font-brush text-2xl leading-none">{title}</p>}
      <p className="m-0 text-sm leading-relaxed">{children}</p>
    </div>
  );
}
