import { SendHorizontal } from "lucide-react";
import { type FormEvent, type Ref, useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMentor } from "./conversation";
import { MENTORS, PERSONAS, STARTERS } from "./mentors";
import type { PendingAction } from "@/lib/api";

/** Chooses who answers. */
export function PersonaSwitch({ className }: { className?: string }) {
  const { persona, busy, change } = useMentor();
  const name = useId();
  return (
    <fieldset disabled={busy} className={cn("m-0 flex w-fit min-w-0 rounded-full border-0 bg-background/70 p-1 disabled:opacity-60", className)}>
      <legend className="sr-only">Who answers</legend>
      {PERSONAS.map(id => (
        <label key={id} className="cursor-pointer">
          <input type="radio" name={name} checked={persona === id} onChange={() => change(id)} className="peer sr-only" />
          <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold text-grove-mist peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/60">
            <span aria-hidden="true" className="size-2.5 rotate-45" style={{ background: MENTORS[id].color }} />
            {MENTORS[id].label}
          </span>
        </label>
      ))}
    </fieldset>
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

/** Where a question is written and sent. Until the first one is asked, it offers a few to start with. */
export function AskBox({ inputRef, className }: { inputRef?: Ref<HTMLInputElement>; className?: string }) {
  const { persona, thread, draft, setDraft, busy, error, ask, refresh } = useMentor();
  const unasked = !thread.some(message => message.from === "you");

  function send(event: FormEvent) {
    event.preventDefault();
    ask(draft);
  }

  return (
    <div className={className}>
      {unasked && (
        <ul aria-label="Questions to start with" className="m-0 mb-3 flex list-none flex-wrap gap-2 p-0">
          {STARTERS.map(question => (
            <li key={question}>
              <button
                type="button"
                disabled={busy}
                onClick={() => ask(question)}
                className="cursor-pointer rounded-full border border-border bg-background/70 px-3 py-1 text-sm text-grove-mist outline-none hover:border-grove-ember hover:text-grove-parchment focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:opacity-60"
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
      <form onSubmit={send} className="flex gap-2">
        <Input
          ref={inputRef}
          value={draft}
          onChange={event => setDraft(event.target.value)}
          aria-label="Your question"
          placeholder={MENTORS[persona].prompt}
          autoComplete="off"
          maxLength={500}
          className="h-10 bg-background/70 dark:bg-background/70"
        />
        <Button type="submit" size="lg" className="font-bold" disabled={busy || !draft.trim()}>
          <SendHorizontal aria-hidden="true" />
          Ask
        </Button>
      </form>
      <Button variant="ghost" size="sm" disabled={busy} onClick={refresh} className="mt-2 text-muted-foreground">
        Refresh garden insights
      </Button>
    </div>
  );
}
