import type { PointerEvent } from "react";

/**
 * Pointer handler for the element that contains the scene. Writes the pointer's offset
 * from the centre (-0.5 to 0.5 on each axis) to --px / --py, which .grove-drift reads.
 */
export function driftWithPointer(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--px", ((event.clientX - rect.left) / rect.width - 0.5).toFixed(3));
  el.style.setProperty("--py", ((event.clientY - rect.top) / rect.height - 0.5).toFixed(3));
}
