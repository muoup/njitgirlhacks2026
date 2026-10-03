// Fallen leaves in their tile: x, y, turn, size, and whether the leaf is still green.
const LEAVES = [
  [90, 70, 20, 1, false],
  [118, 96, -50, 0.8, false],
  [400, 150, 110, 1.1, true],
  [690, 60, -20, 0.9, false],
  [790, 260, 70, 1.2, false],
  [540, 330, -100, 0.8, true],
  [210, 400, 40, 1, false],
  [236, 372, 160, 0.7, false],
  [640, 540, -60, 1.1, false],
  [360, 580, 15, 0.9, true],
  [60, 590, -130, 0.8, false],
] as const;

// Ferns in their tile: x, y, size and turn.
const FERNS = [
  [180, 140, 1.2, 10],
  [900, 320, 0.9, 40],
  [470, 620, 1.4, -15],
  [1130, 760, 1, 25],
] as const;

const FRONDS = [0, 62, 118, 185, 240, 301];

/**
 * The ground the trail winds over, seen from above: moss, shade, fallen leaves and ferns.
 * Each layer repeats at its own size, so the repeats do not line up. The stops keep it away
 * from their words with a clearing of their own.
 */
export function ForestFloor() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 size-full">
      <defs>
        <g id="floor-fern">
          {FRONDS.map((turn, index) => (
            <polygon
              key={turn}
              points="0,0 5,-11 0,-28 -5,-11"
              transform={`rotate(${turn}) scale(${index % 2 ? 0.8 : 1})`}
              style={{ fill: `var(--grove-mid-${index % 2 ? 3 : 1})` }}
            />
          ))}
        </g>
        <pattern id="floor-moss" width="1100" height="760" patternUnits="userSpaceOnUse">
          <g className="fill-(--grove-moss)">
            <polygon points="70,130 110,84 180,62 262,70 322,104 334,158 290,196 206,206 128,192 84,166" />
            <polygon points="312,566 344,522 410,500 478,510 520,556 510,616 462,654 388,660 334,632" />
            <polygon points="940,600 980,566 1040,572 1060,620 1010,650 960,640" />
          </g>
          {/* Thicker moss in the middle of a patch, kept off its edges so the patch reads as flat. */}
          <g className="fill-(--grove-moss-hi)">
            <polygon points="140,112 196,92 262,104 286,146 236,170 168,164" />
            <polygon points="372,556 426,536 474,566 462,612 404,624" />
          </g>
          <g className="fill-(--grove-shade)">
            <polygon points="630,300 700,256 810,250 890,300 880,370 790,400 680,390" />
            <polygon points="90,420 130,384 190,392 200,440 150,462 100,452" />
          </g>
        </pattern>
        <pattern id="floor-leaves" width="870" height="650" patternUnits="userSpaceOnUse">
          {LEAVES.map(([x, y, turn, size, green]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${turn}) scale(${size})`}>
              <polygon points="0,-10 5,-2 0,10 -5,-2" style={{ fill: green ? "var(--grove-mid-1)" : "var(--grove-leaf)" }} />
              <polygon points="0,-10 5,-2 0,10" style={{ fill: green ? "var(--grove-mid-2)" : "var(--grove-leaf-hi)" }} />
            </g>
          ))}
        </pattern>
        <pattern id="floor-ferns" width="1290" height="910" patternUnits="userSpaceOnUse">
          {FERNS.map(([x, y, size, turn]) => (
            <use key={`${x}-${y}`} href="#floor-fern" transform={`translate(${x} ${y}) rotate(${turn}) scale(${size})`} />
          ))}
        </pattern>
      </defs>
      {["floor-moss", "floor-leaves", "floor-ferns"].map(layer => (
        <rect key={layer} width="100%" height="100%" fill={`url(#${layer})`} />
      ))}
    </svg>
  );
}
