import { describe, expect, test } from "bun:test";
import { alertsFor, forecastFor, OpenMeteo, WeatherAway } from "../src/weather";

// Shaped as Open-Meteo answers, with one day for each line a forecast can cross.
const daily = {
  time: ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"],
  weather_code: [3, 0, 80, 63, 96, 71, 45],
  temperature_2m_max: [29.2, 33.4, 30.2, 24.0, 28.6, 3.1, 18.0],
  temperature_2m_min: [25.3, 24.6, 25.3, 19.5, 22.0, -1.4, 11.0],
  precipitation_sum: [0, 0, 8.34, 31.2, 6.0, 4.0, 0],
  precipitation_probability_max: [9, 5, 63, 95, 40, 80, 10],
  sunshine_duration: [38511.94, 41000, 21600, 1800, 9000, 14400, 3000],
  wind_gusts_10m_max: [30.6, 12, 14, 44, 72.3, 20, 9],
};
function source(clock: () => number, answer: () => Response = () => Response.json({ daily })) {
  const calls: URL[] = [];
  const weather = new OpenMeteo((async (url: URL) => { calls.push(url); return answer(); }) as unknown as typeof fetch, clock);
  return { weather, calls };
}
const miami = { name: "Miami, Florida, United States", latitude: 25.77427, longitude: -80.19366 };

describe("weather", () => {
  test("a forecast is seven named days in plain units, each with the lines it crosses", async () => {
    const { weather, calls } = source(() => Date.parse("2026-10-04T12:00:00Z"));
    const { days, fetchedAt } = await weather.forecast(miami);
    expect(fetchedAt).toBe("2026-10-04T12:00:00.000Z");
    expect(days.map(day => day.day)).toEqual(["today", "tomorrow", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
    expect(days[0]).toEqual({ date: "2026-10-04", day: "today", sky: "Overcast", high: 29, low: 25, rain: 0, rainChance: 9, sunshine: 11, gust: 31, alerts: [] });
    expect(days.map(day => day.alerts)).toEqual([[], ["heat"], ["rain"], ["downpour", "dull"], ["storm", "wind"], ["frost"], ["dull"]]);
    expect(days.map(day => day.sky)).toEqual(["Overcast", "Clear", "Showers", "Rain", "Thunderstorm", "Snow", "Fog"]);
    // The service is asked about the town, not the doorstep.
    expect(calls[0]!.searchParams.get("latitude")).toBe("25.77");
    expect(calls[0]!.searchParams.get("longitude")).toBe("-80.19");
  });

  test("rain counts only when there is enough of it and it is likely", () => {
    const day = { sky: "Rain" as const, high: 20, low: 12, rain: 6, rainChance: 40, sunshine: 5, gust: 10 };
    expect(alertsFor(day)).toEqual([]);
    expect(alertsFor({ ...day, rainChance: 60 })).toEqual(["rain"]);
    expect(alertsFor({ ...day, rain: 4, rainChance: 90 })).toEqual([]);
  });

  test("a forecast is kept for an hour, and an older one stands in while the service is away", async () => {
    let now = Date.parse("2026-10-04T12:00:00Z");
    let up = true;
    const { weather, calls } = source(() => now, () => up ? Response.json({ daily }) : new Response("", { status: 503 }));
    const first = await weather.forecast(miami);
    now += 59 * 60_000;
    expect(await weather.forecast({ latitude: 25.771, longitude: -80.189 })).toEqual(first);
    expect(calls).toHaveLength(1);
    now += 2 * 60_000;
    up = false;
    expect(await weather.forecast(miami)).toEqual(first);
    expect(calls).toHaveLength(2);
    now += 6 * 3_600_000;
    await expect(weather.forecast(miami)).rejects.toThrow("503");
  });

  test("a forecast that has just failed is left alone for a few minutes, and quietly", async () => {
    let now = Date.parse("2026-10-04T12:00:00Z");
    let up = false;
    const { weather, calls } = source(() => now, () => up ? Response.json({ daily }) : new Response("", { status: 503 }));
    await expect(weather.forecast(miami)).rejects.toThrow("503");
    now += 60_000;
    await expect(weather.forecast(miami)).rejects.toBeInstanceOf(WeatherAway);
    const logged = console.error; let lines = 0; console.error = () => { lines += 1; };
    try { expect(await forecastFor(weather, { location: miami })).toBeUndefined(); } finally { console.error = logged; }
    expect(lines).toBe(0);
    expect(calls).toHaveLength(1);
    now += 5 * 60_000;
    up = true;
    expect((await weather.forecast(miami)).days).toHaveLength(7);
    expect(calls).toHaveLength(2);
  });

  test("a garden without a location, or whose forecast fails, simply has none", async () => {
    const { weather, calls } = source(Date.now, () => new Response("", { status: 500 }));
    expect(await forecastFor(weather, {})).toBeUndefined();
    expect(calls).toHaveLength(0);
    const logged = console.error; console.error = () => {};
    try { expect(await forecastFor(weather, { location: miami })).toBeUndefined(); } finally { console.error = logged; }
    const working = source(() => Date.parse("2026-10-04T12:00:00Z")).weather;
    expect(await forecastFor(working, { location: miami })).toMatchObject({ place: miami.name, days: expect.any(Array) });
  });

  test("a town search names each match and coarsens where it is", async () => {
    const { weather, calls } = source(Date.now, () => Response.json({ results: [
      { name: "Miami", latitude: 25.77427, longitude: -80.19366, admin1: "Florida", country: "United States" },
      { name: "Singapore", latitude: 1.28967, longitude: 103.85007, admin1: "Singapore", country: "Singapore" },
      { name: "Nowhere" },
    ] }));
    expect(await weather.search("Miami")).toEqual([
      { name: "Miami, Florida, United States", latitude: 25.77, longitude: -80.19 },
      { name: "Singapore", latitude: 1.29, longitude: 103.85 },
    ]);
    expect(calls[0]!.searchParams.get("name")).toBe("Miami");
    expect(await source(Date.now, () => Response.json({})).weather.search("zz")).toEqual([]);
  });
});
