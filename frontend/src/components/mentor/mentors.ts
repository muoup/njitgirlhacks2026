/** Who answers in the mentor's chat. The two differ in voice, not in what they know. */
export type Persona = "gnome" | "wizard";

export interface Mentor {
  /** The word on the switch. */
  label: string;
  name: string;
  /** The colour of their hat: on the switch, and on the pin holding up what they say. */
  color: string;
  greeting: string;
  /** What the question box suggests. */
  prompt: string;
  /** What they say while nobody is answering for them; see `askMentor`. */
  notYet: string[];
}

export const MENTORS: Record<Persona, Mentor> = {
  gnome: {
    label: "Gnome",
    name: "Burdock the gnome",
    color: "#d2553a",
    greeting: "Oi. Mind the seedlings. What's the trouble with your patch, then?",
    prompt: "Ask Burdock about your plants",
    notYet: [
      "Can't say yet. Nobody's shown me round your garden, so I'd only be guessing.",
      "Still don't know, and I don't guess about roots. Ask me once I've been let in.",
      "Same answer as before. I'm no use to you until I can see your beds.",
    ],
  },
  wizard: {
    label: "Wizard",
    name: "Alderwick the wizard",
    color: "#6d70c4",
    greeting: "Ah, a visitor. Ask, and I shall consult the leaves on your behalf.",
    prompt: "Ask Alderwick about your plants",
    notYet: [
      "Alas, the leaves are silent. My sight does not yet reach your garden.",
      "I have looked again and seen only fog. Ask me once the way has been opened.",
      "The answer is hidden from me still. I will not invent one.",
    ],
  },
};

export const PERSONAS = Object.keys(MENTORS) as Persona[];

export interface ChatMessage {
  from: "you" | Persona;
  text: string;
}

/**
 * Stands in for the mentor until questions are passed on to a model: waits a moment, then
 * has the mentor admit they cannot answer yet. `thread` ends with the question being asked.
 */
export async function askMentor(persona: Persona, thread: ChatMessage[]): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 900));
  const lines = MENTORS[persona].notYet;
  const asked = thread.filter(message => message.from === "you").length;
  return lines[(asked - 1) % lines.length]!;
}
