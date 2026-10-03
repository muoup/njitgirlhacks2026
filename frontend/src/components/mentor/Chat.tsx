import { SendHorizontal } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { Plaque } from "@/components/dashboard/Panel";
import { Slip } from "@/components/dashboard/ParchmentNote";
import { useAction } from "@/components/shed/action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MentorFigures } from "./Figures";
import { askMentor, type ChatMessage, MENTORS, type Persona, PERSONAS } from "./mentors";

/** Chooses who answers. */
function PersonaSwitch({ persona, disabled, onChange }: { persona: Persona; disabled: boolean; onChange: (persona: Persona) => void }) {
  const name = useId();
  return (
    <fieldset disabled={disabled} className="m-0 flex min-w-0 rounded-full border-0 bg-background/70 p-1 disabled:opacity-60">
      <legend className="sr-only">Who answers</legend>
      {PERSONAS.map(id => (
        <label key={id} className="cursor-pointer">
          <input type="radio" name={name} checked={persona === id} onChange={() => onChange(id)} className="peer sr-only" />
          <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold text-grove-mist peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/60">
            <span aria-hidden="true" className="size-2.5 rotate-45" style={{ background: MENTORS[id].color }} />
            {MENTORS[id].label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * The conversation with the mentor, on a board they look over the top of. What the mentor
 * says is on paper, pinned in the colour of their hat; what you ask is on wood.
 */
export function Chat() {
  const [persona, setPersona] = useState<Persona>("gnome");
  const [thread, setThread] = useState<ChatMessage[]>([{ from: "gnome", text: MENTORS.gnome.greeting }]);
  const [draft, setDraft] = useState("");
  const asking = useAction();
  const log = useRef<HTMLDivElement>(null);
  const mentor = MENTORS[persona];

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [thread, asking.busy]);

  function change(next: Persona) {
    setPersona(next);
    // The newcomer says hello. If the one leaving had only just said theirs, it goes with them.
    setThread(current => {
      const last = current.at(-1);
      const greeted = last && last.from !== "you" && last.text === MENTORS[last.from].greeting;
      return [...(greeted ? current.slice(0, -1) : current), { from: next, text: MENTORS[next].greeting }];
    });
  }

  function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || asking.busy) return;
    const asked: ChatMessage[] = [...thread, { from: "you", text }];
    setThread(asked);
    setDraft("");
    asking.run(async () => {
      const reply = await askMentor(persona, asked);
      setThread(current => [...current, { from: persona, text: reply }]);
    });
  }

  return (
    <div className="relative isolate">
      <MentorFigures persona={persona} className="w-32 sm:w-44" />
      <Plaque
        title={mentor.name}
        cut={1}
        action={<PersonaSwitch persona={persona} disabled={asking.busy} onChange={change} />}
      >
        <div
          ref={log}
          role="log"
          aria-label="Conversation"
          // As tall as the window leaves room for, so the question box stays in view without scrolling the page.
          // Positioned so the hidden labels inside scroll with it instead of stretching the page.
          className="relative flex h-[clamp(11rem,100svh_-_41rem,24rem)] flex-col gap-4 overflow-x-hidden overflow-y-auto px-1.5 pt-3 pb-2 sm:h-[clamp(12rem,100svh_-_38rem,24rem)]"
        >
          {thread.map((message, index) =>
            message.from === "you" ? (
              <p
                key={index}
                className="m-0 max-w-[85%] self-end px-3.5 py-2 text-sm leading-relaxed text-grove-parchment"
                style={{
                  background: "var(--grove-wood)",
                  clipPath: "polygon(0 2px, calc(100% - 3px) 0, 100% calc(100% - 3px), 2px 100%)",
                }}
              >
                <span className="sr-only">You: </span>
                {message.text}
              </p>
            ) : (
              <Slip key={index} pin={MENTORS[message.from].color} tilt={index} className="max-w-[85%] self-start">
                <span className="sr-only">{MENTORS[message.from].name}: </span>
                {message.text}
              </Slip>
            ),
          )}
          {asking.busy && (
            <Slip pin={mentor.color} tilt={thread.length} className="self-start">
              <span className="sr-only">{mentor.name} is thinking</span>
              <span aria-hidden="true" className="animate-pulse font-bold tracking-widest">
                &hellip;
              </span>
            </Slip>
          )}
        </div>

        {asking.error && (
          <p role="alert" className="mt-3 mb-0 border-l-2 border-grove-act pl-2 text-sm font-bold">
            {asking.error}
          </p>
        )}
        <form onSubmit={send} className="mt-4 flex gap-2">
          <Input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            aria-label="Your question"
            placeholder={mentor.prompt}
            autoComplete="off"
            maxLength={500}
            className="h-10"
          />
          <Button type="submit" size="lg" className="font-bold" disabled={asking.busy || !draft.trim()}>
            <SendHorizontal aria-hidden="true" />
            Ask
          </Button>
        </form>
      </Plaque>
    </div>
  );
}
