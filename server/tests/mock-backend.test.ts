import { describe, expect, test } from "bun:test";
import { MockBackend, type BackendIdentity } from "../src/backend";
import { HOUR } from "../src/fixtures";

const identity: BackendIdentity = { version: "v1", userId: "test-user", accountId: "test-user" };

describe("mock backend timeline", () => {
  test("latest readings equal history at the same timestamp, even across overlapping ranges", async () => {
    let now = Date.parse("2026-10-03T12:04:00Z");
    const backend = new MockBackend(() => now);
    const { gardens } = await backend.listGardens(identity);
    const dashboard = (await backend.hydrateDashboard(identity, gardens[0].id))!;
    const latest = dashboard.latestReadings[0];
    const single = (await backend.getReadings(identity, latest.plantId, {
      from: latest.measuredAt, to: latest.measuredAt,
    }))!;
    expect(single.readings).toEqual([latest]);

    const start = Date.parse(latest.measuredAt);
    const wide = (await backend.getReadings(identity, latest.plantId, {
      from: new Date(start - 6 * HOUR).toISOString(), to: new Date(now + HOUR).toISOString(),
    }))!;
    expect(wide.readings.every(reading => Date.parse(reading.measuredAt) <= start)).toBe(true);

    now += 2 * HOUR;
    const narrow = (await backend.getReadings(identity, latest.plantId, {
      from: new Date(start - 2 * HOUR).toISOString(), to: latest.measuredAt,
    }))!;
    expect(narrow.readings).toEqual(wide.readings.filter(reading => Date.parse(reading.measuredAt) >= start - 2 * HOUR));
    expect(narrow.readings.at(-1)).toEqual(latest);
  });

  test("unreported plants have no health assessment or invented history", async () => {
    const backend = new MockBackend(() => Date.parse("2026-10-03T12:04:00Z"));
    const { gardens } = await backend.listGardens(identity);
    const dashboard = (await backend.hydrateDashboard(identity, gardens[0].id))!;
    const unreported = dashboard.plants.find(plant => plant.status === undefined)!;
    expect(dashboard.latestReadings.some(reading => reading.plantId === unreported.id)).toBe(false);
    expect((await backend.getReadings(identity, unreported.id, {
      from: "2026-10-03T00:00:00Z", to: "2026-10-03T12:00:00Z",
    }))!.readings).toEqual([]);
    expect(dashboard.insights.items.filter(item => item.needsFollowUp).every(item =>
      item.plantId && dashboard.plants.some(plant => plant.id === item.plantId),
    )).toBe(true);
  });
});
