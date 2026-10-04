/** A fixed number from 0 to 1 for a place in a tile, so the floor is drawn the same way each time. */
function chance(place: number, of: number) {
  const value = Math.sin(place * 127.1 + of * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/** Tufts of grass for one tile: one to each square of a grid, set unevenly in it and clear of the tile's edge. */
function tufts(across: number, down: number, width: number, height: number, seed: number) {
  return Array.from({ length: across * down }, (_, index) => {
    const square = { width: width / across, height: height / down };
    return {
      x: ((index % across) + 0.2 + 0.6 * chance(index, seed)) * square.width,
      y: (Math.floor(index / across) + 0.3 + 0.6 * chance(index, seed + 1)) * square.height,
      size: 0.7 + 0.7 * chance(index, seed + 2),
      lean: chance(index, seed + 3) < 0.5 ? 1 : -1,
      pale: chance(index, seed + 4) < 0.35,
    };
  });
}

// Two tiles of grass of different sizes, so their repeats do not line up.
const GRASS = [
  { id: "floor-grass", width: 560, height: 470, tufts: tufts(6, 5, 560, 470, 1) },
  { id: "floor-grass-far", width: 730, height: 610, tufts: tufts(5, 4, 730, 610, 7) },
];

// Fallen leaves in their tile: x, y, turn, size, and whether the leaf is still green.
const LEAVES = [
  [118, 96, -50, 0.8, false],
  [690, 60, -20, 0.9, false],
  [540, 330, -100, 0.8, true],
  [210, 400, 40, 1, false],
  [640, 540, -60, 1.1, false],
] as const;

// Clover and daisies in the same tile: x, y, size.
const CLOVER = [
  [300, 110, 1],
  [760, 250, 1.2],
  [90, 300, 0.9],
  [430, 520, 1.1],
  [800, 590, 0.9],
] as const;
const DAISIES = [
  [470, 80, 1],
  [60, 520, 0.9],
  [720, 420, 1.1],
  [330, 300, 0.8],
] as const;

const THIRDS = [0, 120, 240];
const SIXTHS = [0, 60, 120, 180, 240, 300];

/**
 * The ground the trail winds over: a lawn at night, with lighter and darker reaches, tufts
 * of grass, clover, daisies and a few fallen leaves. Each layer repeats at its own size, so
 * the repeats do not line up. The stops keep it away from their words with a clearing of
 * their own.
 */
export function ForestFloor() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 size-full">
      <defs>
        {/* Three blades from one root. The fill comes from whoever uses it. */}
        <g id="floor-tuft">
          <path d="M-3 0 Q-4.5 -6 -8 -10 Q-2.5 -7 -0.5 0 Z" />
          <path d="M-1.6 0 Q-1.4 -9 1 -15 Q2.2 -8 1.6 0 Z" />
          <path d="M0.5 0 Q3 -6 8 -8.5 Q5 -3.5 3.2 0 Z" />
        </g>
        <linearGradient id="floor-eaves" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--background)" />
          <stop offset="1" stopColor="var(--background)" stopOpacity="0" />
        </linearGradient>
        <pattern id="floor-reaches" width="1100" height="760" patternUnits="userSpaceOnUse">
          <g className="fill-(--grove-lawn-hi)">
            <ellipse cx="230" cy="150" rx="190" ry="96" transform="rotate(-14 230 150)" />
            <ellipse cx="830" cy="560" rx="210" ry="110" transform="rotate(9 830 560)" />
            <ellipse cx="420" cy="590" rx="120" ry="64" transform="rotate(-24 420 590)" />
          </g>
          <g className="fill-(--grove-lawn-lo)">
            <ellipse cx="760" cy="210" rx="170" ry="84" transform="rotate(18 760 210)" />
            <ellipse cx="150" cy="470" rx="110" ry="60" transform="rotate(-8 150 470)" />
          </g>
        </pattern>
        {GRASS.map(tile => (
          <pattern key={tile.id} id={tile.id} width={tile.width} height={tile.height} patternUnits="userSpaceOnUse">
            {tile.tufts.map(({ x, y, size, lean, pale }) => (
              <use
                key={`${x}-${y}`}
                href="#floor-tuft"
                transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(size * lean).toFixed(2)} ${size.toFixed(2)})`}
                className={pale ? "fill-(--grove-near-1)" : "fill-(--grove-mid-1)"}
              />
            ))}
          </pattern>
        ))}
        <pattern id="floor-scatter" width="870" height="650" patternUnits="userSpaceOnUse">
          {CLOVER.map(([x, y, size]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${size})`} className="fill-(--grove-near-1)">
              {THIRDS.map(turn => (
                <circle key={turn} cy="-3.2" r="3" transform={`rotate(${turn})`} />
              ))}
            </g>
          ))}
          {DAISIES.map(([x, y, size]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${size})`}>
              {SIXTHS.map(turn => (
                <circle key={turn} cy="-3.6" r="2" transform={`rotate(${turn})`} className="fill-(--grove-mist)" fillOpacity="0.7" />
              ))}
              <circle r="2" className="fill-(--grove-ember)" />
            </g>
          ))}
          {LEAVES.map(([x, y, turn, size, green]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${turn}) scale(${size})`}>
              <polygon points="0,-10 5,-2 0,10 -5,-2" style={{ fill: green ? "var(--grove-mid-1)" : "var(--grove-leaf)" }} />
              <polygon points="0,-10 5,-2 0,10" style={{ fill: green ? "var(--grove-mid-2)" : "var(--grove-leaf-hi)" }} />
            </g>
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" className="fill-(--grove-lawn)" />
      {["floor-reaches", ...GRASS.map(tile => tile.id), "floor-scatter"].map(layer => (
        <rect key={layer} width="100%" height="100%" fill={`url(#${layer})`} />
      ))}
      {/* Under the trees the lawn is in their shade, so it meets the grove above without a line. */}
      <rect width="100%" height="140" fill="url(#floor-eaves)" />
    </svg>
  );
}
