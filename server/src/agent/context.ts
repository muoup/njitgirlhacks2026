import type { BackendAdapter, BackendIdentity } from "../backend";
import type { DashboardData, ReadingData } from "../schemas";
import { ApiError } from "../errors";
import type { MemoryData } from "./schemas";

export function summarize(readings: ReadingData[]) {
  const metrics = new Map<string, { at: string; value: number; unit: string }[]>();
  for (const reading of [...readings].sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt))) {
    for (const measurement of reading.measurements) {
      const key = `${measurement.metric}\0${measurement.unit}`;
      const samples = metrics.get(key) ?? [];
      samples.push({ at: reading.measuredAt, value: measurement.value, unit: measurement.unit });
      metrics.set(key, samples);
    }
  }
  return [...metrics].map(([key, samples]) => ({
    metric: key.split("\0")[0]!, unit: samples[0]!.unit, samples: samples.length,
    first: samples[0]!, last: samples.at(-1)!,
    min: Math.min(...samples.map(sample => sample.value)), max: Math.max(...samples.map(sample => sample.value)),
    mean: samples.reduce((sum, sample) => sum + sample.value, 0) / samples.length,
    change: samples.at(-1)!.value - samples[0]!.value,
  }));
}

export interface AccountContext {
  observedAt: string;
  memory: MemoryData;
  gardens: Array<{
    garden: DashboardData["garden"]; plants: DashboardData["plants"];
    devices: DashboardData["devices"]; latestReadings: DashboardData["latestReadings"];
    source: "mock" | "backend";
    histories: Array<{ plantId: string; digest: string; metrics: ReturnType<typeof summarize>; sampling?: { method: "last"; bucketSeconds: number } }>;
  }>;
}

export function revision(context: AccountContext) {
  // Fetch time alone is not a substantive input change.
  const { observedAt, memory, ...data } = context;
  return new Bun.CryptoHasher("sha256").update(JSON.stringify({ ...data, memory: {
    markdown: memory.markdown, revision: memory.revision, source: memory.source,
  } })).digest("hex");
}

export async function buildContext(backend: BackendAdapter, identity: BackendIdentity, now: number): Promise<AccountContext> {
  const { gardens } = await backend.listGardens(identity);
  if (gardens.length > 20) throw new ApiError(429, "CONTEXT_LIMIT", "This v0 supports at most 20 gardens per account.");
  const context: AccountContext = { observedAt: new Date(now).toISOString(),
    memory: await backend.readMemory(identity), gardens: [] };
  const range = { from: new Date(now - 7 * 86_400_000).toISOString(), to: context.observedAt };
  let plantCount = 0;
  for (const garden of [...gardens].sort((a, b) => a.id.localeCompare(b.id))) {
    const dashboard = await backend.hydrateDashboard(identity, garden.id);
    if (!dashboard) continue; // A garden may disappear between backend requests.
    plantCount += dashboard.plants.length;
    if (plantCount > 100) throw new ApiError(429, "CONTEXT_LIMIT", "This v0 supports at most 100 plants per account.");
    const histories: AccountContext["gardens"][number]["histories"] = [];
    for (const plant of [...dashboard.plants].sort((a, b) => a.id.localeCompare(b.id))) {
      const history = await backend.getReadings(identity, plant.id, range);
      const readings = history?.readings ?? [];
      histories.push({ plantId: plant.id, metrics: summarize(readings),
        ...(history?.sampling ? { sampling: history.sampling } : {}),
        digest: new Bun.CryptoHasher("sha256").update(JSON.stringify(readings)).digest("hex") });
    }
    context.gardens.push({ garden: dashboard.garden, plants: dashboard.plants, devices: dashboard.devices,
      latestReadings: dashboard.latestReadings, source: dashboard.meta.source, histories });
  }
  return context;
}
