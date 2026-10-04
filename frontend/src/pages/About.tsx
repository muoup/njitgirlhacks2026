import { Droplets, type LucideIcon, Sun, Thermometer, Wind } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { URGENCY, type Urgency, urgencyLabel } from "@/components/dashboard/overview";
import { Brand } from "@/components/grove/Brand";
import { GroveSymbols } from "@/components/grove/GroveSymbols";
import { PlantMushroom } from "@/components/grove/PlantMushroom";
import { Board } from "@/components/grove/Signpost";
import { MentorsFigure, MonitorFigure, MushroomFigure, Plate, Pressed, RecordFigure } from "@/components/guide/Plate";
import { cn } from "@/lib/utils";

const PARTS = ["One", "Two", "Three", "Four", "Five"];

/** One part of the guide: which part it is, its name, and a rule that ends in a leaf. */
function Part({ number, title, className, children }: { number: number; title: string; className?: string; children: ReactNode }) {
  return (
    <section className={cn("mt-16 sm:mt-24", className)}>
      <p className="m-0 text-xs font-bold tracking-[0.28em] text-muted-foreground uppercase">Part {PARTS[number - 1]}</p>
      <h2 className="mt-1.5 mb-0 font-brush text-[2.5rem] leading-none font-normal sm:text-5xl">{title}</h2>
      <div aria-hidden="true" className="mt-4 mb-7 flex items-center gap-2">
        <span className="h-px flex-1 bg-border" />
        <svg viewBox="0 0 30 16" className="h-4 w-[1.875rem]">
          <polygon points="0,8 9,0 30,8 9,16" fill="#93a06a" />
          <polygon points="0,8 9,0 30,8" fill="#a7b27f" />
        </svg>
      </div>
      {children}
    </section>
  );
}

const STATES: { urgency: Urgency | null; looks: string }[] = [
  { urgency: "ok", looks: "A green glow. Nothing to do." },
  { urgency: "watch", looks: "An amber glow. Look in on it when you pass." },
  { urgency: "act", looks: "Wrinkled, with a red glow. It wants something done today." },
  { urgency: null, looks: "Unlit. Nothing has been measured yet." },
];

// Named as the garden names them.
const MEASURED: { icon: LucideIcon; name: string; unit: string; means: string }[] = [
  { icon: Droplets, name: "Soil", unit: "%", means: "How wet the soil is around the roots." },
  { icon: Sun, name: "Light", unit: "%", means: "How much light reaches the plant." },
  { icon: Thermometer, name: "Warmth", unit: "°C", means: "How warm it is where the plant stands." },
  { icon: Wind, name: "Air quality", unit: "", means: "A reading of the air around it, best compared with its own history." },
];

const PLACES = [
  {
    name: "The garden",
    holds: "A trail through your plants, starting with the ones that need you. Each stop shows the plant’s readings and a note on how it is doing. A garden with a place also gets the week’s weather.",
  },
  {
    name: "The potting shed",
    holds: "Where you start gardens, say where each one grows, and add plants. Each plant gets a key there, which its monitor uses to report.",
  },
  {
    name: "The mentor",
    holds: "Burdock the Gnome and Moss the Wizard take questions about your plants. They know the same things and say them differently.",
  },
];

const STEPS = [
  "Make an account and start a garden.",
  "Add each plant in the potting shed. It comes with a key.",
  "Put the key in the plant’s monitor, and push the monitor into the soil beside it.",
];

/**
 * What the product is and how it works, as a field guide: a sheet of paper lying in the dark
 * grove, with plain words on it and pictures of the grove tipped in.
 */
export function About() {
  return (
    <div className="min-h-svh overflow-x-clip bg-grove-front text-foreground">
      <GroveSymbols />
      <header className="mx-auto flex max-w-[70rem] items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="font-brush text-4xl leading-none text-grove-parchment no-underline">
          <Brand />
        </Link>
        <div className="text-[13px]">
          <Board href="/signin" variant="lit" className="relative">
            Get started
          </Board>
        </div>
      </header>

      <div className="guide-desk mx-auto max-w-[70rem] px-2 sm:px-5">
        <main className="guide-sheet relative px-6 pt-14 pb-16 sm:px-12 sm:pt-20 sm:pb-20">
          <Pressed className="top-[19rem] left-7 hidden w-24 -rotate-6 xl:block" />
          <Pressed className="top-[86rem] right-8 hidden w-28 -scale-x-100 rotate-[8deg] xl:block" />
          <Pressed className="bottom-40 left-9 hidden w-24 rotate-[10deg] xl:block" />

          <div className="relative mx-auto max-w-3xl">
            <div className="text-center">
              <p className="m-0 text-xs font-bold tracking-[0.28em] text-muted-foreground uppercase">A field guide to the grove</p>
              <h1 className="mx-auto mt-3 mb-0 max-w-[14ch] -rotate-1 font-brush text-[clamp(3rem,2rem_+_5vw,5.5rem)] leading-[0.95] font-normal">
                How the mushrooms know
              </h1>
              <p className="mx-auto mt-6 mb-0 max-w-[36rem] text-lg leading-relaxed text-muted-foreground">
                loam gnome is a soil monitor for garden beds. Every plant you grow gets a monitor in its soil and a mushroom in the grove. The
                mushroom shows how the plant is doing, so one look tells you which plant needs you.
              </p>
            </div>

            <Part number={1} title="From the soil to the grove">
              <div className="grid gap-x-9 gap-y-8 sm:grid-cols-3">
                <Plate number={1} next caption="A monitor sits in the soil beside the plant and measures it.">
                  <MonitorFigure />
                </Plate>
                <Plate number={2} cut={1} next caption="Its readings are sent to your garden and kept, so you can look back over them.">
                  <RecordFigure />
                </Plate>
                <Plate number={3} cut={2} caption="The plant’s mushroom glows or wilts to match.">
                  <MushroomFigure />
                </Plate>
              </div>
            </Part>

            <Part number={2} title="Reading a mushroom">
              <ul className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-9 p-0 sm:grid-cols-4">
                {STATES.map(({ urgency, looks }) => (
                  <li key={urgency ?? "none"} className="text-center">
                    <div className="guide-medallion mx-auto grid aspect-square w-32 place-items-center bg-grove-sky">
                      <PlantMushroom urgency={urgency} className="mt-1 w-[86%]" />
                    </div>
                    <p className="mt-3 mb-0 flex items-center justify-center gap-1.5 font-bold">
                      {/* The colour as the garden shows it, on a dark stone so it reads on paper. */}
                      {urgency && (
                        <span aria-hidden="true" className="grid size-4 shrink-0 rotate-45 place-items-center bg-grove-sky">
                          <span className="size-2" style={{ background: URGENCY[urgency].color }} />
                        </span>
                      )}
                      {urgencyLabel(urgency)}
                    </p>
                    <p className="mt-1 mb-0 text-[0.9375rem] leading-snug text-muted-foreground">{looks}</p>
                  </li>
                ))}
              </ul>
            </Part>

            <Part number={3} title="What a monitor measures">
              <dl className="m-0 grid gap-5 px-1 sm:grid-cols-2">
                {MEASURED.map(({ icon: Icon, name, unit, means }) => (
                  <div key={name} className="guide-label px-4 py-3.5">
                    <dt className="flex items-center gap-2 font-bold">
                      <Icon aria-hidden="true" className="size-5 shrink-0 text-(--stamp)" />
                      {name}
                      <span className="ml-auto font-normal text-muted-foreground">{unit}</span>
                    </dt>
                    <dd className="mt-1.5 ml-0 text-[0.9375rem] leading-snug text-muted-foreground">{means}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-7 mb-0 leading-relaxed text-muted-foreground">
                The garden shows each plant&rsquo;s latest readings, and its history over the last 24 hours or 7 days.
              </p>
            </Part>

            <Part number={4} title="Around the grove">
              <div className="grid items-start gap-9 sm:grid-cols-[1fr_17rem]">
                <dl className="m-0 grid gap-6">
                  {PLACES.map(({ name, holds }) => (
                    <div key={name}>
                      <dt className="font-brush text-[1.75rem] leading-none">{name}</dt>
                      <dd className="mt-1.5 ml-0 leading-relaxed text-muted-foreground">{holds}</dd>
                    </div>
                  ))}
                </dl>
                <Plate number={4} cut={1} caption="Burdock and Moss, waiting to be asked." className="mx-auto w-full max-w-[17rem]">
                  <MentorsFigure />
                </Plate>
              </div>
            </Part>

            <Part number={5} title="Setting up">
              <ol className="m-0 grid list-none gap-5 p-0">
                {STEPS.map((step, index) => (
                  <li key={step} className="flex items-baseline gap-4">
                    <span aria-hidden="true" className="w-7 shrink-0 text-center font-brush text-5xl leading-none text-(--stamp)">
                      {index + 1}
                    </span>
                    <span className="text-lg leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 mb-0 leading-relaxed text-muted-foreground">The mushroom lights when its first reading arrives.</p>
            </Part>
          </div>
        </main>
      </div>

      <footer className="relative px-5 pt-14 pb-20 text-center">
        {["left-[22%] top-10", "left-[71%] top-24", "left-[84%] top-8"].map((place, index) => (
          <span key={place} aria-hidden="true" className={cn("grove-firefly", place)} style={{ animationDelay: `${-index * 3}s, ${-index * 1.1}s` }} />
        ))}
        <p className="m-0 font-brush text-4xl leading-tight text-grove-parchment">Go and see for yourself.</p>
        <nav aria-label="Where next" className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-5 text-[17px]">
          <Board href="/signin" variant="lit" className="relative">
            Get started
          </Board>
          <Board href="/" variant="plain" className="relative">
            Back to the grove
          </Board>
        </nav>
      </footer>
    </div>
  );
}
