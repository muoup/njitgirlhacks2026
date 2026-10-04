import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { GroveSymbols } from "./GroveSymbols";
import "./grove.css";

/** How far a layer drifts against the pointer, in px at the screen edge. Larger is closer. */
function depth(dx: number, dy: number) {
  return { "--dx": dx, "--dy": dy } as CSSProperties;
}

function Layer({
  dx,
  dy,
  className,
  children,
}: {
  dx: number;
  dy: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div aria-hidden="true" className={cn("grove-layer grove-drift", className)} style={depth(dx, dy)}>
      {children}
    </div>
  );
}

/** Every layer draws on the same 1440 × 900 stage, pinned to the bottom and cropped at the sides. */
function Stage({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" className={className}>
      {children}
    </svg>
  );
}

type Shape = "tree-a" | "tree-b" | "tree-c" | "thicket" | "ridge" | "tuft";

export function Planted({
  shape,
  x,
  y,
  scale = 1,
  flip = false,
  sway,
}: {
  shape: Shape;
  x: number;
  y: number;
  scale?: number;
  flip?: boolean;
  /** Animation timing for trees that sway; omit for things that stand still. */
  sway?: { delay?: number; duration?: number };
}) {
  const use = <use href={`#grove-${shape}`} />;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      {sway ? (
        <g
          className="grove-sway"
          style={{
            animationDelay: sway.delay ? `${sway.delay}s` : undefined,
            animationDuration: sway.duration ? `${sway.duration}s` : undefined,
          }}
        >
          {use}
        </g>
      ) : (
        use
      )}
    </g>
  );
}

const FAIRIES = [
  { x: 260, y: 330, scale: 1, path: "a", duration: 22, delay: 0, glow: 0 },
  { x: 330, y: 470, scale: 0.8, path: "b", duration: 26, delay: -6, glow: -1.1 },
  { x: 500, y: 400, scale: 1.2, path: "c", duration: 30, delay: -11, glow: -2 },
  { x: 640, y: 430, scale: 0.9, path: "a", duration: 24, delay: -9, glow: -0.4 },
  { x: 930, y: 440, scale: 1, path: "b", duration: 28, delay: -3, glow: -1.7 },
  { x: 820, y: 480, scale: 0.8, path: "c", duration: 21, delay: -14, glow: -0.9 },
  { x: 1160, y: 420, scale: 1.1, path: "a", duration: 27, delay: -17, glow: -2.4 },
  { x: 1310, y: 330, scale: 0.9, path: "b", duration: 23, delay: -8, glow: -1.4 },
  { x: 1250, y: 480, scale: 0.8, path: "c", duration: 25, delay: -2, glow: -0.2 },
] as const;

const MUSHROOMS = [
  { x: 640, y: 742, scale: 1, glow: 0 },
  { x: 790, y: 728, scale: 1.5, glow: -1.4 },
  { x: 1010, y: 750, scale: 2, glow: -2.3 },
  { x: 1190, y: 738, scale: 0.9, glow: -0.7 },
] as const;

const FIREFLIES = [
  { left: "41%", top: "58%", delay: "0s, 0s" },
  { left: "57%", top: "66%", delay: "-6s, -2.2s" },
  { left: "66%", top: "60%", delay: "-1.5s, -0.6s" },
  { left: "76%", top: "68%", delay: "-8s, -1.7s" },
  { left: "86%", top: "62%", delay: "-2.5s, -0.3s" },
] as const;

/**
 * The night grove: a side-on stack of low-poly layers that drift against the pointer.
 * `children` stand on the forest floor, behind the foreground grass (the signpost goes here).
 * `backdrop` is for pages where the scene sits behind something else: it is hidden from
 * assistive technology and loses its fireflies, which would otherwise cross the content.
 * The scene is illustrative only and shows no live readings.
 */
export function Scene({ backdrop = false, children }: { backdrop?: boolean; children?: ReactNode }) {
  return (
    <div className="absolute inset-0 isolate">
      <GroveSymbols />

      <Layer dx={4} dy={1}>
        <Stage>
          <polygon points="0,380 1440,310 1440,900 0,900" style={{ fill: "var(--grove-haze)" }} />
          <g transform="translate(1200 230)">
            <circle r="170" fill="rgb(230 234 208 / 0.03)" />
            <circle className="grove-glow" r="112" fill="rgb(230 234 208 / 0.06)" />
            <polygon
              points="62,0 50,36 19,59 -19,59 -50,36 -62,0 -50,-36 -19,-59 19,-59 50,-36"
              style={{ fill: "var(--grove-moon)" }}
            />
            <polygon points="0,0 19,-59 50,-36 62,0" fill="rgb(255 255 255 / 0.3)" />
            <polygon points="0,0 -19,59 -50,36 -62,0" fill="rgb(0 0 0 / 0.09)" />
            <polygon points="0,0 -62,0 -50,-36 -19,-59" fill="rgb(0 0 0 / 0.04)" />
          </g>
        </Stage>
      </Layer>

      <Layer dx={9} dy={2}>
        <Stage className="grove-far">
          <Planted shape="ridge" x={-70} y={552} scale={1.5} />
          <Planted shape="ridge" x={430} y={540} scale={1.3} />
          <Planted shape="ridge" x={1560} y={546} scale={1.4} flip />
          <Planted shape="ridge" x={860} y={536} scale={1.6} />
          <polygon
            className="grove-t1"
            points="0,900 0,548 140,520 300,546 470,512 640,540 820,508 1000,538 1170,514 1320,540 1440,522 1440,900"
          />
        </Stage>
      </Layer>

      <Layer dx={18} dy={4}>
        <Stage className="grove-mid">
          <Planted shape="thicket" x={330} y={652} />
          <Planted shape="thicket" x={1130} y={652} scale={0.9} />
          <Planted shape="tree-c" x={600} y={640} scale={0.82} sway={{}} />
          <Planted shape="tree-a" x={750} y={634} scale={0.8} sway={{ delay: -2.2 }} />
          <Planted shape="tree-b" x={1010} y={632} scale={1.08} sway={{ delay: -4 }} />
          <Planted shape="tree-c" x={1215} y={646} scale={0.82} flip sway={{ delay: -1.3 }} />
          <Planted shape="tree-a" x={1350} y={636} scale={0.85} sway={{ delay: -3.1 }} />
          <polygon
            className="grove-t1"
            points="0,900 0,640 200,622 480,650 760,626 1040,654 1300,630 1440,644 1440,900"
          />
          {/* The one unwatched mushroom: further back, unlit and wrinkled. */}
          <g transform="translate(885 704) scale(1.3)">
            <use href="#grove-shroom-wrinkled" />
          </g>
        </Stage>
      </Layer>

      <Layer dx={24} dy={5}>
        <Stage>
          {FAIRIES.map(fairy => (
            <g key={`${fairy.x}-${fairy.y}`} transform={`translate(${fairy.x} ${fairy.y}) scale(${fairy.scale})`}>
              <g
                className={`grove-float-${fairy.path}`}
                style={{ animationDuration: `${fairy.duration}s`, animationDelay: `${fairy.delay}s` }}
              >
                <circle
                  className="grove-glow"
                  r="20"
                  fill="rgb(243 230 168 / 0.12)"
                  style={{ animationDelay: `${fairy.glow}s` }}
                />
                <g className="grove-flutter">
                  <use href="#grove-fairy-wings" />
                </g>
                <use href="#grove-fairy-body" />
              </g>
            </g>
          ))}
        </Stage>
      </Layer>

      <Layer dx={30} dy={6}>
        <Stage className="grove-near">
          <Planted shape="tree-a" x={14} y={730} scale={2.1} sway={{ duration: 8 }} />
          <Planted shape="tree-c" x={1424} y={738} scale={2.2} flip sway={{ duration: 9, delay: -3 }} />
          <Planted shape="thicket" x={330} y={726} scale={1.1} />
          <polygon
            className="grove-t1"
            points="0,900 0,726 240,712 520,738 820,716 1100,742 1300,724 1440,734 1440,900"
          />
          <polygon points="520,738 820,716 1100,742 800,790" fill="rgb(227 171 118 / 0.05)" />
          <g className="grove-t1">
            <Planted shape="tuft" x={584} y={736} scale={0.7} />
            <Planted shape="tuft" x={712} y={728} scale={0.6} />
            <Planted shape="tuft" x={1138} y={742} scale={0.75} />
          </g>
        </Stage>
      </Layer>

      <div className="grove-layer grove-drift" style={depth(36, 7)}>
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMax slice"
          role={backdrop ? undefined : "img"}
          aria-hidden={backdrop || undefined}
          aria-label={
            backdrop
              ? undefined
              : "A moonlit grove. Four mushrooms glow on the forest floor; behind them, a fifth stands wrinkled and unlit."
          }
        >
          {MUSHROOMS.map(shroom => (
            <g key={shroom.x} transform={`translate(${shroom.x} ${shroom.y}) scale(${shroom.scale})`}>
              <ellipse cy="2" rx="46" ry="6" fill="rgb(227 171 118 / 0.12)" />
              <circle
                className="grove-glow"
                cy="-40"
                r="58"
                fill="rgb(227 171 118 / 0.13)"
                style={{ animationDelay: `${shroom.glow}s` }}
              />
              <use href="#grove-shroom" />
            </g>
          ))}
        </svg>
      </div>

      {children}

      {!backdrop && (
        <Layer dx={42} dy={9} className="pointer-events-none">
          {FIREFLIES.map(fly => (
            <span
              key={fly.left}
              className="grove-firefly"
              style={{ left: fly.left, top: fly.top, animationDelay: fly.delay }}
            />
          ))}
        </Layer>
      )}

      <Layer dx={54} dy={11} className="pointer-events-none">
        <Stage className="fill-grove-front">
          <polygon points="0,900 0,812 180,796 420,818 700,800 980,820 1240,802 1440,814 1440,900" />
          <Planted shape="tuft" x={60} y={808} scale={1.3} />
          <Planted shape="tuft" x={332} y={812} />
          <Planted shape="tuft" x={596} y={808} scale={1.5} />
          <Planted shape="tuft" x={884} y={814} scale={1.1} />
          <Planted shape="tuft" x={1126} y={810} scale={1.6} />
          <Planted shape="tuft" x={1372} y={808} scale={1.2} />
        </Stage>
        {/* More ground under the bottom edge, so drifting up never uncovers what stands behind it. */}
        <div className="absolute inset-x-0 -bottom-3 h-4 bg-grove-front" />
      </Layer>
    </div>
  );
}
