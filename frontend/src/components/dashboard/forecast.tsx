import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, type LucideIcon, Sun } from "lucide-react";

import type { Alert, ForecastDay } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const SKY: Record<ForecastDay["sky"], LucideIcon> = {
  Clear: Sun,
  "Partly cloudy": CloudSun,
  Overcast: Cloud,
  Fog: CloudFog,
  Drizzle: CloudDrizzle,
  Rain: CloudRain,
  Showers: CloudRain,
  Snow: CloudSnow,
  Thunderstorm: CloudLightning,
};

const WET = new Set<ForecastDay["sky"]>(["Drizzle", "Rain", "Showers"]);

/** The sky as a picture. A wet one is always in the colour of rain, whatever colour was asked for. */
export function SkyIcon({ sky, className }: { sky: ForecastDay["sky"]; className?: string }) {
  const Icon = SKY[sky] ?? Cloud;
  return <Icon aria-hidden="true" className={cn("size-6 shrink-0", className, WET.has(sky) && "text-grove-rain")} />;
}

/** The word for each line a day can cross, and the colour it is flagged in. */
export const ALERTS: Record<Alert, { word: string; color: string }> = {
  frost: { word: "Frost", color: "var(--grove-watch)" },
  heat: { word: "Heat", color: "var(--grove-watch)" },
  downpour: { word: "Downpour", color: "var(--grove-watch)" },
  storm: { word: "Storm", color: "var(--grove-watch)" },
  wind: { word: "Wind", color: "var(--grove-watch)" },
  // Rain is mostly good news for a garden, and a dull day only matters when several follow.
  rain: { word: "Rain", color: "var(--grove-rain)" },
  dull: { word: "Dull", color: "var(--muted-foreground)" },
};

/** A flagged day: the alert's word behind a small stone of its colour, as the garden's tally is marked. */
export function AlertFlag({ alert }: { alert: Alert }) {
  const { word, color } = ALERTS[alert];
  return (
    <span className="inline-flex items-center gap-1 text-[0.6875rem] leading-4 font-bold" style={{ color }}>
      <span aria-hidden="true" className="size-1.5 rotate-45 bg-current" />
      {word}
    </span>
  );
}

/** Weather to be ready for, as against rain that saves a watering or one dull day. */
export function isWarning(alert: Alert) {
  return alert !== "rain" && alert !== "dull";
}

/** "8.3 mm": rain to a tenth, and nothing at all for a dry day. */
export function rainAmount(day: ForecastDay) {
  return day.rain >= 0.1 ? `${formatNumber(day.rain)} mm` : null;
}

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** One day of the forecast on a line of its own, for a plant whose note points at that day. */
export function DayLine({ day }: { day: ForecastDay }) {
  const rain = rainAmount(day);
  return (
    <div>
      <p className="m-0 flex items-center gap-2 font-bold">
        <SkyIcon sky={day.sky} className="size-5 text-chart-1" />
        <span>
          {capital(day.day)} · {day.sky}
        </span>
      </p>
      <p className="mt-1.5 mb-0 text-xs text-muted-foreground tabular-nums">
        {day.high}° / {day.low}°{rain ? ` · ${rain} of rain, ${day.rainChance}% chance` : " · dry"}
        {day.gust >= 40 && ` · gusts ${day.gust} km/h`}
      </p>
    </div>
  );
}
