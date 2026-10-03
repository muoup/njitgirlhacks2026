import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, LogOut } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";

import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import type { Garden } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

const WOOD = "linear-gradient(182deg, var(--grove-wood-hi) 50%, var(--grove-wood) 50%)";
export const FOCUS = "outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-grove-ember-hi";

/** A cut plank behind its content. Separate from the content so focus outlines are not clipped with it. */
export function Plank({ cut }: { cut: string }) {
  return <span aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: WOOD, clipPath: cut }} />;
}

const BOARD =
  "grove-board relative isolate flex min-w-0 items-center gap-2 px-6 py-2.5 font-brush text-2xl leading-none font-normal text-grove-parchment sm:px-8 sm:text-3xl";
const BOARD_TILT = { "--tilt": "-1.2deg", "--nudge": "0px" } as CSSProperties;
const BOARD_CUT = "polygon(0 8%, 98% 0, 100% 90%, 2% 100%)";

/**
 * A board hanging on two ropes from the top centre of the grove. `beside` is a small board
 * hung next to it, and `children` is the line under it.
 */
function Hanging({ board, beside, children }: { board: ReactNode; beside?: ReactNode; children?: ReactNode }) {
  return (
    // On a phone the board hangs lower, under the wordmark and the name tag, so it can use the full width.
    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center px-4 sm:px-44">
      {/* Kept narrower than the row on a phone, which leaves room for the small board beside it. */}
      <div className={cn("pointer-events-auto relative max-w-full pt-14 sm:pt-5", beside && "max-sm:max-w-[calc(100%-7rem)]")}>
        {["left-[18%]", "right-[18%]"].map(side => (
          <span key={side} aria-hidden="true" className={cn("absolute top-0 h-[3.75rem] w-0.5 bg-[#8a7355] sm:h-6", side)} />
        ))}
        {board}
        {beside && <div className="absolute bottom-0.5 left-full ml-3">{beside}</div>}
      </div>
      {children}
    </div>
  );
}

/** The garden's name on the hanging board. Choosing it lets down the other gardens. */
export function GardenSign({
  gardens,
  gardenId,
  onSelect,
  beside,
  children,
}: {
  gardens: Garden[];
  gardenId: string | undefined;
  onSelect: (gardenId: string) => void;
  beside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Hanging
      beside={beside}
      board={
        <Select value={gardenId ?? ""} onValueChange={onSelect}>
          {/* The tilt is on the board inside, not the trigger: the list is placed against the trigger's box, which has to keep still. */}
          <SelectPrimitive.Trigger aria-label="Garden" className={cn("flex max-w-full cursor-pointer border-0 bg-transparent p-0", FOCUS)}>
            <span className={BOARD} style={BOARD_TILT}>
              <Plank cut={BOARD_CUT} />
              <span className="truncate">
                <SelectPrimitive.Value placeholder="Choose a garden" />
              </span>
              <SelectPrimitive.Icon asChild>
                <ChevronDown className="size-5 shrink-0 opacity-70" />
              </SelectPrimitive.Icon>
            </span>
          </SelectPrimitive.Trigger>
          <SelectContent className="rounded-none border-0 bg-(--grove-wood-lo) shadow-[0_10px_24px_rgb(0_0_0/0.45)]">
            {gardens.map(garden => (
              <SelectItem
                key={garden.id}
                value={garden.id}
                className="cursor-pointer rounded-none py-1.5 font-brush text-2xl leading-none text-grove-parchment focus:bg-(--grove-wood-hi) focus:text-grove-parchment"
              >
                {garden.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {children}
    </Hanging>
  );
}

/** A page's name on the hanging board, as its heading. */
export function TitleSign({ title, beside, children }: { title: string; beside?: ReactNode; children?: ReactNode }) {
  return (
    <Hanging
      beside={beside}
      board={
        <h1 className={cn(BOARD, "m-0")} style={BOARD_TILT}>
          <Plank cut={BOARD_CUT} />
          {title}
        </h1>
      }
    >
      {children}
    </Hanging>
  );
}

/**
 * A small board on its own rope beside the sign, leading to another page. Only the icon
 * shows on narrow screens; `label` is always its name, and `short` is the word painted on it.
 */
export function SideBoard({ to, label, short, children }: { to: string; label: string; short: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={cn(
        "grove-board relative isolate flex items-center gap-1.5 px-3 py-2 font-brush text-xl leading-none text-grove-parchment no-underline",
        FOCUS,
      )}
      style={{ "--tilt": "2.5deg", "--nudge": "0px" } as CSSProperties}
    >
      <span aria-hidden="true" className="absolute bottom-full left-1/2 -z-10 h-40 w-0.5 bg-[#8a7355]" />
      <Plank cut="polygon(0 0, 97% 6%, 100% 100%, 3% 92%)" />
      {children}
      <span className="hidden md:inline">{short}</span>
    </Link>
  );
}

/** The signed-in person's name on a small tag. Opening it shows who is signed in and the way out. */
export function AccountTag({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="absolute top-4 right-4 z-20 flex flex-col items-end sm:right-8">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(value => !value)}
        className={cn(
          "grove-board relative isolate flex max-w-[9rem] cursor-pointer items-center gap-1.5 border-0 bg-transparent py-1.5 pr-3 pl-5",
          "font-brush text-xl leading-none text-grove-parchment sm:max-w-[12rem]",
          FOCUS,
        )}
        style={{ "--tilt": "2deg", "--nudge": "0px" } as CSSProperties}
      >
        <Plank cut="polygon(9% 0, 100% 6%, 99% 94%, 10% 100%, 0 50%)" />
        {/* The first name is enough on the tag; the full name is inside. */}
        <span className="truncate">{user.name.trim().split(/\s+/)[0] || "Account"}</span>
        <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 opacity-70 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div id={panelId} className="relative mt-3 w-56 bg-[#14271b] p-4 text-sm shadow-[0_10px_24px_rgb(0_0_0/0.45)]">
          <span
            aria-hidden="true"
            className="absolute -inset-1.5 -z-10"
            style={{ background: WOOD, clipPath: "polygon(0 3px, calc(100% - 2px) 0, 100% calc(100% - 4px), 3px 100%)" }}
          />
          <p className="m-0 font-bold break-words">{user.name}</p>
          <p className="m-0 break-all text-muted-foreground">{user.email}</p>
          <button
            type="button"
            onClick={onSignOut}
            className={cn(
              "mt-3 flex w-full cursor-pointer items-center justify-center gap-2 border-0 bg-primary px-3 py-1.5 font-sans text-sm font-bold text-primary-foreground hover:bg-primary/90",
              FOCUS,
            )}
          >
            <LogOut aria-hidden="true" className="size-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
