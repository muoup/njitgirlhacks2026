import { MessageCircle, Shovel } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import { AccountTag, GardenSign, SideBoard } from "@/components/dashboard/BandHeader";
import { GroveBand } from "@/components/dashboard/GroveBand";
import { ForestFloor } from "@/components/dashboard/ForestFloor";
import { defaultLayout, type WidgetSpec } from "@/components/dashboard/layout";
import { type PlantOverview, standInOverviews, URGENCY, type Urgency } from "@/components/dashboard/overview";
import { Skeleton, StateMessage } from "@/components/dashboard/Panel";
import { Trail } from "@/components/dashboard/Trail";
import { type DashboardView, lastHeardAt } from "@/components/dashboard/view";
import { Widget } from "@/components/dashboard/Widget";
import { api, ApiError, type DashboardResponse, type Garden } from "@/lib/api";
import { auth, type SessionUser } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { useResource } from "@/lib/useResource";

function isStatus(error: unknown, status: number) {
  return error instanceof ApiError && error.status === status;
}

function Body({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-5xl px-5 pb-16 sm:px-8">{children}</main>;
}

function LoadingBody() {
  return (
    <Body>
      <div role="status" aria-label="Loading the garden" className="grid gap-10 pt-16">
        <Skeleton className="h-56 lg:w-[82%]" />
        <Skeleton className="h-40 lg:ml-auto lg:w-[82%]" />
      </div>
    </Body>
  );
}

/** The stone marking a stop takes the colour of the plant the stop is about. */
function stopColor(spec: WidgetSpec, overviews: PlantOverview[]) {
  if (spec.type !== "plant") return undefined;
  const urgency = overviews.find(overview => overview.plantId === spec.plantId)?.urgency;
  return urgency ? URGENCY[urgency].color : undefined;
}

function GardenBody({ view }: { view: DashboardView }) {
  const { dashboard, overviews, selectedId, selectPlant } = view;
  const navigate = useNavigate();

  if (selectedId && !dashboard.plants.some(plant => plant.id === selectedId)) {
    return (
      <Body>
        <StateMessage title="That plant isn't here." action={{ label: "Show the whole garden", onClick: () => selectPlant(null) }}>
          It may have been removed, or the link may be for a different garden.
        </StateMessage>
      </Body>
    );
  }
  if (dashboard.plants.length === 0) {
    return (
      <Body>
        <StateMessage title="Nothing planted here yet." action={{ label: "Plant something", onClick: () => navigate("/shed") }}>
          This garden has no plants.
        </StateMessage>
      </Body>
    );
  }

  return (
    <Body>
      <Trail
        stops={defaultLayout(dashboard, overviews, selectedId).map((spec, index) => ({
          key: `${spec.type}-${index}`,
          color: stopColor(spec, overviews),
          node: <Widget spec={spec} index={index} view={view} />,
        }))}
      />
      <p className="mt-14 mb-0 text-xs text-muted-foreground">
        {dashboard.meta.source === "mock" && "Sample sensor readings. "}
        {dashboard.insights.generation?.state === "ready" && "Generated garden insights. "}
        {dashboard.insights.generation?.state === "refreshing" && "Refreshing garden insights. "}
        {(dashboard.insights.generation?.state === "stale" || dashboard.insights.generation?.state === "failed") && "Garden insights need a refresh. "}
        Updated {timeAgo(dashboard.meta.hydratedAt)}.
      </p>
    </Body>
  );
}

const TALLY: { urgency: Urgency; one: string; many: string }[] = [
  { urgency: "act", one: "calls for you", many: "call for you" },
  { urgency: "watch", one: "to look in on", many: "to look in on" },
];

/** The line under the garden sign: how many plants want something, and how fresh the numbers are. */
function Summary({ dashboard, overviews }: { dashboard: DashboardResponse; overviews: PlantOverview[] }) {
  const counts = TALLY.map(entry => ({ ...entry, count: overviews.filter(overview => overview.urgency === entry.urgency).length }))
    .filter(entry => entry.count > 0);
  const assessed = overviews.some(overview => overview.urgency !== null);
  const heard = lastHeardAt(dashboard);

  return (
    <p className="pointer-events-auto mt-3 mb-0 flex flex-wrap items-center justify-center gap-x-3 rounded-2xl bg-grove-sky/70 px-3.5 py-1 text-center text-sm font-bold text-grove-mist backdrop-blur-sm">
      {counts.map(entry => (
        <span key={entry.urgency} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rotate-45" style={{ background: URGENCY[entry.urgency].color }} />
          {entry.count} {entry.count === 1 ? entry.one : entry.many}
        </span>
      ))}
      {counts.length === 0 && assessed && (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rotate-45 bg-grove-ok" />
          Nothing calls for you
        </span>
      )}
      {heard && <span className="font-normal">heard {timeAgo(heard)}</span>}
      {counts.length === 0 && !assessed && !heard && <span className="font-normal">No readings yet</span>}
    </p>
  );
}

function SignedIn({ user }: { user: SessionUser }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const gardenParam = params.get("garden");
  const plantId = params.get("plant");

  const gardens = useResource(() => api.listGardens(), []);
  const gardenList: Garden[] = gardens.resource.status === "ready" ? gardens.resource.data.gardens : [];
  const garden = gardenParam ? gardenList.find(item => item.id === gardenParam) : gardenList[0];
  const dashboard = useResource(garden ? () => api.getDashboard(garden.id) : null, [garden?.id]);
  const loaded = dashboard.resource.status === "ready" ? dashboard.resource.data : null;
  const overviews = useMemo(() => (loaded ? standInOverviews(loaded) : []), [loaded]);

  const selectGarden = (id: string) => setParams({ garden: id });
  const selectPlant = (id: string | null) =>
    setParams(garden ? { garden: garden.id, ...(id ? { plant: id } : {}) } : {});

  const failure =
    gardens.resource.status === "error"
      ? { error: gardens.resource.error, retry: gardens.retry }
      : dashboard.resource.status === "error"
        ? { error: dashboard.resource.error, retry: dashboard.retry }
        : null;
  // The session can end while the page is open; the next request is the first to find out.
  if (failure && isStatus(failure.error, 401)) return <Navigate to="/signin" replace />;

  let body;
  if (failure) {
    body = (
      <Body>
        {isStatus(failure.error, 404) ? (
          <StateMessage title="That garden isn't here.">It may have been removed. Choose another garden above.</StateMessage>
        ) : (
          <StateMessage title="The grove went quiet." action={{ label: "Try again", onClick: failure.retry }}>
            The garden couldn&rsquo;t be loaded. Nothing has been lost.
          </StateMessage>
        )}
      </Body>
    );
  } else if (gardens.resource.status === "loading") {
    body = <LoadingBody />;
  } else if (gardenList.length === 0) {
    body = (
      <Body>
        <StateMessage title="Nothing planted yet.">No gardens are linked to this account.</StateMessage>
      </Body>
    );
  } else if (!garden) {
    const first = gardenList[0]!;
    body = (
      <Body>
        <StateMessage title="That garden isn't here." action={{ label: `Go to ${first.name}`, onClick: () => selectGarden(first.id) }}>
          It may have been removed, or the link may belong to another account.
        </StateMessage>
      </Body>
    );
  } else if (!loaded) {
    body = <LoadingBody />;
  } else {
    body = <GardenBody view={{ dashboard: loaded, overviews, selectedId: plantId, selectPlant }} />;
  }

  return (
    <div className="flex min-h-svh flex-col overflow-x-clip bg-background text-foreground">
      <div className="relative">
        <GroveBand
          plants={loaded?.plants ?? []}
          overviews={overviews}
          readings={loaded?.latestReadings ?? []}
          selectedId={plantId}
          onSelect={selectPlant}
        />
        <Link to="/" className="absolute top-4 left-5 font-brush text-4xl leading-none text-grove-parchment no-underline sm:left-8">
          loam
        </Link>
        {gardenList.length > 0 && (
          <GardenSign
            gardens={gardenList}
            gardenId={garden?.id}
            onSelect={selectGarden}
            opposite={
              <SideBoard to="/mentor" label="Ask the mentor" short="Mentor" tilt="-2.5deg">
                <MessageCircle aria-hidden="true" className="size-5" />
              </SideBoard>
            }
            beside={
              <SideBoard to="/shed" label="Potting shed" short="Shed">
                <Shovel aria-hidden="true" className="size-5" />
              </SideBoard>
            }
          >
            {loaded && loaded.plants.length > 0 && <Summary dashboard={loaded} overviews={overviews} />}
          </GardenSign>
        )}
        <AccountTag user={user} onSignOut={() => auth.signOut().catch(() => {})} />
      </div>
      {/* Isolated so the forest floor can lie behind the stops without slipping behind the page. */}
      <div className="relative isolate flex-1">
        <ForestFloor />
        {body}
      </div>
    </div>
  );
}

/** Signed-in home: the grove band for one garden, then whatever widgets the layout lists, along a trail. */
export function Dashboard() {
  const session = auth.useSession();
  if (session.status === "loading") return <div role="status" aria-label="Loading" className="min-h-svh bg-background" />;
  if (session.status === "signed-out") return <Navigate to="/signin" replace />;
  return <SignedIn user={session.user} />;
}
