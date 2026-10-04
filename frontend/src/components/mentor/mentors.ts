/** Who answers in the mentor's chat. The two differ in voice, not in what they know. */
import type { ChatResponse, PendingAction } from "@/lib/api";
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
