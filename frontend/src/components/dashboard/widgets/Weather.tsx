import type { Forecast, Garden } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { AlertFlag, rainAmount, SkyIcon } from "../forecast";
import { Plaque } from "../Panel";

const weekday = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" });

/**
 * The week ahead where the garden is: a day to a column, or a row on a narrow screen, with
 * the days that cross a line flagged. What it means for each plant is in that plant's note.
 */
export function Weather({ forecast, garden, cut }: { forecast: Forecast; garden: Garden; cut?: number }) {
  // "Miami, Florida, United States" is how the place was found; the town and its region are enough to head a forecast.
  const town = forecast.place.split(", ").slice(0, 2).join(", ");
  return (
    <section>
      <h2 className="m-0 font-brush text-4xl leading-none font-normal text-grove-parchment">The week ahead</h2>
      <p className="mt-1.5 mb-0 text-sm text-muted-foreground">
        {town} · {garden.setting === "outdoors" ? "an outdoor garden" : "an indoor garden"}
      </p>
      <Plaque cut={cut} className="mt-5">
        <ol className="m-0 grid list-none divide-y divide-border/60 p-0 sm:grid-cols-7 sm:divide-x sm:divide-y-0">
          {forecast.days.map((day, index) => {
            const rain = rainAmount(day);
            return (
              <li
                key={day.date}
                aria-label={`${day.day}: ${day.sky}, high ${day.high}, low ${day.low} degrees${rain ? `, ${rain} of rain` : ""}`}
                className="flex items-center gap-x-3 gap-y-1.5 py-2 first:pt-0 last:pb-0 sm:flex-col sm:px-1 sm:py-0 sm:text-center"
              >
                <span className="w-12 text-sm font-bold sm:w-auto">{index === 0 ? "Today" : weekday.format(new Date(`${day.date}T00:00:00Z`))}</span>
                <SkyIcon sky={day.sky} className="text-grove-mist" />
                <span className="w-16 tabular-nums sm:w-auto">
                  <b>{day.high}°</b> <span className="text-muted-foreground">{day.low}°</span>
                </span>
                <span className="flex min-h-5 flex-1 flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground tabular-nums sm:flex-none sm:flex-col sm:items-center">
                  {rain ? (
                    <>
                      <span className="text-foreground">{rain}</span>
                      <span>{day.rainChance}%</span>
                    </>
                  ) : (
                    "dry"
                  )}
                </span>
                <span className="flex flex-wrap justify-end gap-1 sm:min-h-5 sm:justify-center">
                  {day.alerts.map(alert => (
                    <AlertFlag key={alert} alert={alert} />
                  ))}
                </span>
              </li>
            );
          })}
        </ol>
      </Plaque>
      <p className="mt-3 mb-0 text-xs text-muted-foreground">
        Forecast in °C, fetched {timeAgo(forecast.fetchedAt)}. Weather data by{" "}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="text-inherit underline underline-offset-2">
          Open-Meteo.com
        </a>
        .
      </p>
    </section>
  );
}
