import { cn } from "@/lib/utils";

/**
 * The site's name, with what it is set small beneath it. Goes inside the link that leads
 * home, which gives the name its size. With `stacked`, the name takes two lines between a
 * phone and a wide window, and on a phone the line beneath is left out: boards hang there.
 */
export function Brand({ stacked = false }: { stacked?: boolean }) {
  return (
    <>
      loam <span className={cn(stacked && "sm:max-lg:block")}>gnome</span>
      <span className="sr-only">: </span>
      <span
        className={cn(
          "mt-1.5 block font-sans text-[0.6875rem] leading-none font-bold tracking-[0.24em] text-grove-mist/70 uppercase",
          stacked && "max-sm:sr-only",
        )}
      >
        bio-tracker
      </span>
    </>
  );
}
