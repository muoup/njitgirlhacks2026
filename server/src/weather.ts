import { t, type Static } from "elysia";
import { logFailure } from "./diagnostics";

const HOUR = 3_600_000;

export const Place = t.Object({
  name: t.String({ minLength: 1, maxLength: 200, pattern: "\\S", description: "The town as it is shown, such as Miami, Florida, United States." }),
  latitude: t.Number({ minimum: -90, maximum: 90 }),
  longitude: t.Number({ minimum: -180, maximum: 180 }),
});
export const Alert = t.Union([t.Literal("frost"), t.Literal("heat"), t.Literal("rain"), t.Literal("downpour"),
  t.Literal("storm"), t.Literal("wind"), t.Literal("dull")]);
export const Sky = t.Union([t.Literal("Clear"), t.Literal("Partly cloudy"), t.Literal("Overcast"), t.Literal("Fog"),
  t.Literal("Drizzle"), t.Literal("Rain"), t.Literal("Showers"), t.Literal("Snow"), t.Literal("Thunderstorm")]);
export const ForecastDay = t.Object({
  date: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "The day at the garden's location." }),
  day: t.String({ description: "The day in a word: today, tomorrow, then the weekday." }),
  sky: Sky,
  high: t.Number({ description: "°C" }), low: t.Number({ description: "°C" }),
  rain: t.Number({ description: "Rain and other precipitation over the day, in mm." }),
  rainChance: t.Number({ description: "The chance of any, in %." }),
  sunshine: t.Number({ description: "Hours of sunshine." }),
  gust: t.Number({ description: "The strongest gust, in km/h." }),
  alerts: t.Array(Alert, { description: "The lines this day crosses. Empty for an ordinary day." }),
});
export const Forecast = t.Object({
  place: t.String(),
  fetchedAt: t.String({ format: "date-time" }),
  days: t.Array(ForecastDay, { description: "Today first, then the six days after it." }),
});
export type PlaceData = Static<typeof Place>;
export type AlertData = Static<typeof Alert>;
export type ForecastDayData = Static<typeof ForecastDay>;
export type ForecastData = Static<typeof Forecast>;

/** Where forecasts and town names come from. Either call may fail; a garden does without its forecast then. */
export interface WeatherSource {
  search(query: string): Promise<PlaceData[]>;
  forecast(place: Pick<PlaceData, "latitude" | "longitude">): Promise<{ fetchedAt: string; days: ForecastDayData[] }>;
}

// WMO weather codes, as Open-Meteo reports them.
function sky(code: number): Static<typeof Sky> {
  if (code >= 95) return "Thunderstorm";
  if (code >= 85) return "Snow";
  if (code >= 80) return "Showers";
  if (code >= 71) return "Snow";
  if (code >= 61) return "Rain";
  if (code >= 51) return "Drizzle";
  if (code >= 45) return "Fog";
  return code === 3 ? "Overcast" : code === 2 ? "Partly cloudy" : "Clear";
}

/** The lines a day crosses. They are fixed here so that a warning never rests on a model's reading of the numbers. */
export function alertsFor(day: Pick<ForecastDayData, "sky" | "high" | "low" | "rain" | "rainChance" | "sunshine" | "gust">): AlertData[] {
  return [
    ...(day.low <= 2 ? ["frost" as const] : []),
    ...(day.high >= 32 ? ["heat" as const] : []),
    // Enough to count as a watering, and likely enough to plan around.
    ...(day.rain >= 25 ? ["downpour" as const] : day.rain >= 5 && day.rainChance >= 50 ? ["rain" as const] : []),
    ...(day.sky === "Thunderstorm" ? ["storm" as const] : []),
    ...(day.gust >= 50 ? ["wind" as const] : []),
    ...(day.sunshine < 2 ? ["dull" as const] : []),
  ];
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const round = (value: number, places = 0) => Math.round(value * 10 ** places) / 10 ** places;

/** Coordinates are kept to two places: near enough for a forecast, and no nearer than a town. */
export function coarse<T extends Pick<PlaceData, "latitude" | "longitude">>(place: T): T {
  return { ...place, latitude: round(place.latitude, 2), longitude: round(place.longitude, 2) };
}

/** Open-Meteo: forecasts and town search without a key. A forecast is kept for an hour. */
export class OpenMeteo implements WeatherSource {
  private readonly cache = new Map<string, { at: number; fetchedAt: string; days: ForecastDayData[] }>();

  constructor(private readonly fetcher: typeof fetch = fetch, private readonly clock: () => number = Date.now) {}

  private async get(url: URL) {
    const response = await this.fetcher(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
    return response.json() as Promise<any>;
  }

  async search(query: string): Promise<PlaceData[]> {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.search = String(new URLSearchParams({ name: query, count: "5", language: "en", format: "json" }));
    const results: any[] = (await this.get(url)).results ?? [];
    return results.flatMap(result => typeof result.latitude === "number" && typeof result.longitude === "number" && result.name
      ? [coarse({ latitude: result.latitude, longitude: result.longitude,
        name: [...new Set([result.name, result.admin1, result.country].filter(Boolean))].join(", ").slice(0, 200) })] : []);
  }

  async forecast(place: Pick<PlaceData, "latitude" | "longitude">) {
    const { latitude, longitude } = coarse(place);
    const key = `${latitude},${longitude}`;
    const now = this.clock();
    const kept = this.cache.get(key);
    if (kept && now - kept.at < HOUR) return { fetchedAt: kept.fetchedAt, days: kept.days };
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = String(new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), timezone: "auto", forecast_days: "7",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunshine_duration,wind_gusts_10m_max" }));
    let daily: Record<string, any[]>;
    try { daily = (await this.get(url)).daily; } catch (error) {
      // A forecast a few hours old is better than none while the service is away.
      if (kept && now - kept.at < 6 * HOUR) return { fetchedAt: kept.fetchedAt, days: kept.days };
      throw error;
    }
    const days = (daily.time as string[]).map((date, index): ForecastDayData => {
      const measured = {
        sky: sky(daily.weather_code?.[index] ?? 0),
        high: round(daily.temperature_2m_max?.[index] ?? NaN), low: round(daily.temperature_2m_min?.[index] ?? NaN),
        rain: round(daily.precipitation_sum?.[index] ?? 0, 1), rainChance: round(daily.precipitation_probability_max?.[index] ?? 0),
        sunshine: round((daily.sunshine_duration?.[index] ?? 0) / 3600), gust: round(daily.wind_gusts_10m_max?.[index] ?? 0),
      };
      return { date, day: index === 0 ? "today" : index === 1 ? "tomorrow" : WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!,
        ...measured, alerts: alertsFor(measured) };
    }).filter(day => Number.isFinite(day.high) && Number.isFinite(day.low));
    if (!days.length) throw new Error("Weather response held no days.");
    if (this.cache.size >= 500) this.cache.clear();
    const entry = { at: now, fetchedAt: new Date(now).toISOString(), days };
    this.cache.set(key, entry);
    return { fetchedAt: entry.fetchedAt, days };
  }
}

/** A garden's forecast, or nothing: when it has no location, or the forecast cannot be had. */
export async function forecastFor(weather: WeatherSource | undefined, garden: { location?: PlaceData }): Promise<ForecastData | undefined> {
  if (!weather || !garden.location) return undefined;
  try { return { place: garden.location.name, ...await weather.forecast(garden.location) }; }
  catch (error) {
    logFailure(error, { scope: "weather" });
    return undefined;
  }
}
