import { URGENCY, type Urgency } from "@/components/dashboard/overview";

/**
 * A plant drawn as its mushroom. The aura's colour says how much the plant wants from you;
 * a plant that needs you is also drawn wrinkled, so colour is not the only sign. With no
 * urgency, or when `quiet` (nothing measured), the mushroom is unlit.
 * Needs <GroveSymbols /> on the page.
 */
export function PlantMushroom({
  urgency,
  quiet = false,
  className,
}: {
  urgency: Urgency | null;
  quiet?: boolean;
  className?: string;
}) {
  return (
    <svg aria-hidden="true" viewBox="-60 -100 120 112" className={className}>
      {urgency && (
        <g style={{ fill: URGENCY[urgency].color }}>
          <ellipse cy="2" rx="46" ry="6" fillOpacity="0.18" />
          <circle className="grove-glow" cy="-40" r="56" fillOpacity="0.16" />
          <circle cy="-40" r="41" fillOpacity="0.13" />
        </g>
      )}
      <use
        href={urgency === "act" ? "#grove-shroom-wrinkled" : "#grove-shroom"}
        className={urgency === null || quiet ? "grove-unlit" : undefined}
      />
    </svg>
  );
}
