import type {
  DashboardData, GardensData, InsightsResult, ReadingRange, ReadingsData, GardenResult, PlantedResult, ApiKeyResult, InsightsData,
  PlantEditData, PlantResult, GardenEditData,
} from "./schemas";
import { accountFixtures, fixtureReading, HOUR, REPORT_DELAY } from "./fixtures";
import type { MemoryData, MemoryWriteData, MutationData } from "./agent/schemas";
import { ApiError } from "./errors";
import type { IngestData, IngestResult } from "./ingestion";
import { calibrate, metricCatalogue } from "./metrics";

export interface InsightSnapshot {
  revision: string; generatedAt: number; dirty: boolean; version?: number;
  gardens: Array<{ insights: InsightsData; fingerprint: string }>;
}

// Identity comes from Better Auth, never from browser/firmware request bodies.
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
  readMemory(identity: BackendIdentity): Promise<MemoryData>;
  writeMemory(identity: BackendIdentity, input: MemoryWriteData): Promise<MemoryData>;
  // The backend should use requestId as its idempotency key. Never pass keys to the model.
  mutate(identity: BackendIdentity, action: MutationData, requestId: string, expectedFingerprint?: string): Promise<GardenResult | PlantedResult | void>;
  replayMutation?(identity: BackendIdentity, action: MutationData, requestId: string): Promise<{ result: GardenResult | PlantedResult | void } | null>;
  updateGarden?(identity: BackendIdentity, gardenId: string, edit: GardenEditData): Promise<GardenResult>;
  updatePlant?(identity: BackendIdentity, plantId: string, edit: PlantEditData): Promise<PlantResult>;
  getPlantApiKey?(identity: BackendIdentity, plantId: string): Promise<ApiKeyResult>;
  replacePlantApiKey?(identity: BackendIdentity, plantId: string): Promise<ApiKeyResult>;
  ingest?(key: string, input: IngestData): Promise<IngestResult>;
  touchAccount?(identity: BackendIdentity): Promise<void>;
  listAgentAccounts?(): Promise<BackendIdentity[]>;
  readInsightSnapshot?(identity: BackendIdentity): Promise<InsightSnapshot>;
  writeInsightSnapshot?(identity: BackendIdentity, snapshot: InsightSnapshot): Promise<void>;
  recordInsightAttempt?(identity: BackendIdentity, at: number, error?: { code: string; message: string }): Promise<void>;
}

// Replace this adapter once the teammate's HTTP API is agreed.
export class MockBackend implements BackendAdapter {
  private readonly referenceTime: number;
  private readonly memories = new Map<string, MemoryData>();

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
      plants: plants.map(({ seed, profiles, leaf, ...plant }) => plant),
      devices: devices.map(({ reports, ...device }) => ({
        ...device, lastSeenAt: reports ? new Date(latestAt).toISOString() : null,
      })),
      latestReadings: plants.flatMap(plant => plant.profiles && device
        ? [calibrate(fixtureReading(plant, device.id, latestAt, this.referenceTime))] : []),
      insights: this.insights(data, gardenId),
      metrics: metricCatalogue,
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
        readings.push(calibrate(fixtureReading(plant, device.id, at, this.referenceTime)));
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

  async readMemory(identity: BackendIdentity): Promise<MemoryData> {
    return structuredClone(this.memories.get(identity.accountId) ?? {
      markdown: "", revision: 0, updatedAt: null, source: "mock",
    });
  }

  async writeMemory(identity: BackendIdentity, input: MemoryWriteData): Promise<MemoryData> {
    const current = await this.readMemory(identity);
    // Recheck after the await so concurrent compare-and-swap writes cannot both win.
    const revision = this.memories.get(identity.accountId)?.revision ?? 0;
    if (revision !== input.expectedRevision) throw new ApiError(409, "MEMORY_CONFLICT", "Memory changed; read it again before updating.");
    if (input.markdown.length > 16_384) throw new ApiError(422, "INVALID_REQUEST", "Memory is limited to 16,384 characters.");
    const next: MemoryData = { ...current, markdown: input.markdown, revision: revision + 1,
      updatedAt: new Date(this.clock()).toISOString() };
    this.memories.set(identity.accountId, next);
    return structuredClone(next);
  }

  async mutate(_identity: BackendIdentity, _action: MutationData, _requestId: string): Promise<GardenResult | PlantedResult | void> {
    throw new ApiError(501, "NOT_IMPLEMENTED", "Garden and plant changes await the backend protocol.");
  }
}
