import type {
  DashboardData, GardensData, InsightsResult, ReadingRange, ReadingsData,
} from "./schemas";
import { accountFixtures, fixtureReading, HOUR, REPORT_DELAY } from "./fixtures";

// Internal identity boundary, not a signed token. A backend token protocol is TBD.
export interface BackendIdentity {
  version: "v1";
  userId: string;
  accountId: string;
}

export interface BackendAdapter {
  listGardens(identity: BackendIdentity): Promise<GardensData>;
  hydrateDashboard(identity: BackendIdentity, gardenId: string): Promise<DashboardData | null>;
  getReadings(identity: BackendIdentity, plantId: string, range: ReadingRange): Promise<ReadingsData | null>;
  getInsights(identity: BackendIdentity, gardenId: string): Promise<InsightsResult | null>;
  hasPlant(identity: BackendIdentity, plantId: string): Promise<boolean>;
}

// Replace this adapter once the teammate's HTTP API is agreed.
export class MockBackend implements BackendAdapter {
  private readonly referenceTime: number;

  constructor(private readonly clock: () => number = Date.now) {
    // Keep trend values stable across overlapping requests for this process.
    this.referenceTime = clock();
  }

  private meta(now: number) {
    return { source: "mock" as const, hydratedAt: new Date(now).toISOString() };
  }

  private latestAt(now: number) {
    // The mock monitors report hourly, with a four-minute reporting delay.
    return Math.floor((now - REPORT_DELAY) / HOUR) * HOUR;
  }

  private insights(data: ReturnType<typeof accountFixtures>, gardenId: string): InsightsResult["insights"] {
    const items = data.insights[gardenId];
    return items
      ? { gardenId, status: "ready", generatedAt: new Date(this.referenceTime - 2 * HOUR).toISOString(), items }
      : { gardenId, status: "unavailable", generatedAt: null, items: [] };
  }

  async listGardens(identity: BackendIdentity): Promise<GardensData> {
    return { gardens: accountFixtures(identity.accountId).gardens, meta: this.meta(this.clock()) };
  }

  async hydrateDashboard(identity: BackendIdentity, gardenId: string): Promise<DashboardData | null> {
    const data = accountFixtures(identity.accountId);
    const garden = data.gardens.find(item => item.id === gardenId);
    if (!garden) return null;
    const now = this.clock();
    const latestAt = this.latestAt(now);
    const plants = data.plants.filter(item => item.gardenId === gardenId);
    const devices = data.devices.filter(item => item.gardenId === gardenId);
    const device = devices.find(item => item.reports);
    return {
      garden,
      plants: plants.map(({ seed, profiles, ...plant }) => plant),
      devices: devices.map(({ reports, ...device }) => ({
        ...device, lastSeenAt: reports ? new Date(latestAt).toISOString() : null,
      })),
      latestReadings: plants.flatMap(plant => plant.profiles && device
        ? [fixtureReading(plant, device.id, latestAt, this.referenceTime)] : []),
      insights: this.insights(data, gardenId),
      meta: this.meta(now),
    };
  }

  async getReadings(identity: BackendIdentity, plantId: string, range: ReadingRange): Promise<ReadingsData | null> {
    const data = accountFixtures(identity.accountId);
    const plant = data.plants.find(item => item.id === plantId);
    if (!plant) return null;
    const now = this.clock();
    const device = data.devices.find(item => item.gardenId === plant.gardenId && item.reports);
    const readings: ReadingsData["readings"] = [];
    if (plant.profiles && device) {
      const end = Math.min(Date.parse(range.to), this.latestAt(now));
      // At most 169 hourly points in the validated seven-day inclusive range.
      for (let at = Math.ceil(Date.parse(range.from) / HOUR) * HOUR; at <= end; at += HOUR) {
        readings.push(fixtureReading(plant, device.id, at, this.referenceTime));
      }
    }
    return { plantId, ...range, readings, meta: this.meta(now) };
  }

  async getInsights(identity: BackendIdentity, gardenId: string): Promise<InsightsResult | null> {
    const data = accountFixtures(identity.accountId);
    return data.gardens.some(item => item.id === gardenId)
      ? { insights: this.insights(data, gardenId), meta: this.meta(this.clock()) } : null;
  }

  async hasPlant(identity: BackendIdentity, plantId: string): Promise<boolean> {
    return accountFixtures(identity.accountId).plants.some(item => item.id === plantId);
  }
}
