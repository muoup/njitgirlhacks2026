import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { type Persona, PERSONAS } from "./mentors";
import "@/components/grove/grove.css";
import "./mentor.css";

// Facets laid over a shape, the way the mushrooms are shaded.
const LIGHT = "rgb(255 255 255 / 0.14)";
const SHADE = "rgb(0 0 0 / 0.16)";
const SKIN = "#e0a47e";
const INK = "#2b2116";

/** A garden gnome: hat down over the eyes, nose out, mitts on the top of the board. */
function Gnome() {
  return (
    <>
      <polygon points="-50,0 -46,-52 -30,-70 30,-70 46,-52 50,0" fill="#4a8452" />
      <polygon points="-50,0 -46,-52 -30,-70 0,-70 0,0" fill={LIGHT} />
      {/* Sleeves and mitts. */}
      <polygon points="-46,-56 -62,-44 -64,-20 -44,-20 -40,-44" fill="#3c6f45" />
      <polygon points="46,-56 62,-44 64,-20 44,-20 40,-44" fill="#3c6f45" />
      <polygon points="-66,-36 -56,-46 -44,-42 -42,-22 -66,-22" fill={SKIN} />
      <polygon points="66,-36 56,-46 44,-42 42,-22 66,-22" fill={SKIN} />

      <polygon points="-34,-102 34,-102 36,-86 -36,-86" fill={SKIN} />
      <polygon points="-36,-92 36,-92 40,-66 31,-40 21,-48 12,-26 0,-38 -12,-26 -21,-48 -31,-40 -40,-66" fill="#efe7d3" />
      <polygon points="0,-92 36,-92 40,-66 31,-40 21,-48 12,-26 0,-38" fill={SHADE} />
      <polygon points="0,-86 -9,-79 -25,-76 -37,-84 -24,-90 -9,-92" fill="#fffaf0" />
      <polygon points="0,-86 9,-79 25,-76 37,-84 24,-90 9,-92" fill="#fffaf0" />
      <polygon points="-13,-94 -7,-106 7,-106 13,-94 7,-82 -7,-82" fill="#eab491" />
      <polygon points="-7,-106 7,-106 13,-94 0,-94" fill={LIGHT} />
      <polygon points="13,-94 7,-82 -7,-82 0,-94" fill={SHADE} />

      <polygon
        points="-44,-96 -32,-130 -16,-162 2,-184 22,-193 42,-187 53,-170 39,-176 26,-173 23,-158 29,-130 44,-96 0,-105"
        fill="#c94a32"
      />
      <polygon points="-44,-96 -32,-130 -16,-162 2,-184 0,-105" fill={LIGHT} />
      <polygon points="22,-193 42,-187 53,-170 39,-176 26,-173 23,-158 29,-130 44,-96 0,-105 12,-160" fill={SHADE} />
    </>
  );
}

/** A wizard: brimmed hat with a bent tip, eyes showing, a long beard and a staff with a lit stone. */
function Wizard() {
  return (
    <>
      <polygon points="57,0 62,0 61,-140 58,-140" fill="var(--grove-wood-hi)" />
      <circle className="grove-glow" cx="59.5" cy="-152" r="19" fill="rgb(246 220 174 / 0.2)" />
      <polygon points="59.5,-166 69,-152 59.5,-138 50,-152" className="fill-grove-ember" />
      <polygon points="59.5,-166 69,-152 59.5,-152" className="fill-grove-ember-hi" />

      <polygon points="-40,0 -36,-62 -20,-80 20,-80 36,-62 40,0" fill="#45488c" />
      <polygon points="-40,0 -36,-62 -20,-80 0,-80 0,0" fill={LIGHT} />
      {/* The arm that holds the staff. */}
      <polygon points="30,-72 38,-56 62,-78 54,-92" fill="#393b78" />
      <polygon points="53,-94 65,-94 66,-80 54,-80" fill={SKIN} />

      <polygon points="-20,-128 20,-128 22,-102 14,-88 -14,-88 -22,-102" fill={SKIN} />
      <polygon points="-22,-106 -12,-98 0,-100 12,-98 22,-106 22,-78 14,-50 5,-28 0,-16 -5,-28 -14,-50 -22,-78" fill="#dcdad0" />
      <polygon points="0,-100 12,-98 22,-106 22,-78 14,-50 5,-28 0,-16" fill={SHADE} />
      <polygon points="0,-101 -8,-94 -21,-90 -31,-95 -19,-102 -6,-104" fill="#f6f4ea" />
      <polygon points="0,-101 8,-94 21,-90 31,-95 19,-102 6,-104" fill="#f6f4ea" />
      <polygon points="-4,-114 4,-114 7,-103 0,-99 -7,-103" fill="#eab491" />
      <circle cx="-10" cy="-116" r="2.6" fill={INK} />
      <circle cx="10" cy="-116" r="2.6" fill={INK} />
      <polygon points="-19,-124 -5,-121 -6,-118 -18,-120" fill="#f6f4ea" />
      <polygon points="19,-124 5,-121 6,-118 18,-120" fill="#f6f4ea" />

      <polygon points="-54,-124 -30,-134 30,-134 54,-124 30,-119 -30,-119" fill="#393b78" />
      <polygon points="-28,-130 -20,-158 -12,-178 -25,-194 -2,-190 10,-174 20,-152 28,-130" fill="#45488c" />
      <polygon points="-28,-130 -20,-158 -12,-178 -25,-194 0,-130" fill={LIGHT} />
      <polygon points="-28,-130 28,-130 25,-139 -25,-139" className="fill-grove-ember" />
      <polygon points="5,-164 8,-157 5,-150 2,-157" className="fill-grove-ember-hi" />
      <polygon points="-9,-150 -7,-146 -9,-142 -11,-146" className="fill-grove-ember-hi" />
    </>
  );
}

const DRAWN: Record<Persona, ReactNode> = { gnome: <Gnome />, wizard: <Wizard /> };

/**
 * Both mentors, behind the top edge of whatever follows this in a positioned, isolated box.
 * Only `persona` is up; see mentor.css for how they change places.
 */
export function MentorFigures({ persona, className }: { persona: Persona; className?: string }) {
  return (
    <>
      {PERSONAS.map(id => (
        <svg
          key={id}
          aria-hidden="true"
          viewBox="-80 -200 160 200"
          data-up={id === persona}
          // Stands a little way down behind the board, so the board's uneven top edge is what cuts it off.
          className={cn("mentor-figure pointer-events-none absolute inset-x-0 bottom-[calc(100%-1.25rem)] -z-10 mx-auto", className)}
        >
          <g className="mentor-idle">{DRAWN[id]}</g>
        </svg>
      ))}
    </>
  );
}
