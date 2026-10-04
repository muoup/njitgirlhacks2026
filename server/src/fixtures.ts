import type { DeviceData, GardenData, InsightItemData, PlantData, ReadingData } from "./schemas";

export const HOUR = 3_600_000;
const WEEK = 7 * 24 * HOUR;
export const REPORT_DELAY = 4 * 60_000;

interface Profile {
  metric: string;
  unit: string;
  base: number;
  swing: number;
  fall?: number;
}

export interface FixturePlant extends PlantData {
  seed: number;
  /** Absent when the plant has never reported measurements. */
  profiles?: Profile[];
  /** The colour its monitor's colour sensor sees. */
  leaf?: string;
}

function climate(moisture: number, temperature: number, humidity: number, fall?: number): Profile[] {
  return [
    { metric: "soil_moisture", unit: "%", base: moisture, swing: 1.5, fall },
    { metric: "temperature", unit: "°C", base: temperature, swing: 2.5 },
    { metric: "humidity", unit: "%", base: humidity, swing: 5 },
  ];
}

const gardens: GardenData[] = [
  { id: "garden-back", name: "Back garden", plantCount: 5, deviceCount: 2, setting: "outdoors" },
  { id: "garden-sill", name: "Windowsill", plantCount: 2, deviceCount: 1, setting: "indoors" },
  { id: "garden-new", name: "New bed", plantCount: 0, deviceCount: 0, setting: "outdoors" },
];

const plants: FixturePlant[] = [
  { id: "plant-basil", gardenId: "garden-back", name: "Basil", species: "Ocimum basilicum", status: "healthy", seed: 1, profiles: climate(52, 21.5, 58), leaf: "#4f9140" },
  { id: "plant-mint", gardenId: "garden-back", name: "Mint", species: "Mentha spicata", status: "healthy", seed: 2, profiles: climate(60, 21, 60), leaf: "#5aa552" },
  { id: "plant-fern", gardenId: "garden-back", name: "Fern", species: "Nephrolepis exaltata", status: "needs_care", seed: 3, profiles: climate(21, 19.5, 64, 27), leaf: "#8a8f3c" },
  { id: "plant-sage", gardenId: "garden-back", name: "Sage", species: "Salvia officinalis", status: "healthy", seed: 4, profiles: climate(44, 22, 55), leaf: "#8c9c7e" },
  { id: "plant-thyme", gardenId: "garden-back", name: "Thyme", species: "Thymus vulgaris", seed: 5 },
  { id: "plant-aloe", gardenId: "garden-sill", name: "Aloe", species: "Aloe vera", status: "healthy", seed: 6, profiles: climate(31, 23, 42), leaf: "#6fa57c" },
  { id: "plant-pothos", gardenId: "garden-sill", name: "Pothos", species: "Epipremnum aureum", status: "healthy", seed: 7, profiles: climate(55, 22.5, 48), leaf: "#4c9a46" },
];

const devices: (Omit<DeviceData, "lastSeenAt"> & { reports: boolean })[] = [
  { id: "device-back-1", gardenId: "garden-back", name: "Bed monitor", reports: true },
  { id: "device-back-2", gardenId: "garden-back", name: "Herb pot monitor", reports: false },
  { id: "device-sill-1", gardenId: "garden-sill", name: "Sill monitor", reports: true },
];

const insights: Record<string, InsightItemData[]> = {
  "garden-back": [
    { id: "insight-fern", plantId: "plant-fern", needsFollowUp: true,
      text: "Soil moisture has fallen all week and is now close to 20%. Water today, then check that it recovers by tomorrow." },
    { id: "insight-thyme", plantId: "plant-thyme", needsFollowUp: true,
      text: "No readings have arrived for this plant. Check that its monitor has power and is in range." },
    { id: "insight-mint", plantId: "plant-mint", needsFollowUp: false,
      text: "Soil moisture has held between 55% and 65% all week. No change needed." },
    { id: "insight-back", plantId: null, needsFollowUp: false,
      text: "Apart from the fern, readings across this garden have been steady for the past seven days." },
  ],
  "garden-sill": [
    { id: "insight-sill", plantId: null, needsFollowUp: false,
      text: "Both plants have been steady all week. Nothing to do." },
  ],
};

/** Scope every ID and cross-reference to the authenticated account. */
export function accountFixtures(accountId: string) {
  const id = (value: string) => `${value}-${accountId}`;
  return {
    gardens: gardens.map(garden => ({ ...garden, id: id(garden.id) })),
    plants: plants.map(plant => ({ ...plant, id: id(plant.id), gardenId: id(plant.gardenId) })),
    devices: devices.map(device => ({ ...device, id: id(device.id), gardenId: id(device.gardenId) })),
    insights: Object.fromEntries(Object.entries(insights).map(([gardenId, items]) => [
      id(gardenId), items.map(item => ({ ...item, id: id(item.id), plantId: item.plantId ? id(item.plantId) : null })),
    ])),
  };
}

function noise(seed: number, position: number) {
  const value = Math.sin(seed * 12.9898 + position * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function fixtureReading(plant: FixturePlant, deviceId: string, at: number, referenceTime: number): ReadingData {
  const date = new Date(at);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  return {
    plantId: plant.id, deviceId, measuredAt: date.toISOString(), ...(plant.leaf ? { color: plant.leaf } : {}),
    measurements: (plant.profiles ?? []).map((profile, index) => {
      const daily = Math.sin(((hour - 9) / 24) * 2 * Math.PI) * profile.swing;
      const trend = ((profile.fall ?? 0) * (referenceTime - at)) / WEEK;
      const jitter = (noise(plant.seed + index * 31, Math.floor(at / HOUR)) - 0.5) * profile.swing * 0.5;
      const raw = profile.base + daily + trend + jitter;
      const bounded = profile.unit === "%" ? Math.min(100, Math.max(0, raw)) : raw;
      return { metric: profile.metric, unit: profile.unit, value: Math.round(bounded * 10) / 10 };
    }),
  };
}
