import { ArrowLeft, Shovel } from "lucide-react";
import { Link, Navigate } from "react-router";

import { AccountTag, Plank, SideBoard, TitleSign } from "@/components/dashboard/BandHeader";
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
        <Link to="/dashboard" className="absolute top-4 left-5 font-brush text-4xl leading-none text-grove-parchment no-underline sm:left-8">
          loam
        </Link>
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
          <p className="pointer-events-auto mt-3 mb-0 rounded-2xl bg-grove-sky/70 px-3.5 py-1 text-center text-sm text-grove-mist backdrop-blur-sm">
            Ask about your plants, and choose who answers.
          </p>
        </TitleSign>
        <AccountTag user={user} onSignOut={() => auth.signOut().catch(() => {})} />
      </div>

      {/* Isolated so the forest floor can lie behind the conversation without slipping behind the page. */}
      <div className="relative isolate flex min-h-0 flex-1 flex-col">
        <ForestFloor />
        <main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-rows-[auto_minmax(0,1fr)] gap-x-12 gap-y-3 px-5 pb-6 sm:px-8 lg:grid-cols-[19rem_minmax(0,1fr)] lg:grid-rows-1 lg:pb-8">
          {/* The mentor stands behind their nameplate, hat reaching up into the grove. */}
          <section aria-label="Who answers" className="-mt-20 lg:-mt-28">
            <MentorFigures persona={persona} className="-mb-3.5 w-28 lg:-mb-8 lg:w-64" />
            <Plaque title={mentor.name} cut={1}>
              <p className="-mt-2 mb-4 font-tale text-[1.0625rem] text-grove-mist italic max-lg:hidden">{mentor.manner}</p>
              <PersonaSwitch />
            </Plaque>
            <p className="mt-5 mb-0 px-2.5 text-xs text-muted-foreground max-lg:hidden">
              Your mentor can see all your gardens. Garden and plant changes need your approval.
            </p>
          </section>

          {/* Nothing frames the conversation: it lies open on the forest floor, over a plank to write on. */}
          <section aria-label="Ask" className="flex min-h-0 flex-col lg:pt-3">
            <Conversation className="min-h-0 flex-1" />
            <div className="relative isolate mt-3 px-4 py-3.5 sm:px-5">
              <Plank cut="polygon(0 6%, 99.5% 0, 100% 95%, 0.6% 100%)" />
              <AskBox />
            </div>
            <p className="mt-3 mb-0 text-xs text-muted-foreground lg:hidden">
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
