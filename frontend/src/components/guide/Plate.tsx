import type { ReactNode } from "react";

import { MentorFigure } from "@/components/mentor/Figures";
import { PERSONAS } from "@/components/mentor/mentors";
import { cn } from "@/lib/utils";
import "@/components/grove/grove.css";
import "./guide.css";

// Each plate is cut a little out of square, a different way for each neighbour.
const CUTS = [
  "polygon(0 4px, 100% 0, calc(100% - 3px) 100%, 3px calc(100% - 3px))",
  "polygon(3px 0, calc(100% - 2px) 3px, 100% calc(100% - 4px), 0 100%)",
  "polygon(0 0, calc(100% - 3px) 4px, 100% 100%, 2px calc(100% - 4px))",
];
const CORNERS = ["-top-1 -left-1", "-top-1 -right-1 rotate-90", "-right-1 -bottom-1 rotate-180", "-bottom-1 -left-1 -rotate-90"];

/**
 * A picture tipped into the field guide: a dark window on the grove, held by four paper
 * corners, with its caption under it. `next` points on to the plate after it in a row.
 */
export function Plate({
  number,
  caption,
  cut = 0,
  next = false,
  className,
  children,
}: {
  number: number;
  caption: ReactNode;
  cut?: number;
  next?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={cn("m-0", className)}>
      <div className="relative">
        <div className="bg-grove-sky" style={{ clipPath: CUTS[cut % CUTS.length] }}>
          {children}
        </div>
        {CORNERS.map(corner => (
          <span key={corner} aria-hidden="true" className={cn("guide-corner", corner)} />
        ))}
        {next && (
          <svg aria-hidden="true" viewBox="0 0 14 20" className="absolute top-1/2 left-full ml-2.5 hidden h-5 w-3.5 -translate-y-1/2 fill-(--stamp) sm:block">
            <polygon points="0,0 14,10 0,20 4,10" />
          </svg>
        )}
      </div>
      <figcaption className="mt-3 text-[0.9375rem] leading-snug text-(--ink-soft)">
        <span className="font-tale text-[1.0625rem] text-(--ink) italic">Fig. {number}.</span> {caption}
      </figcaption>
    </figure>
  );
}

type Leaf = [x: number, y: number, turn: number, scale: number];
const SEEDLING: Leaf[] = [
  [84, 110, -150, 1.5],
  [84, 98, -28, 1.6],
  [84.5, 86, -146, 1.3],
  [85, 76, -36, 1.3],
  [85, 64, -90, 1.2],
];

/** A plant in the ground with its monitor beside it, sending. */
export function MonitorFigure() {
  return (
    <svg aria-hidden="true" viewBox="0 0 240 180" className="block w-full">
      <polygon points="0,104 50,90 110,100 170,84 240,96 240,130 0,130" className="fill-(--grove-far-2)" />
      <polygon points="0,122 240,118 240,180 0,180" fill="#3b2a1a" />
      <polygon points="0,150 70,144 150,156 240,146 240,180 0,180" fill="#2e2014" />
      <polygon points="0,118 60,114 130,119 190,113 240,116 240,125 0,128" className="fill-(--grove-near-1)" />
      <polygon points="24,158 34,152 44,157 41,166 28,167" fill="#4b4237" />
      <polygon points="196,162 208,157 218,163 212,171 200,171" fill="#4b4237" />

      <g className="fill-(--grove-wood-hi)">
        <polygon points="81,124 87,124 85,142 91,162 83,144" />
        <polygon points="83,132 67,146 61,160 71,146" />
        <polygon points="86,136 101,148 107,164 97,150" />
      </g>
      <polygon points="82,125 86,125 86.5,62 84,62" fill="#2c5435" />
      {SEEDLING.map(([x, y, turn, scale]) => (
        <g key={y} transform={`translate(${x} ${y}) rotate(${turn}) scale(${scale})`}>
          <polygon points="0,0 6,-5.5 18,0 6,5.5" fill="#3c6f45" />
          <polygon points="0,0 6,-5.5 18,0" fill="#4a8452" />
        </g>
      ))}

      {/* The monitor: two prongs in the soil under a box with one light. */}
      <polygon points="146,110 150,110 149,160 147,160" fill="#aab5a8" />
      <polygon points="160,110 164,110 163,160 161,160" fill="#aab5a8" />
      <polygon points="137,84 173,82 174,113 136,114" fill="#e9dfc6" />
      <polygon points="155,83 173,82 174,113 155,113.5" fill="rgb(0 0 0 / 0.14)" />
      <circle className="grove-glow" cx="147" cy="94" r="9" fill="rgb(227 171 118 / 0.3)" />
      <polygon points="147,89.5 151.5,94 147,98.5 142.5,94" className="fill-grove-ember" />
      <g fill="none" strokeWidth="3" strokeLinejoin="bevel" className="stroke-grove-ember-hi">
        <polyline className="grove-glow" points="182,76 189,65 182,54" />
        <polyline className="grove-glow" style={{ animationDelay: "-1.2s" }} points="194,82 205,65 194,48" />
        <polyline className="grove-glow" style={{ animationDelay: "-2.4s" }} points="207,88 222,65 207,42" />
      </g>
    </svg>
  );
}

/** A hanging plaque with a line falling across it: the readings, kept. */
export function RecordFigure() {
  return (
    <svg aria-hidden="true" viewBox="0 0 240 180" className="block w-full">
      <g stroke="#8a7355" strokeWidth="2">
        <line x1="80" y1="0" x2="80" y2="34" />
        <line x1="162" y1="0" x2="162" y2="32" />
      </g>
      <polygon points="30,34 212,28 214,150 28,156" className="fill-(--grove-wood)" />
      <polygon points="30,34 212,28 213,89 29,95" className="fill-(--grove-wood-hi)" />
      <polygon points="40,43 203,38 204,141 39,146" fill="#14271b" />
      <g stroke="rgb(201 212 198 / 0.14)" strokeWidth="1.5">
        <line x1="50" y1="68" x2="194" y2="68" />
        <line x1="50" y1="94" x2="194" y2="94" />
        <line x1="50" y1="120" x2="194" y2="120" />
      </g>
      <polyline
        points="52,66 70,72 88,67 106,80 124,78 142,96 160,102 176,118 190,124"
        fill="none"
        strokeWidth="3.5"
        strokeLinejoin="bevel"
        className="stroke-grove-ember"
      />
      <circle className="grove-glow" cx="190" cy="124" r="10" fill="rgb(246 220 174 / 0.28)" />
      <polygon points="190,118 196,124 190,130 184,124" className="fill-grove-ember-hi" />
    </svg>
  );
}

/** The plant's mushroom, lit and well. Needs <GroveSymbols /> on the page. */
export function MushroomFigure() {
  return (
    <svg aria-hidden="true" viewBox="0 0 240 180" className="grove-near block w-full">
      <polygon points="0,112 60,98 120,108 190,92 240,102 240,150 0,150" className="fill-(--grove-far-2)" />
      <polygon points="0,150 80,143 160,151 240,145 240,180 0,180" className="grove-t1" />
      <g transform="translate(120 150) scale(1.3)">
        <g className="fill-grove-ok">
          <ellipse cy="2" rx="46" ry="6" fillOpacity="0.18" />
          <circle className="grove-glow" cy="-40" r="56" fillOpacity="0.16" />
          <circle cy="-40" r="41" fillOpacity="0.13" />
        </g>
        <use href="#grove-shroom" />
      </g>
      <g className="fill-grove-front">
        <use href="#grove-tuft" transform="translate(30 182) scale(0.9)" />
        <use href="#grove-tuft" transform="translate(206 184) scale(1.1)" />
      </g>
    </svg>
  );
}

/** Both mentors side by side, standing on the same ground. */
export function MentorsFigure() {
  return (
    <div aria-hidden="true">
      <div className="flex items-end justify-center px-4 pt-5">
        {PERSONAS.map(persona => (
          <MentorFigure key={persona} persona={persona} className="w-1/2 max-w-44" />
        ))}
      </div>
      <div className="h-4 bg-(--grove-near-1)" />
    </div>
  );
}

const PRESSED: [...Leaf, brown: boolean][] = [
  [58, 194, -25, 1, false],
  [57, 176, -160, 1.1, false],
  [60, 150, -30, 1.2, true],
  [61, 130, -155, 1.1, false],
  [58, 106, -35, 1, false],
  [56, 88, -150, 1, true],
  [58, 64, -40, 0.9, false],
  [60, 46, -145, 0.8, false],
  [58, 12, -90, 0.9, false],
];

/** A sprig pressed flat and taped into the margin. It is only there to be looked at. */
export function Pressed({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 224" className={cn("pointer-events-none absolute", className)}>
      <polyline points="60,216 56,170 62,126 55,84 60,44 58,10" fill="none" stroke="#8a7448" strokeWidth="3" strokeLinejoin="bevel" />
      {PRESSED.map(([x, y, turn, scale, brown]) => (
        <g key={y} transform={`translate(${x} ${y}) rotate(${turn}) scale(${scale})`}>
          <polygon points="0,0 9,-8 30,0 9,8" fill={brown ? "#b39a62" : "#93a06a"} />
          <polygon points="0,0 9,-8 30,0" fill={brown ? "#c2ab75" : "#a7b27f"} />
        </g>
      ))}
      <polygon points="34,200 86,191 88,205 36,214" fill="rgb(255 255 255 / 0.5)" />
    </svg>
  );
}
