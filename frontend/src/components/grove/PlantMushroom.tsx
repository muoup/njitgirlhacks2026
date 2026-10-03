import type { PlantStatus } from "@/lib/api";

/**
 * A plant drawn as its mushroom: glowing when healthy, wrinkled when it needs care,
 * plain and unlit when no health has been reported. Needs <GroveSymbols /> on the page.
 */
export function PlantMushroom({ status, className }: { status: PlantStatus | undefined; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="-60 -100 120 112" className={className}>
      {status === "healthy" && (
        <>
          <ellipse cy="2" rx="46" ry="6" fill="rgb(227 171 118 / 0.12)" />
          <circle className="grove-glow" cy="-40" r="56" fill="rgb(227 171 118 / 0.14)" />
        </>
      )}
      <use
        href={status === "needs_care" ? "#grove-shroom-wrinkled" : "#grove-shroom"}
        className={status ? undefined : "grove-unlit"}
      />
    </svg>
  );
}
