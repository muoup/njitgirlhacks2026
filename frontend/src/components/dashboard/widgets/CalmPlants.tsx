import { PlantMushroom } from "@/components/grove/PlantMushroom";
import { CompactReadings, readingInWords } from "../CompactReadings";
import { URGENCY, urgencyLabel } from "../overview";
import { type DashboardView, findPlant, latestReading } from "../view";

/**
 * The plants that want nothing, gathered into one stop, straight on the ground: each with
 * its numbers and whatever was written about it. The title only says they are well when
 * every one of them was reported so.
 */
export function CalmPlants({ plantIds, view }: { plantIds: string[]; view: DashboardView }) {
  const overviews = view.overviews.filter(overview => plantIds.includes(overview.plantId));
  const allWell = overviews.every(overview => overview.urgency === "ok");
  const others = plantIds.length < view.dashboard.plants.length;

  return (
    <section>
      <h2 className="m-0 font-brush text-4xl leading-none font-normal text-grove-parchment">
        {allWell ? (others ? "The rest are thriving." : "All is well.") : others ? "The rest of the garden" : "Your plants"}
      </h2>
      <ul className="m-0 mt-4 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-x-6 gap-y-3 p-0">
        {overviews.map(overview => {
          const plant = findPlant(view.dashboard, overview.plantId);
          if (!plant) return null;
          const reading = latestReading(view.dashboard, plant.id);
          return (
            <li key={plant.id}>
              <button
                type="button"
                aria-label={`${plant.name}: ${urgencyLabel(overview.urgency).toLowerCase()}, ${readingInWords(reading)}. ${overview.text}`}
                onClick={() => view.selectPlant(plant.id)}
                className="grid w-full cursor-pointer grid-cols-[auto_1fr] items-center gap-x-3 rounded-md border-0 bg-transparent p-1 text-left font-sans text-foreground outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <PlantMushroom urgency={overview.urgency} quiet={!reading} className="h-14 w-[3.85rem]" />
                <span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-brush text-2xl leading-none">{plant.name}</span>
                    <span
                      className="text-xs text-muted-foreground"
                      style={overview.urgency ? { color: URGENCY[overview.urgency].color } : undefined}
                    >
                      {urgencyLabel(overview.urgency)}
                    </span>
                  </span>
                  <CompactReadings reading={reading} className="mt-1 justify-start text-sm text-foreground" />
                </span>
                {overview.text && <span className="col-span-2 mt-1 text-sm text-muted-foreground">{overview.text}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
