import { PlantMushroom } from "@/components/grove/PlantMushroom";
import { formatMeasurement, metricLabel, timeAgo } from "@/lib/format";
import { Panel } from "../Panel";
import { type DashboardView, latestReading, statusLabel } from "../view";

/** Every plant in the garden with its latest numbers. Columns follow whatever metrics were reported. */
export function Roster({ view }: { view: DashboardView }) {
  const { plants, devices, latestReadings } = view.dashboard;
  const metrics = [...new Set(latestReadings.flatMap(reading => reading.measurements.map(m => m.metric)))];

  return (
    <Panel title="Plants">
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="pr-4 pb-2 font-bold">
                Plant
              </th>
              {metrics.map(metric => (
                <th key={metric} scope="col" className="px-3 pb-2 text-right font-bold whitespace-nowrap">
                  {metricLabel(metric)}
                </th>
              ))}
              <th scope="col" className="pb-2 pl-3 text-right font-bold">
                Measured
              </th>
            </tr>
          </thead>
          <tbody>
            {plants.map(plant => {
              const reading = latestReading(view.dashboard, plant.id);
              return (
                <tr key={plant.id} className="border-t">
                  <th scope="row" className="py-2 pr-4 text-left font-normal">
                    <button
                      type="button"
                      onClick={() => view.selectPlant(plant.id)}
                      className="flex cursor-pointer items-center gap-3 rounded-md border-0 bg-transparent p-1 text-left font-sans text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <PlantMushroom status={plant.status} className="h-11 w-12 shrink-0" />
                      <span>
                        <span className="block font-bold">{plant.name}</span>
                        <span className="block text-xs whitespace-nowrap text-muted-foreground">{statusLabel(plant)}</span>
                      </span>
                    </button>
                  </th>
                  {metrics.map(metric => {
                    const measurement = reading?.measurements.find(m => m.metric === metric);
                    return (
                      <td key={metric} className="px-3 py-2 text-right tabular-nums">
                        {measurement ? formatMeasurement(measurement) : <span className="text-muted-foreground">–</span>}
                      </td>
                    );
                  })}
                  <td className="py-2 pl-3 text-right whitespace-nowrap text-muted-foreground">
                    {reading ? timeAgo(reading.measuredAt) : "No readings"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {devices.length > 0 && (
        <p className="mt-4 mb-0 border-t pt-4 text-xs text-muted-foreground">
          {devices
            .map(device => `${device.name}: ${device.lastSeenAt ? `heard from ${timeAgo(device.lastSeenAt)}` : "never heard from"}`)
            .join(" · ")}
        </p>
      )}
    </Panel>
  );
}
