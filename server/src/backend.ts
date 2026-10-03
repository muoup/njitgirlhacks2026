import type {
  DashboardData, GardensData, InsightsResult, PlantData, ReadingData,
  ReadingRange, ReadingsData,
} from "./schemas";

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

const fixtureTime = "2026-10-03T12:00:00.000Z";
const meta = () => ({ source: "mock" as const, hydratedAt: new Date().toISOString() });

function fixtures(identity: BackendIdentity) {
  // Each account has its own deterministic fixture IDs; another account cannot query them.
  const suffix = identity.accountId;
  const gardens = [
    { id: `garden-herbs-${suffix}`, name: "Kitchen herbs", plantCount: 2, deviceCount: 1 },
    { id: `garden-patio-${suffix}`, name: "Patio garden", plantCount: 1, deviceCount: 1 },
  ];
  const plants: PlantData[] = [
    { id: `plant-basil-${suffix}`, gardenId: gardens[0].id, name: "Basil", species: "Ocimum basilicum" },
    { id: `plant-mint-${suffix}`, gardenId: gardens[0].id, name: "Mint", species: "Mentha" },
    { id: `plant-tomato-${suffix}`, gardenId: gardens[1].id, name: "Tomato", species: "Solanum lycopersicum" },
  ];
  const devices = gardens.map((garden, index) => ({
    id: `device-${index + 1}-${suffix}`, gardenId: garden.id,
    name: `Soil monitor ${index + 1}`, lastSeenAt: fixtureTime,
  }));
  return { gardens, plants, devices };
}

function reading(plantId: string, deviceId: string, measuredAt: string, index = 0): ReadingData {
  return {
    plantId, deviceId, measuredAt,
    measurements: [
      { metric: "soil_moisture", value: 40 + (index % 9), unit: "%" },
      { metric: "temperature", value: 22 + (index % 5) * 0.5, unit: "°C" },
    ],
  };
}

function insights(gardenId: string): InsightsResult {
  return {
    insights: {
      gardenId, status: "ready", generatedAt: fixtureTime,
      items: [{
        id: `insight-${gardenId}`, plantId: null,
        text: "Demo insight: soil moisture is steady. Compare its trend before adjusting watering.",
      }],
    },
    meta: meta(),
  };
}

// Replace this with an HTTP adapter once the teammate's API is agreed.
// Domain data is never stored in the BFF. Fixture generation is development scaffolding.
export class MockBackend implements BackendAdapter {
  async listGardens(identity: BackendIdentity): Promise<GardensData> {
    return { gardens: fixtures(identity).gardens, meta: meta() };
  }

  async hydrateDashboard(identity: BackendIdentity, gardenId: string): Promise<DashboardData | null> {
    const data = fixtures(identity);
    const garden = data.gardens.find(item => item.id === gardenId);
    if (!garden) return null;
    const plants = data.plants.filter(item => item.gardenId === gardenId);
    const devices = data.devices.filter(item => item.gardenId === gardenId);
    return {
      garden, plants, devices,
      latestReadings: plants.map(plant => reading(plant.id, devices[0].id, fixtureTime)),
      insights: insights(gardenId).insights,
      meta: meta(),
    };
  }

  async getReadings(identity: BackendIdentity, plantId: string, range: ReadingRange): Promise<ReadingsData | null> {
    const data = fixtures(identity);
    const plant = data.plants.find(item => item.id === plantId);
    if (!plant) return null;
    const device = data.devices.find(item => item.gardenId === plant.gardenId)!;
    const from = Date.parse(range.from);
    const to = Date.parse(range.to);
    // At most 169 hourly points in the validated seven-day range, inclusive.
    const readings: ReadingData[] = [];
    for (let timestamp = from, index = 0; timestamp <= to; timestamp += 3_600_000, index++) {
      readings.push(reading(plantId, device.id, new Date(timestamp).toISOString(), index));
    }
    return { plantId, ...range, readings, meta: meta() };
  }

  async getInsights(identity: BackendIdentity, gardenId: string): Promise<InsightsResult | null> {
    return fixtures(identity).gardens.some(item => item.id === gardenId) ? insights(gardenId) : null;
  }

  async hasPlant(identity: BackendIdentity, plantId: string): Promise<boolean> {
    return fixtures(identity).plants.some(item => item.id === plantId);
  }
}
