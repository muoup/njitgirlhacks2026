import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";
import "./note.css";

// The slate is cut a little out of square, a different way for each neighbour.
const SHAPES = [
  "polygon(0 3px, 100% 0, calc(100% - 2px) 100%, 3px calc(100% - 2px))",
  "polygon(2px 0, calc(100% - 3px) 2px, 100% calc(100% - 3px), 0 100%)",
  "polygon(0 0, calc(100% - 2px) 3px, 100% 100%, 2px calc(100% - 3px))",
];

type Leaf = [x: number, y: number, turn: number, scale: number];

// Each vine is drawn with the slate's corner 24 in from the edges of its box, and climbs round that corner.
const CROWN = {
  stem: "M24 96 22 62 25 34 33 25 62 22 96 25 128 20",
  leaves: [
    [23, 82, 155, 1.1],
    [22, 62, -155, 1.2],
    [24, 46, 25, 0.7],
    [44, 24, -65, 1.2],
    [62, 22, 50, 0.7],
    [80, 24, -35, 1.1],
    [104, 24, -120, 1],
    [128, 20, -10, 1],
  ] as Leaf[],
};
const FOOT = {
  stem: "M4 50 36 47 60 50 71 44 73 16",
  leaves: [
    [4, 50, 175, 0.9],
    [22, 48, 140, 1.1],
    [38, 47, -150, 0.7],
    [54, 49, 45, 1.2],
    [71, 44, 25, 1.2],
    [73, 30, -35, 1],
    [73, 16, -100, 1],
  ] as Leaf[],
};
const PETALS = [0, 72, 144, 216, 288];

function Leaves({ leaves, from }: { leaves: Leaf[]; from: number }) {
  return leaves.map(([x, y, turn, scale], index) => (
    <g key={index} transform={`translate(${x} ${y}) rotate(${turn}) scale(${scale})`}>
      {/* Out of step with each other, so the vine never moves as one piece. */}
      <g className="note-leaf" style={{ animationDelay: `${-(from + index) * 1.3}s` }}>
        <polygon points="0,0 6,-5.5 18,0 6,5.5" className="fill-(--vine)" />
        <polygon points="0,0 6,-5.5 18,0" className="fill-(--vine-hi)" />
      </g>
    </g>
  ));
}

/**
 * Written words on a plain dark slate, so they look different from measured numbers. The
 * slate itself is bare and still; a vine grows over two of its corners, and the flower on
 * it is the colour of `light`, or pale without one.
 */
export function Note({
  title,
  light,
  cut = 0,
  className,
  children,
}: {
  title?: string;
  light?: string;
  /** Which way the slate is cut and which corners the vine takes, so neighbouring notes differ. */
  cut?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{ "--shape": SHAPES[cut % SHAPES.length], ...(light && { "--light": light }) } as CSSProperties}
      className={cn("note relative", className)}
    >
      <div className="note-edge">
        <div className="note-face px-5 py-4">
          {title && <p className="m-0 mb-1.5 font-tale text-xl leading-tight text-grove-parchment italic">{title}</p>}
          <p className="m-0 leading-relaxed">{children}</p>
        </div>
      </div>
      <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0", cut % 2 === 1 && "-scale-x-100")}>
        <svg viewBox="0 0 130 96" className="absolute -top-6 -left-6 h-24 w-[8.125rem] overflow-visible">
          <path d={CROWN.stem} className="note-stem" />
          <Leaves leaves={CROWN.leaves} from={0} />
          <g transform="translate(26 26) scale(1.5)">
            <g className="note-bloom">
              {PETALS.map(turn => (
                <g key={turn} transform={`rotate(${turn})`}>
                  <polygon points="0,0 -4,-6.5 0,-11 4,-6.5" className="fill-(--light)" />
                  <polygon points="0,0 0,-11 4,-6.5" fill="rgb(255 255 255 / 0.28)" />
                </g>
              ))}
              <polygon points="0,-3 2.8,-1 1.8,2.5 -1.8,2.5 -2.8,-1" className="fill-grove-ember-hi" />
            </g>
          </g>
        </svg>
        <svg viewBox="0 0 96 72" className="absolute -right-6 -bottom-6 h-18 w-24 overflow-visible">
          <path d={FOOT.stem} className="note-stem" />
          <Leaves leaves={FOOT.leaves} from={CROWN.leaves.length} />
        </svg>
      </div>
    </div>
  );
}
