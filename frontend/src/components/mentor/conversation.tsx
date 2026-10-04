import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

import { failureMessage } from "@/components/shed/action";
import { auth } from "@/lib/auth";
import { api, ApiError, type MentorActivity } from "@/lib/api";
import { notifyDataChanged } from "@/lib/data-events";
import { createRequestId } from "@/lib/request-id";
import { type ChatMessage, MENTORS, type Persona, type Task } from "./mentors";

interface MentorChat {
  persona: Persona;
  thread: ChatMessage[];
  draft: string;
  setDraft: (draft: string) => void;
  /** Whether a reply is on its way. */
  busy: boolean;
  /** What the mentor was asked to do, while they are doing it. */
  task: Task | null;
  /** The last thing their run reached for, once it has reached for something. */
  activity: MentorActivity | null;
  error: string | null;
  /** Whether anything has been asked, so there is something to lose by starting again. */
  started: boolean;
  /** Changes who answers. The newcomer starts a conversation of their own. */
  change: (persona: Persona) => void;
  /** Starts again with the same mentor, who remembers nothing of what was said. */
  clear: () => void;
  ask: (question: string) => void;
  decide: (id: string, decision: "approve" | "cancel") => void;
  /** Whether the sidebar is out, on the pages that have one. */
  open: boolean;
  setOpen: (open: boolean) => void;
}

const Context = createContext<MentorChat | null>(null);

function fresh(persona: Persona): ChatMessage[] {
  return [{ from: persona, text: MENTORS[persona].greeting }];
}

/**
 * One conversation with the mentor, kept above the pages so the mentor's own page and the
 * sidebar on every other page show the same one. It lasts until the page is reloaded or
 * whoever is signed in changes.
 */
export function MentorProvider({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useState<Persona>("gnome");
  const [thread, setThread] = useState(() => fresh("gnome"));
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [activity, setActivity] = useState<MentorActivity | null>(null);
  const busy = task !== null;
  const [error, setError] = useState<string | null>(null);
  // Counts conversations, so a reply to one that has since been cleared is dropped.
  const conversation = useRef(0);
  const serverConversation = useRef<string | undefined>(undefined);
  const sending = useRef(false);

  const session = auth.useSession();
  const who = session.status === "signed-in" ? session.user.email : null;
  useEffect(() => {
    if (!who) return;
    return () => {
      setPersona("gnome");
      startAgain("gnome");
      setDraft("");
      setOpen(false);
    };
  }, [who]);

  // While the mentor works, ask what they are doing. Nothing depends on the answer, so an ask that fails is let go.
  useEffect(() => {
    if (!task || task === "decide") return;
    let waiting = true;
    const timer = setInterval(() => {
      api.getMentorActivity().then(({ activity: next }) => {
        // Answers can arrive out of order; a run only ever moves forward.
        if (waiting) setActivity(current => (next && current && next.step < current.step ? current : next));
      }, () => {});
    }, 1000);
    return () => {
      waiting = false;
      clearInterval(timer);
      setActivity(null);
    };
  }, [task]);

  function run(during: number, doing: Task, work: () => Promise<void>) {
    setTask(doing);
    setError(null);
    void work().catch(error => {
      if (during === conversation.current) setError(failureMessage(error));
    }).finally(() => {
      if (during === conversation.current) { setTask(null); sending.current = false; }
    });
  }

  function startAgain(withPersona: Persona) {
    conversation.current += 1;
    serverConversation.current = undefined;
    sending.current = false;
    setTask(null);
    setError(null);
    setThread(fresh(withPersona));
  }

  function change(next: Persona) {
    setPersona(next);
    startAgain(next);
  }

  function ask(question: string) {
    const text = question.trim();
    if (!text || sending.current) return;
    const asked: ChatMessage[] = [...thread, { from: "you", text }];
    const during = conversation.current;
    setThread(asked);
    setDraft("");
    sending.current = true;
    run(during, "ask", async () => {
      try {
        const response = await api.askMentor({ persona, message: text,
          conversationId: serverConversation.current, requestId: createRequestId() });
        if (conversation.current === during) {
          serverConversation.current = response.conversationId;
          setThread(current => [...current, { from: persona, text: response.reply, blocks: response.blocks, plants: response.plants },
            ...response.pendingActions.map(action => ({ from: persona, text: "", action }))]);
          notifyDataChanged();
        }
      } catch (error) {
        if (conversation.current !== during) return;
        if (error instanceof ApiError && error.status === 404) serverConversation.current = undefined;
        throw error;
      }
    });
  }

  function decide(id: string, decision: "approve" | "cancel") {
    if (sending.current) return;
    const during = conversation.current;
    sending.current = true;
    run(during, "decide", async () => {
      try {
        const { action } = await api.decideAgentAction(id, decision);
        if (during !== conversation.current) return;
        setThread(current => current.map(message => message.action?.id === id ? { ...message, action } : message));
        if (action.status === "succeeded") notifyDataChanged();
      } catch (error) { if (during === conversation.current) throw error; }
    });
  }

  return (
    <Context
      value={{
        persona, thread, draft, setDraft, busy, task, activity, error, change, ask, decide, open, setOpen,
        started: thread.some(message => message.from === "you"),
        clear: () => startAgain(persona),
      }}
    >
      {children}
    </Context>
  );
}

export function useMentor() {
  const chat = useContext(Context);
  if (!chat) throw new Error("useMentor needs a MentorProvider above it");
  return chat;
}
