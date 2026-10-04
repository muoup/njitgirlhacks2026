import { Maximize2, MessageCircle, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Link, useLocation } from "react-router";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { AskBox, Conversation, PersonaSwitch } from "./Chat";
import { useMentor } from "./conversation";
import { MentorFigure, MentorFigures } from "./Figures";
import { MENTORS } from "./mentors";

const WOOD = "linear-gradient(178deg, var(--grove-wood-hi) 50%, var(--grove-wood) 50%)";
// The mentor's own page shows the conversation itself; the others are for people not signed in.
const WITHOUT = new Set(["/", "/about", "/signin", "/signup", "/mentor"]);

/**
 * The conversation with the mentor as a sidebar, on every signed-in page but the mentor's
 * own. While it is away the mentor leans in from the edge of the window to be asked.
 * Coming from the mentor's page, it is already out.
 */
export function MentorDock() {
  const session = auth.useSession();
  const { pathname } = useLocation();
  const { persona, open, setOpen } = useMentor();
  const id = useId();
  const here = session.status === "signed-in" && !WITHOUT.has(pathname);

  const cameFrom = useRef(pathname);
  useEffect(() => {
    if (cameFrom.current === "/mentor" && here) setOpen(true);
    cameFrom.current = pathname;
  }, [pathname, here, setOpen]);

  // Opening by hand puts the caret in the question box, and closing gives focus back to the mentor at the edge.
  const input = useRef<HTMLInputElement>(null);
  const peek = useRef<HTMLButtonElement>(null);
  const byHand = useRef(false);
  useEffect(() => {
    if (!byHand.current) return;
    byHand.current = false;
    (open ? input : peek).current?.focus();
  }, [open]);

  function move(next: boolean) {
    byHand.current = true;
    setOpen(next);
  }

  if (!here) return null;
  const mentor = MENTORS[persona];

  return (
    <>
      <button
        ref={peek}
        type="button"
        aria-label={`Ask ${mentor.name}`}
        aria-controls={id}
        inert={open}
        data-away={open}
        onClick={() => move(true)}
        // Clipped to its own box, so the part of the mentor past the window's edge stays out of the page's width.
        className="mentor-peek group fixed right-0 bottom-8 z-40 h-28 w-16 cursor-pointer sm:h-40 sm:w-24 border-0 bg-transparent p-0 outline-none [clip-path:inset(-1rem_0_-1rem_-1rem)]"
      >
        <MentorFigure persona={persona} className="mentor-peek-figure absolute -right-10 bottom-2 w-24 sm:-right-14 sm:w-32" />
        <span
          className="absolute right-0 bottom-0 flex items-center gap-1.5 py-1 pr-2.5 pl-3 font-brush text-xl leading-none text-grove-parchment group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-grove-ember-hi"
          style={{ background: WOOD, clipPath: "polygon(0 12%, 100% 0, 100% 100%, 5% 92%)" }}
        >
          <MessageCircle aria-hidden="true" className="size-4" />
          Ask
        </span>
      </button>

      <aside
        id={id}
        aria-label="Ask the mentor"
        inert={!open}
        data-open={open}
        onKeyDown={event => event.key === "Escape" && move(false)}
        className="mentor-dock pointer-events-none fixed inset-y-0 right-0 z-40 flex w-[min(25rem,100vw)] flex-col pt-2"
      >
        <MentorFigures persona={persona} className="-mb-4 w-32" />
        <div className="pointer-events-auto relative flex min-h-0 flex-1 flex-col pt-2.5 pl-2.5 shadow-[-18px_0_40px_rgb(0_0_0/0.35)]">
          {/* The board's frame shows along its top and left; the rest is past the edge of the window. */}
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: WOOD, clipPath: "polygon(0 6px, 100% 0, 100% 100%, 4px 100%)" }}
          />
          <div className="relative flex min-h-0 flex-1 flex-col bg-[#14271b] px-3 pt-4 pb-4">
            <header className="flex items-start justify-between gap-2 px-1">
              <div className="min-w-0">
                <h2 className="m-0 font-brush text-3xl leading-none font-normal text-grove-parchment">{mentor.name}</h2>
                <PersonaSwitch className="mt-3" />
              </div>
              <div className="flex shrink-0">
                <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
                  <Link to="/mentor" aria-label="Open the mentor's page">
                    <Maximize2 aria-hidden="true" />
                  </Link>
                </Button>
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Close" onClick={() => move(false)}>
                  <X aria-hidden="true" />
                </Button>
              </div>
            </header>
            <Conversation className="mt-2 min-h-0 flex-1" />
            <AskBox inputRef={input} className="px-1 pt-3" />
          </div>
        </div>
      </aside>
    </>
  );
}
