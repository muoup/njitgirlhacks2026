/** Who answers in the mentor's chat. The two differ in voice, not in what they know. */
import type { ChatResponse, MentorActivity, PendingAction } from "@/lib/api";
export type Persona = "gnome" | "wizard";

export interface Mentor {
  /** The word on the switch. */
  label: string;
  name: string;
  /** How they talk, in a line under their name. */
  manner: string;
  /** The colour of their hat: on the switch, and down the edge of what they say. */
  color: string;
  greeting: string;
  /** What the question box suggests. */
  prompt: string;
}

export const MENTORS: Record<Persona, Mentor> = {
  gnome: {
    label: "Gnome",
    name: "Burdock the gnome",
    manner: "Blunt, short and fond of dirt.",
    color: "#d2553a",
    greeting: "Oi. Mind the seedlings. What's the trouble with your patch, then?",
    prompt: "Ask Burdock about your plants",
  },
  wizard: {
    label: "Wizard",
    name: "Moss the wizard",
    manner: "Grand, patient and given to omens.",
    color: "#6d70c4",
    greeting: "Ah, a visitor. Ask, and I shall consult the leaves on your behalf.",
    prompt: "Ask Moss about your plants",
  },
};

export const PERSONAS = Object.keys(MENTORS) as Persona[];

/** Questions offered before the first one is asked. */
export const STARTERS = ["Which plant needs me most?", "How often should I water?", "Why are the leaves turning yellow?"];

export interface ChatMessage {
  from: "you" | Persona;
  text: string;
  action?: PendingAction;
  /** What the mentor asked to have drawn under what they said, and the plants it is about. */
  blocks?: ChatResponse["blocks"];
  plants?: ChatResponse["plants"];
}

/** What the mentor has been asked to do: answer a question, carry out a decision, or refresh the insights. */
export type Task = "ask" | "decide" | "refresh";

const WAITING: Record<Task, string> = {
  ask: "Thinking",
  decide: "Seeing to it",
  refresh: "Looking over every garden",
};

/** What to say the mentor is doing while they work: the last thing their run reached for, or the task itself. */
export function working(task: Task, activity: MentorActivity | null) {
  const subject = activity?.subject;
  switch (activity?.tool) {
    case "listGardens": return "Looking over your gardens";
    case "inspectGarden": return subject ? `Walking through ${subject}` : "Walking through a garden";
    case "getReadings": return subject ? `Reading ${subject}’s history` : "Reading a plant’s history";
    case "readMemory": return "Checking the notebook";
    case "updateMemory": return "Writing in the notebook";
    case "loadSkill": return subject ? `Reading up on ${subject.replaceAll("-", " ")}` : "Reading up";
    case "proposeAction": return "Drawing up a change for you to approve";
    default: return WAITING[task];
  }
}
