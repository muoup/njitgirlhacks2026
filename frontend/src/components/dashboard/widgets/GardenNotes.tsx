import { Radio } from "lucide-react";

import { timeAgo } from "@/lib/format";
import { Note } from "../Note";
import type { DashboardView } from "../view";

/** What was written about the garden as a whole, and when its monitors were last heard from. */
export function GardenNotes({ view }: { view: DashboardView }) {
  const { insights, devices } = view.dashboard;
  const notes = insights.items.filter(item => item.plantId === null);

  const monitors = devices.length > 0 && (
    <ul className="m-0 mt-4 grid list-none gap-1 p-0 text-sm text-muted-foreground">
      {devices.map(device => (
        <li key={device.id} className="flex items-center gap-1.5">
          <Radio aria-hidden="true" className={device.lastSeenAt ? "size-4 text-grove-ok" : "size-4 text-grove-watch"} />
          <span>
            <b className="text-foreground">{device.name}</b>{" "}
            {device.lastSeenAt ? `heard from ${timeAgo(device.lastSeenAt)}` : "never heard from"}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="flex flex-wrap items-start gap-x-10 gap-y-5">
      <div>
        <h2 className="m-0 font-brush text-4xl leading-none font-normal text-grove-parchment">From the grove</h2>
        <p className="mt-1.5 mb-0 text-sm text-muted-foreground">
          {insights.status === "unavailable"
            ? "Insights aren’t available for this garden right now."
            : insights.generatedAt
              ? `Notes written ${timeAgo(insights.generatedAt)}.`
              : "No notes have been written yet."}
        </p>
        {monitors}
      </div>
      {notes.length > 0 && (
        <ul className="m-0 flex min-w-[min(100%,16rem)] flex-1 list-none flex-wrap items-start gap-5 p-0">
          {notes.map((note, index) => (
            <li key={note.id} className="max-w-sm">
              <Note title="Of the whole garden" cut={index + 1}>
                {note.text}
              </Note>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
