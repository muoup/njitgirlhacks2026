import { ArrowLeft, Shovel } from "lucide-react";
import { Link, Navigate } from "react-router";

import { AccountTag, SideBoard, TitleSign } from "@/components/dashboard/BandHeader";
import { ForestFloor } from "@/components/dashboard/ForestFloor";
import { GroveStrip } from "@/components/dashboard/GroveBand";
import { Chat } from "@/components/mentor/Chat";
import { auth, type SessionUser } from "@/lib/auth";

function SignedIn({ user }: { user: SessionUser }) {
  return (
    <div className="flex min-h-svh flex-col overflow-x-clip bg-background text-foreground">
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

      {/* Isolated so the forest floor can lie behind the board without slipping behind the page. */}
      <div className="relative isolate flex-1">
        <ForestFloor />
        {/* The space above the board is where the mentor stands, hat reaching up into the grove. */}
        <main className="mx-auto w-full max-w-2xl px-5 pt-28 pb-8 sm:px-8 sm:pt-36 sm:pb-10">
          <Chat />
          <p className="mt-6 mb-0 text-xs text-muted-foreground">
            Nobody is answering yet. The mentor isn&rsquo;t connected, so every reply is a stand-in.
          </p>
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
