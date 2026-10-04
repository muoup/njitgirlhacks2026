import { Link } from "react-router";

import { Brand } from "@/components/grove/Brand";
import { Scene } from "@/components/grove/Scene";
import { Board } from "@/components/grove/Signpost";

/** Stand-in for a page that does not exist: the same grove as the sign-in page, dimmed, with the way back on a board. */
export function NotBuilt() {
  return (
    <div className="relative min-h-[max(100svh,640px)] overflow-hidden bg-grove-sky text-foreground">
      <header className="absolute inset-x-0 top-0 z-20 px-[clamp(20px,6vw,96px)] py-5">
        <Link to="/" className="font-brush text-4xl leading-none text-grove-parchment no-underline">
          <Brand />
        </Link>
      </header>

      <main>
        <Scene backdrop>
          <div aria-hidden="true" className="absolute inset-0 bg-grove-sky/60" />
          <div className="absolute inset-x-0 top-[clamp(110px,22svh,220px)] z-10 px-6 text-center">
            <h1 className="m-0 -rotate-1 font-brush text-6xl leading-none font-normal text-grove-parchment">Nothing grows here yet.</h1>
            <p className="mt-4 mb-0 text-grove-mist">This page hasn&rsquo;t been built.</p>
            <div className="mt-8 text-[15px]">
              <Board href="/" variant="plain" className="relative">
                Back to the grove
              </Board>
            </div>
          </div>
        </Scene>
      </main>
    </div>
  );
}
