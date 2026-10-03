import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useSearchParams } from "react-router";

import { GroveBand } from "@/components/dashboard/GroveBand";
import { defaultLayout } from "@/components/dashboard/layout";
import { Skeleton, StateMessage } from "@/components/dashboard/Panel";
import { followUps } from "@/components/dashboard/view";
import { Widget } from "@/components/dashboard/Widget";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError, type DashboardResponse, type Garden } from "@/lib/api";
import { auth, type SessionUser } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { useResource } from "@/lib/useResource";

function isStatus(error: unknown, status: number) {
  return error instanceof ApiError && error.status === status;
}

function Body({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8">{children}</main>;
}

function LoadingBody() {
  return (
    <Body>
      <div role="status" aria-label="Loading the garden" className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-44 lg:col-span-3" />
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </Body>
  );
}

function GardenBody({
  dashboard,
  plantId,
  selectPlant,
}: {
  dashboard: DashboardResponse;
  plantId: string | null;
  selectPlant: (plantId: string | null) => void;
}) {
  const view = { dashboard, selectPlant };

  if (plantId && !dashboard.plants.some(plant => plant.id === plantId)) {
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
        <StateMessage title="Nothing planted here yet.">This garden has no plants.</StateMessage>
      </Body>
    );
  }

  return (
    <Body>
      <div className="grid gap-x-6 gap-y-8 lg:grid-cols-3">
        {defaultLayout(dashboard, plantId).map((spec, index) => (
          <Widget key={`${spec.type}-${index}`} spec={spec} view={view} />
        ))}
      </div>
      <p className="mt-12 mb-0 text-xs text-muted-foreground">
        {dashboard.meta.source === "mock" && "Sample data, not live sensor readings or generated insights. "}
        Updated {timeAgo(dashboard.meta.hydratedAt)}.
      </p>
    </Body>
  );
}

function SignedIn({ user }: { user: SessionUser }) {
  const [params, setParams] = useSearchParams();
  const gardenParam = params.get("garden");
  const plantId = params.get("plant");

  const gardens = useResource(() => api.listGardens(), []);
  const gardenList: Garden[] = gardens.resource.status === "ready" ? gardens.resource.data.gardens : [];
  const garden = gardenParam ? gardenList.find(item => item.id === gardenParam) : gardenList[0];
  const dashboard = useResource(garden ? () => api.getDashboard(garden.id) : null, [garden?.id]);
  const loaded = dashboard.resource.status === "ready" ? dashboard.resource.data : null;

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
    body = <GardenBody dashboard={loaded} plantId={plantId} selectPlant={selectPlant} />;
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="relative">
        <GroveBand
          plants={loaded?.plants ?? []}
          selectedId={plantId}
          followUpIds={new Set(loaded ? followUps(loaded).flatMap(item => item.plantId ?? []) : [])}
          onSelect={selectPlant}
        />
        <header className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-8">
          <Link to="/" className="font-brush text-4xl leading-none text-grove-parchment no-underline">
            loam
          </Link>
          {gardenList.length > 0 && (
            <Select value={garden?.id ?? ""} onValueChange={selectGarden}>
              <SelectTrigger aria-label="Garden" className="bg-grove-sky/70 font-bold backdrop-blur-sm dark:bg-grove-sky/70">
                <SelectValue placeholder="Choose a garden" />
              </SelectTrigger>
              <SelectContent>
                {gardenList.map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-grove-mist sm:inline">{user.name}</span>
            <Button variant="ghost" size="sm" onClick={() => auth.signOut().catch(() => {})}>
              <LogOut />
              Sign out
            </Button>
          </div>
        </header>
      </div>
      {body}
    </div>
  );
}

/** Signed-in home: the grove band for one garden, then whatever widgets the layout lists. */
export function Dashboard() {
  const session = auth.useSession();
  if (session.status === "loading") return <div role="status" aria-label="Loading" className="min-h-svh bg-background" />;
  if (session.status === "signed-out") return <Navigate to="/signin" replace />;
  return <SignedIn user={session.user} />;
}
