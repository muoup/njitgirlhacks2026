import { timeAgo } from "@/lib/format";
import { NoteList } from "../ParchmentNote";
import { type DashboardView, findPlant, followUps } from "../view";

const COUNTS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

function Written({ view }: { view: DashboardView }) {
  const { generatedAt } = view.dashboard.insights;
  return generatedAt ? <p className="mt-1 mb-0 text-sm text-muted-foreground">Notes written {timeAgo(generatedAt)}.</p> : null;
}

/** The first answer the dashboard gives: which notes want something done. */
export function FollowUps({ view }: { view: DashboardView }) {
  const { insights } = view.dashboard;
  const items = followUps(view.dashboard);

  if (insights.status === "unavailable") {
    return (
      <section>
        <h2 className="m-0 font-brush text-4xl leading-tight font-normal text-grove-parchment">No notes yet.</h2>
        <p className="mt-1 mb-0 text-sm text-muted-foreground">Insights aren&rsquo;t available for this garden right now.</p>
      </section>
    );
  }

  const count = COUNTS[items.length] ?? String(items.length);
  return (
    <section>
      <h2 className="m-0 font-brush text-4xl leading-tight font-normal text-grove-parchment">
        {items.length === 0
          ? "Nothing needs you today."
          : `${count} ${items.length === 1 ? "thing needs" : "things need"} you.`}
      </h2>
      <Written view={view} />
      {items.length > 0 && (
        <NoteList items={items} view={view} className="mt-6 grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))]" />
      )}
    </section>
  );
}

/** Notes on one plant (follow-ups first), or the garden's notes that need no follow-up. */
export function Notes({ plantId, view }: { plantId?: string; view: DashboardView }) {
  const { insights } = view.dashboard;
  const plant = plantId ? findPlant(view.dashboard, plantId) : undefined;
  const items = plantId
    ? insights.items
        .filter(item => item.plantId === plantId)
        .sort((a, b) => Number(b.needsFollowUp ?? false) - Number(a.needsFollowUp ?? false))
    : insights.items.filter(item => !item.needsFollowUp);

  return (
    <section>
      <h2 className="m-0 flex min-h-8 items-center text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase">
        {plant ? `Notes on ${plant.name}` : followUps(view.dashboard).length > 0 ? "Other notes" : "Notes"}
      </h2>
      {items.length > 0 ? (
        <NoteList items={items} view={view} link={!plantId} className="mt-4" />
      ) : (
        <p className="mt-4 mb-0 text-sm text-muted-foreground">
          {insights.status === "unavailable" ? "Insights aren’t available right now." : "No notes."}
        </p>
      )}
    </section>
  );
}
