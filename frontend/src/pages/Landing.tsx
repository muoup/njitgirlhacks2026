import { Link } from "react-router";

import { driftWithPointer } from "@/components/grove/parallax";
import { Scene } from "@/components/grove/Scene";
import { Signpost } from "@/components/grove/Signpost";

function Sparkle({ delay }: { delay: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="-8 -8 16 16"
      className="grove-glow hidden size-4 shrink-0 fill-grove-ember sm:block"
      style={{ animationDelay: `${delay}s` }}
    >
      <polygon points="0,-8 2,-2 8,0 2,2 0,8 -2,2 -8,0 -2,-2" />
    </svg>
  );
}

/** One screen, no readings: the scene is the page and the dashboard owns the data. */
export function Landing() {
  return (
    <div
      onPointerMove={driftWithPointer}
      className="relative h-svh min-h-[640px] overflow-hidden bg-grove-sky text-foreground"
    >
      <header className="absolute inset-x-0 top-0 z-20 px-[clamp(20px,6vw,96px)] py-5">
        <Link to="/" className="font-brush text-4xl leading-none text-grove-parchment no-underline">
          loam
        </Link>
      </header>

      <main>
        <div className="absolute inset-x-0 top-[clamp(56px,9svh,110px)] z-10 px-[clamp(20px,6vw,96px)] text-center">
          <h1 className="m-0 -rotate-2 font-brush text-[clamp(3rem,min(1.6rem_+_5vw,10.5svh),7.5rem)] leading-[0.95] font-normal text-grove-parchment">
            The mushrooms know.
          </h1>
          <p className="mt-4 mb-0 flex rotate-1 items-center justify-center gap-3 font-brush text-[clamp(1.4rem,min(1rem_+_1.3vw,3.8svh),2.5rem)] leading-tight text-grove-ember-hi">
            <Sparkle delay={0} />
            They glow when the soil is happy, and wilt when it&rsquo;s thirsty.
            <Sparkle delay={-1.8} />
          </p>
          <p className="mt-5 mb-0 text-[clamp(0.7rem,0.55rem_+_0.3vw,0.95rem)] font-bold tracking-[0.28em] text-grove-mist uppercase">
            A soil monitor for garden beds
          </p>
        </div>

        <Scene>
          <Signpost />
        </Scene>
      </main>
    </div>
  );
}
