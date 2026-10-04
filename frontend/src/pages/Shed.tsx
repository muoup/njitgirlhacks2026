import { ArrowLeft, MessageCircle, Plus } from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";
import { Navigate } from "react-router";

import { AccountTag, FOCUS, Plank, SideBoard, TitleSign, Wordmark } from "@/components/dashboard/BandHeader";
import { GroveStrip } from "@/components/dashboard/GroveBand";
import { standInOverviews } from "@/components/dashboard/overview";
import { Skeleton, StateMessage } from "@/components/dashboard/Panel";
import { useAction } from "@/components/shed/action";
import { type Bed, GardenBed } from "@/components/shed/GardenBed";
import { Packet, PacketField } from "@/components/shed/Packet";
import { Soil } from "@/components/shed/Soil";
import { api, ApiError, type ApiKey, type Garden } from "@/lib/api";
import { auth, type SessionUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useResource } from "@/lib/useResource";

/** The board that starts a garden: it turns into a packet asking for the garden's name. */
function NewGarden({ first, onStarted }: { first: boolean; onStarted: (garden: Garden) => void }) {
  const [open, setOpen] = useState(false);
  const action = useAction();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "grove-board relative isolate mx-auto flex cursor-pointer items-center gap-2 border-0 bg-transparent px-6 py-2.5 font-brush text-2xl leading-none text-grove-parchment",
          FOCUS,
        )}
        style={{ "--tilt": "1deg", "--nudge": "0px" } as CSSProperties}
      >
        <Plank cut="polygon(2% 0, 100% 7%, 98% 100%, 0 92%)" />
        <Plus aria-hidden="true" className="size-5" />
        {first ? "Start a garden" : "Start a new garden"}
      </button>
    );
  }
  return (
    <Packet
      title="A new garden"
      submit={{ label: "Start it", busy: "Starting…" }}
      busy={action.busy}
      error={action.error}
      className="mx-auto w-full max-w-md"
      onCancel={() => {
        action.clear();
        setOpen(false);
      }}
      onSubmit={fields =>
        action.run(async () => {
          onStarted((await api.createGarden(fields.name!)).garden);
          setOpen(false);
        })
      }
    >
      <PacketField label="Name" name="name" placeholder="Back garden" autoFocus />
    </Packet>
  );
}

function SignedIn({ user }: { user: SessionUser }) {
  const loaded = useResource(async () => {
    const { gardens } = await api.listGardens();
    return Promise.all(gardens.map(garden => api.getDashboard(garden.id)));
  }, []);
  const dashboards = loaded.resource.status === "ready" ? loaded.resource.data : null;
  const urgencies = useMemo(
    () => new Map(dashboards?.flatMap(dashboard => standInOverviews(dashboard).map(overview => [overview.plantId, overview.urgency])) ?? []),
    [dashboards],
  );
  // Changes made here are applied to what was loaded, so nothing is fetched again and a new key stays on show.
  const [edited, setEdited] = useState<Bed[] | null>(null);
  const [freshKeys, setFreshKeys] = useState<Record<string, ApiKey>>({});
  const beds: Bed[] | null = edited ?? dashboards?.map(({ garden, plants }) => ({ garden, plants })) ?? null;

  const editBed = (gardenId: string, edit: (bed: Bed) => Bed | null) =>
    setEdited((beds ?? []).flatMap(bed => (bed.garden.id === gardenId ? (edit(bed) ?? []) : bed)));

  // The session can end while the page is open; the next request is the first to find out.
  if (loaded.resource.status === "error" && loaded.resource.error instanceof ApiError && loaded.resource.error.status === 401) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <div className="shed-soil flex min-h-svh flex-col overflow-x-clip bg-background text-foreground">
      <div className="relative">
        <GroveStrip turf className="h-[250px] [--floor:44px] sm:h-[214px] sm:[--floor:44px]" />
        <Wordmark to="/dashboard" />
        <TitleSign
          title="Potting shed"
          opposite={
            <SideBoard to="/mentor" label="Ask the mentor" short="Mentor" tilt="-2.5deg">
              <MessageCircle aria-hidden="true" className="size-5" />
            </SideBoard>
          }
          beside={
            <SideBoard to="/dashboard" label="Back to the garden" short="Garden">
              <ArrowLeft aria-hidden="true" className="size-5" />
            </SideBoard>
          }
        >
          <p className="pointer-events-auto mt-3 mb-0 rounded-2xl bg-grove-sky/70 px-3.5 py-1 text-center text-sm text-grove-mist backdrop-blur-sm">
            Plant, remove, and find the keys your monitors use.
          </p>
        </TitleSign>
        <AccountTag user={user} onSignOut={() => auth.signOut().catch(() => {})} />
      </div>

      {/* Isolated so the soil can lie behind the beds without slipping behind the page. */}
      <div className="relative isolate flex-1">
        <Soil />
        <main className="mx-auto grid w-full max-w-4xl gap-9 px-5 pt-8 pb-16 sm:px-8">
        {loaded.resource.status === "error" ? (
          <StateMessage title="The shed door is stuck." action={{ label: "Try again", onClick: loaded.retry }}>
            Your gardens couldn&rsquo;t be loaded. Nothing has been lost.
          </StateMessage>
        ) : !beds ? (
          <div role="status" aria-label="Loading your gardens" className="grid gap-9">
            <Skeleton className="h-64 lg:w-[94%]" />
            <Skeleton className="h-40 lg:ml-auto lg:w-[94%]" />
          </div>
        ) : (
          <>
            {beds.length === 0 && (
              <StateMessage title="Nothing planted yet.">Start a garden, then plant something in it to get its key.</StateMessage>
            )}
            {beds.map((bed, index) => (
              // Staggered a little, like the stops on the dashboard's trail.
              <div key={bed.garden.id} className={cn("min-w-0 lg:w-[94%]", index % 2 === 1 && "lg:ml-auto")}>
                <GardenBed
                  bed={bed}
                  cut={index}
                  urgencies={urgencies}
                  freshKeys={freshKeys}
                  onPlanted={(plant, apiKey) => {
                    setFreshKeys(keys => ({ ...keys, [plant.id]: apiKey }));
                    editBed(bed.garden.id, current => ({ ...current, plants: [...current.plants, plant] }));
                  }}
                  onPlantEdited={plant =>
                    editBed(bed.garden.id, current => ({ ...current, plants: current.plants.map(item => (item.id === plant.id ? plant : item)) }))
                  }
                  onPlantRemoved={plantId =>
                    editBed(bed.garden.id, current => ({ ...current, plants: current.plants.filter(plant => plant.id !== plantId) }))
                  }
                  onEdited={garden => editBed(bed.garden.id, current => ({ ...current, garden }))}
                  onRemoved={() => editBed(bed.garden.id, () => null)}
                />
              </div>
            ))}
            <NewGarden first={beds.length === 0} onStarted={garden => setEdited([...beds, { garden, plants: [] }])} />
          </>
        )}
        </main>
      </div>
    </div>
  );
}

/** Where gardens and plants are added and removed, and where each plant's key is kept. */
export function Shed() {
  const session = auth.useSession();
  if (session.status === "loading") {
    // The shed's roof is already up while the session is looked up, so the page does not start blank.
    return (
      <div role="status" aria-label="Loading" className="shed-soil min-h-svh bg-background">
        <div className="relative">
          <GroveStrip turf className="h-[250px] [--floor:44px] sm:h-[214px] sm:[--floor:44px]" />
          <Wordmark to="/dashboard" />
        </div>
      </div>
    );
  }
  if (session.status === "signed-out") return <Navigate to="/signin" replace />;
  return <SignedIn user={session.user} />;
}
