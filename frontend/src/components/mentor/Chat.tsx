import { Eraser, SendHorizontal } from "lucide-react";
import { type FormEvent, type Ref, useEffect, useId, useRef, useState } from "react";

import { Plank } from "@/components/dashboard/BandHeader";
import { Confirm } from "@/components/shed/Confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMentor } from "./conversation";
import { MENTORS, type Persona, PERSONAS, STARTERS } from "./mentors";
import type { PendingAction } from "@/lib/api";

/**
 * Chooses who answers. The newcomer starts a conversation of their own, so once something
 * has been asked it checks before changing. `roomy` is larger on a wide window, for the mentor's page.
 */
export function PersonaSwitch({ roomy = false, className }: { roomy?: boolean; className?: string }) {
  const { persona, busy, started, change } = useMentor();
  const name = useId();
  const switches = useRef<HTMLFieldSetElement>(null);
  const [wanted, setWanted] = useState<Persona | null>(null);

  function choose(next: Persona) {
    if (started) setWanted(next);
    else change(next);
  }

  function settle(go: boolean) {
    if (go && wanted) change(wanted);
    setWanted(null);
    switches.current?.querySelector<HTMLInputElement>(`input[value=${go && wanted ? wanted : persona}]`)?.focus();
  }

  return (
    <div className={className}>
      <fieldset
        ref={switches}
        disabled={busy}
        className="m-0 flex w-fit min-w-0 rounded-full border-0 bg-background/70 p-1 disabled:opacity-60"
      >
        <legend className="sr-only">Who answers</legend>
        {PERSONAS.map(id => (
          <label key={id} className="cursor-pointer">
            <input type="radio" name={name} value={id} checked={persona === id} onChange={() => choose(id)} className="peer sr-only" />
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full font-bold text-grove-mist peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/60",
                "px-3 py-1 text-sm",
                roomy && "lg:px-4 lg:py-1.5 lg:text-lg",
              )}
            >
              <span aria-hidden="true" className={cn("size-2.5 rotate-45", roomy && "lg:size-3")} style={{ background: MENTORS[id].color }} />
              {MENTORS[id].label}
            </span>
          </label>
        ))}
      </fieldset>
      {wanted && wanted !== persona && (
        <Confirm
          question={`Change to ${MENTORS[wanted].name}? This conversation will be cleared.`}
          yes="Change"
          onYes={() => settle(true)}
          onNo={() => settle(false)}
          className={cn("mt-3", roomy && "lg:mt-4 lg:text-base")}
        />
      )}
    </div>
  );
}

const SAID = "m-0 max-w-[85%] self-start border-0 border-l-[3px] border-solid bg-card px-4 py-2.5 leading-relaxed";

function ApprovalCard({ action }: { action: PendingAction }) {
  const { busy, decide } = useMentor();
  const expired = Date.parse(action.expiresAt) <= Date.now();
  const pending = action.status === "pending" && !expired;
  return (
    <div role="dialog" aria-label="Approve proposed garden change" className="max-w-[95%] rounded-lg border border-border bg-card p-4">
      <p className="mt-0 font-bold">{action.description}</p>
      {pending ? <>
        <p className="text-sm text-muted-foreground">This change needs your approval.</p>
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => decide(action.id, "approve")}>Approve</Button>
          <Button variant="outline" disabled={busy} onClick={() => decide(action.id, "cancel")}>Cancel</Button>
        </div>
      </> : <p role="status" className="mb-0 text-sm">
        {action.result?.message ?? (action.status === "cancelled" ? "Cancelled. No changes made." : "This proposal expired. Ask for a new one.")}
      </p>}
    </div>
  );
}

/**
 * What has been said so far, newest at the bottom and kept in view. What the mentor says has
 * the colour of their hat down its edge; what you ask is on wood. Give it a height.
 */
export function Conversation({ className }: { className?: string }) {
  const { persona, thread, busy } = useMentor();
  const log = useRef<HTMLDivElement>(null);
  const mentor = MENTORS[persona];

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [thread, busy]);

  return (
    <div
      ref={log}
      role="log"
      aria-label="Conversation"
      // Positioned so the hidden labels inside scroll with it instead of stretching the page.
      // Older words fade out at the top rather than meeting an edge.
      className={cn(
        "relative flex flex-col gap-3 overflow-x-hidden overflow-y-auto mask-[linear-gradient(to_bottom,transparent,black_1.75rem)] px-3 pt-6 pb-3",
        className,
      )}
    >
      {thread.map((message, index) =>
        message.action ? <ApprovalCard key={message.action.id} action={message.action} /> : message.from === "you" ? (
          <p
            key={index}
            className="m-0 max-w-[80%] self-end px-4 py-2.5 leading-relaxed text-grove-parchment"
            style={{
              background: "var(--grove-wood)",
              clipPath: "polygon(0 2px, calc(100% - 3px) 0, 100% calc(100% - 3px), 2px 100%)",
            }}
          >
            <span className="sr-only">You: </span>
            {message.text}
          </p>
        ) : (
          <p key={index} className={SAID} style={{ borderColor: MENTORS[message.from].color }}>
            <span className="sr-only">{MENTORS[message.from].name}: </span>
            {message.text}
          </p>
        ),
      )}
      {busy && (
        <p className={SAID} style={{ borderColor: mentor.color }}>
          <span className="sr-only">{mentor.name} is thinking</span>
          <span aria-hidden="true" className="animate-pulse font-bold tracking-widest">
            &hellip;
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * Where a question is written and sent. Until the first one is asked, it offers a few to
 * start with. `roomy` is for the mentor's page, where it lies on the forest floor: the
 * question box is set in a wooden frame of its own, and everything is larger on a wide window.
 */
export function AskBox({ inputRef, roomy = false, className }: { inputRef?: Ref<HTMLInputElement>; roomy?: boolean; className?: string }) {
  const { persona, draft, setDraft, busy, error, started, ask, refresh, clear } = useMentor();

  function send(event: FormEvent) {
    event.preventDefault();
    ask(draft);
  }

  return (
    <div className={className}>
      {!started && (
        <ul aria-label="Questions to start with" className="m-0 mb-3 flex list-none flex-wrap gap-2 p-0">
          {STARTERS.map(question => (
            <li key={question}>
              <button
                type="button"
                disabled={busy}
                onClick={() => ask(question)}
                className={cn(
                  "cursor-pointer rounded-full border border-border bg-background/70 px-3 py-1 text-sm text-grove-mist outline-none hover:border-grove-ember hover:text-grove-parchment focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:opacity-60",
                  roomy && "lg:px-3.5 lg:py-1.5 lg:text-base",
                )}
              >
                {question}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-0 mb-3 border-l-2 border-grove-act pl-2 text-sm font-bold">
          {error}
        </p>
      )}
      <form onSubmit={send} className={cn("flex gap-2", roomy && "relative isolate p-2")}>
        {roomy && <Plank cut="polygon(0 4px, calc(100% - 2px) 0, 100% calc(100% - 3px), 3px 100%)" />}
        <Input
          ref={inputRef}
          value={draft}
          onChange={event => setDraft(event.target.value)}
          aria-label="Your question"
          placeholder={MENTORS[persona].prompt}
          autoComplete="off"
          maxLength={500}
          className={cn(
            "h-10",
            roomy
              ? "rounded-none border-0 bg-[#14271b] lg:h-12 lg:px-4 lg:text-lg dark:bg-[#14271b]"
              : "bg-background/70 dark:bg-background/70",
          )}
        />
        <Button type="submit" size="lg" className={cn("font-bold", roomy && "rounded-none lg:h-12 lg:px-5 lg:text-lg")} disabled={busy || !draft.trim()}>
          <SendHorizontal aria-hidden="true" />
          Ask
        </Button>
      </form>
      <div className="mt-2 flex justify-between gap-x-2">
        <Button variant="ghost" size="sm" disabled={busy} onClick={refresh} className={cn("text-muted-foreground", roomy && "lg:h-9 lg:text-base")}>
          Refresh garden insights
        </Button>
        {/* Works while a reply is on its way too: the reply is then dropped. */}
        <Button variant="ghost" size="sm" disabled={!started} onClick={clear} className={cn("text-muted-foreground", roomy && "lg:h-9 lg:text-base")}>
          <Eraser aria-hidden="true" />
          <span>
            Clear<span className="max-sm:sr-only"> conversation</span>
          </span>
        </Button>
      </div>
    </div>
  );
}
