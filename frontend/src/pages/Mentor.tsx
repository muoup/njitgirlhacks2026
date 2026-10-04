import { ArrowLeft, Shovel } from "lucide-react";
import { Navigate } from "react-router";

import { AccountTag, SideBoard, TitleSign, Wordmark } from "@/components/dashboard/BandHeader";
import { ForestFloor } from "@/components/dashboard/ForestFloor";
import { GroveStrip } from "@/components/dashboard/GroveBand";
import { Plaque } from "@/components/dashboard/Panel";
import { AskBox, Conversation, PersonaSwitch } from "@/components/mentor/Chat";
import { useMentor } from "@/components/mentor/conversation";
import { MentorFigures } from "@/components/mentor/Figures";
import { MENTORS } from "@/components/mentor/mentors";
import { auth, type SessionUser } from "@/lib/auth";

function SignedIn({ user }: { user: SessionUser }) {
  const { persona } = useMentor();
  const mentor = MENTORS[persona];
  return (
    // As tall as the window, so the conversation scrolls inside it and the question box stays put.
    <div className="flex h-svh min-h-[44rem] flex-col overflow-x-clip bg-background text-foreground lg:min-h-[38rem]">
      <div className="relative">
        <GroveStrip className="h-[250px] [--floor:44px] sm:h-[214px] sm:[--floor:44px]" />
        <Wordmark to="/dashboard" />
        <TitleSign
          title="Ask the mentor"
          opposite={
            <SideBoard to="/dashboard" label="Back to the garden" short="Garden" tilt="-2.5deg">
              <ArrowLeft aria-hidden="true" className="size-5" />
            </SideBoard>
          }
          beside={
            <SideBoard to="/shed" label="Potting shed" short="Shed">
              <Shovel aria-hidden="true" className="size-5" />
            </SideBoard>
          }
        >
          <p className="pointer-events-auto mt-3 mb-0 rounded-2xl bg-grove-sky/70 px-3.5 py-1 text-center text-sm text-grove-mist backdrop-blur-sm lg:text-base">
            Ask about your plants, and choose who answers.
          </p>
        </TitleSign>
        <AccountTag user={user} onSignOut={() => auth.signOut().catch(() => {})} />
      </div>

      {/* Isolated so the forest floor can lie behind the conversation without slipping behind the page. */}
      <div className="relative isolate flex min-h-0 flex-1 flex-col">
        <ForestFloor />
        <main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-rows-[auto_minmax(0,1fr)] gap-x-12 gap-y-3 px-5 pb-6 sm:px-8 lg:grid-cols-[24rem_minmax(0,1fr)] lg:grid-rows-1 lg:pb-8">
          {/* The mentor stands behind their nameplate, hat reaching up into the grove, and is smaller in a short window. */}
          <section aria-label="Who answers" className="-mt-20 lg:-mt-28 lg:[--tall:clamp(10rem,(100svh-30rem)*0.8,16rem)]">
            <MentorFigures persona={persona} className="-mb-3.5 w-28 lg:-mb-[calc(var(--tall)/8)] lg:w-(--tall)" />
            <Plaque cut={1}>
              <h2 className="m-0 font-brush text-3xl leading-none font-normal text-grove-parchment lg:text-[2.75rem]">{mentor.name}</h2>
              <p className="mt-2 mb-0 font-tale text-[1.375rem] leading-snug text-grove-mist italic max-lg:hidden">{mentor.manner}</p>
              <PersonaSwitch roomy className="mt-4 lg:mt-5" />
            </Plaque>
            <p className="mt-5 mb-0 px-2.5 text-base text-muted-foreground max-lg:hidden">
              Your mentor can see all your gardens. Garden and plant changes need your approval.
            </p>
          </section>

          {/* Nothing frames the conversation: it lies open on the forest floor, over the box to write in. */}
          <section aria-label="Ask" className="flex min-h-0 flex-col lg:pt-3">
            <Conversation className="min-h-0 flex-1 lg:text-lg" />
            <AskBox roomy className="mt-1 px-3" />
            <p className="mt-2 mb-0 px-3 text-sm text-muted-foreground lg:hidden">
              Your mentor can see all your gardens. Garden and plant changes need your approval.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}

/** Where questions about the garden are asked, of a gnome or a wizard. */
export function Mentor() {
  const session = auth.useSession();
  if (session.status === "loading") return <div role="status" aria-label="Loading" className="min-h-svh bg-background" />;
  if (session.status === "signed-out") return <Navigate to="/signin" replace />;
  return <SignedIn user={session.user} />;
}
