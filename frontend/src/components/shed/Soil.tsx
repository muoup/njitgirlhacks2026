import { cn } from "@/lib/utils";
import "./shed.css";

// Where the stones lie in their tile: x, y, size and turn.
const STONES = [
  [110, 90, 1.5, -8],
  [142, 112, 0.7, 30],
  [560, 60, 0.9, 15],
  [700, 300, 1.8, 12],
  [740, 322, 0.8, -30],
  [668, 328, 0.6, -20],
  [320, 380, 1.1, -25],
  [70, 520, 0.8, 40],
  [470, 540, 1.4, 5],
  [506, 556, 0.6, 50],
] as const;

const GRIT = [
  [60, 40, 20], [300, 130, 80], [520, 70, 140], [830, 180, 10], [1040, 60, 200], [150, 300, 110], [420, 350, 60],
  [690, 280, 170], [930, 400, 30], [1080, 330, 90], [90, 560, 150], [350, 620, 0], [610, 540, 70], [860, 660, 120],
  [1020, 590, 40], [230, 740, 100], [560, 730, 190], [770, 480, 50],
] as const;

/** Roots reaching down from the trees that stand at the edge of the grove above. */
function Roots({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 280" className={cn("absolute -top-8", className)}>
      <g className="fill-(--root)">
        <polygon points="18,0 46,0 40,48 50,96 36,150 43,204 38,250 37,204 26,150 38,96 26,48" />
        <polygon points="44,84 80,104 112,98 150,128 112,108 82,116 46,100" />
        <polygon points="38,166 70,196 92,192 118,222 90,202 70,208 40,182" />
        <polygon points="88,0 104,0 100,40 108,84 98,124 102,160 94,124 100,84 92,40" />
        <polygon points="154,0 164,0 162,30 168,58 160,86 162,58 156,30" />
      </g>
      <g className="fill-(--root-hi)">
        <polygon points="18,0 32,0 33,48 44,96 31,150 26,150 38,96 26,48" />
        <polygon points="88,0 96,0 96,40 104,84 100,84 92,40" />
      </g>
    </svg>
  );
}

/**
 * The cut-away earth behind the shed: bands of soil, a few stones and a worm, and roots
 * from the trees above. Each layer repeats at its own size, so the repeats do not line up.
 */
export function Soil() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <svg className="absolute inset-0 size-full">
        <defs>
          <g id="shed-stone">
            <polygon points="-14,2 -8,-9 4,-11 13,-4 12,6 2,10 -9,8" className="fill-(--stone)" />
            <polygon points="-8,-9 4,-11 13,-4 1,-1" className="fill-(--stone-hi)" />
            <polygon points="12,6 2,10 -9,8 1,-1" className="fill-(--stone-lo)" />
          </g>
          {/* Each band meets the tile's left and right edges at the same heights, so it runs on unbroken. */}
          <pattern id="shed-strata" width="1200" height="700" patternUnits="userSpaceOnUse">
            <polygon className="fill-(--soil-hi)" points="0,90 180,70 420,96 700,74 960,98 1200,90 1200,170 940,188 640,160 380,184 150,166 0,170" />
            <polygon className="fill-(--soil-lo)" points="0,330 260,352 540,326 820,350 1040,330 1200,330 1200,440 1000,424 760,452 480,428 220,450 0,440" />
            <polygon className="fill-(--soil-hi)" points="0,560 300,548 620,572 900,552 1200,560 1200,600 880,612 560,596 280,614 0,600" />
          </pattern>
          <pattern id="shed-stones" width="830" height="610" patternUnits="userSpaceOnUse">
            {STONES.map(([x, y, size, turn]) => (
              <use key={`${x}-${y}`} href="#shed-stone" transform={`translate(${x} ${y}) rotate(${turn}) scale(${size})`} />
            ))}
          </pattern>
          <pattern id="shed-grit" width="1130" height="790" patternUnits="userSpaceOnUse">
            <g className="fill-(--stone-lo)">
              {GRIT.map(([x, y, turn]) => (
                <polygon key={`${x}-${y}`} points="0,-4 4,3 -4,3" transform={`translate(${x} ${y}) rotate(${turn})`} />
              ))}
            </g>
            <path
              d="M930,250 l13,-8 l14,6 l12,-9 l14,5"
              fill="none"
              stroke="#7d5347"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </pattern>
        </defs>
        {["shed-strata", "shed-grit", "shed-stones"].map(layer => (
          <rect key={layer} width="100%" height="100%" fill={`url(#${layer})`} />
        ))}
      </svg>
      <Roots className="left-0 w-44 lg:w-64" />
      <Roots className="right-0 w-36 -scale-x-100 lg:w-52" />
    </div>
  );
}
