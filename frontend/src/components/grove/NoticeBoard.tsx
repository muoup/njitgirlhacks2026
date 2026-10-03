import type { ReactNode } from "react";

/**
 * A notice board on a post, for standing in the Scene's clearing. The frame is wood;
 * the face is a flat dark panel so whatever is pinned to it stays easy to read.
 */
export function NoticeBoard({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center px-5 pt-[clamp(78px,11svh,150px)]">
      <div className="relative z-10 w-full max-w-[27rem]">
        <div
          aria-hidden="true"
          className="grove-glow pointer-events-none absolute -inset-x-24 -inset-y-16"
          style={{ background: "radial-gradient(closest-side, rgb(227 171 118 / 0.16), transparent)" }}
        />
        {/* The frame is a separate clipped element so focus rings inside the board are not clipped with it. */}
        <span
          aria-hidden="true"
          className="absolute -inset-3"
          style={{
            background: "linear-gradient(178deg, var(--grove-wood-hi) 50%, var(--grove-wood) 50%)",
            clipPath: "polygon(0 1.2%, 99% 0, 100% 98.6%, 1.2% 100%)",
          }}
        />
        <div className="relative bg-[#14271b] px-6 py-7 sm:px-8">{children}</div>
      </div>
      <div
        aria-hidden="true"
        className="w-5 flex-1"
        style={{ background: "linear-gradient(90deg, var(--grove-wood) 50%, var(--grove-wood-lo) 50%)" }}
      />
    </div>
  );
}
