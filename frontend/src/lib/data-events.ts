import { useEffect } from "react";

export const DATA_CHANGED = "grove:data-changed";
export function notifyDataChanged() { window.dispatchEvent(new Event(DATA_CHANGED)); }

/**
 * Says the page's data has changed every so often, so that what is on it is fetched again
 * without a reload. Nothing is asked for while the page is out of view; it catches up on return.
 */
export function useDataRefresh(everyMs: number) {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") notifyDataChanged();
    };
    const timer = setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [everyMs]);
}
