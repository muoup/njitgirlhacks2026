import { hasFixtureSession } from "@/lib/auth/fixture";
import {
  ApiError,
  type DashboardResponse,
  type Device,
  type Garden,
  type GroveApi,
  type InsightItem,
  type Plant,
  type Reading,
} from "./types";

/**
 * Sample gardens for building the dashboard without the BFF. Nothing here is a sensor
 * reading or a generated insight. Values are a pure function of plant and time, so the
 * history always ends at "now" and agrees with the latest reading.
 */

const HOUR = 3_600_000;
const WEEK = 7 * 24 * HOUR;
/** How long ago the monitors last reported. */
const LATEST_AGE = 4 * 60_000;
/** Long enough for loading states to be seen. */
const LATENCY = 350;

interface Profile {
  metric: string;
  unit: string;
  /** Value now. */
  base: number;
  /** Size of the daily rise and fall. */
  swing: number;
  /** How much higher the value was a week ago. */
  fall?: number;
}

interface FixturePlant extends Plant {
  seed: number;
  /** Absent for a plant whose monitor has never reported. */
  profiles?: Profile[];
}

function climate(moisture: number, temperature: number, humidity: number, fall?: number): Profile[] {
  return [
    { metric: "soil_moisture", unit: "%", base: moisture, swing: 1.5, fall },
    { metric: "temperature", unit: "°C", base: temperature, swing: 2.5 },
    { metric: "humidity", unit: "%", base: humidity, swing: 5 },
  ];
}

const GARDENS: Garden[] = [
  { id: "garden-back", name: "Back garden", plantCount: 5, deviceCount: 2 },
  { id: "garden-sill", name: "Windowsill", plantCount: 2, deviceCount: 1 },
  { id: "garden-new", name: "New bed", plantCount: 0, deviceCount: 0 },
];

const PLANTS: FixturePlant[] = [
  { id: "plant-basil", gardenId: "garden-back", name: "Basil", species: "Ocimum basilicum", status: "healthy", seed: 1, profiles: climate(52, 21.5, 58) },
  { id: "plant-mint", gardenId: "garden-back", name: "Mint", species: "Mentha spicata", status: "healthy", seed: 2, profiles: climate(60, 21, 60) },
  { id: "plant-fern", gardenId: "garden-back", name: "Fern", species: "Nephrolepis exaltata", status: "needs_care", seed: 3, profiles: climate(21, 19.5, 64, 27) },
  { id: "plant-sage", gardenId: "garden-back", name: "Sage", species: "Salvia officinalis", status: "healthy", seed: 4, profiles: climate(44, 22, 55) },
  { id: "plant-thyme", gardenId: "garden-back", name: "Thyme", species: "Thymus vulgaris", seed: 5 },
  { id: "plant-aloe", gardenId: "garden-sill", name: "Aloe", species: "Aloe vera", status: "healthy", seed: 6, profiles: climate(31, 23, 42) },
  { id: "plant-pothos", gardenId: "garden-sill", name: "Pothos", species: "Epipremnum aureum", status: "healthy", seed: 7, profiles: climate(55, 22.5, 48) },
];

/** `reports: false` marks a monitor that has never been heard from. */
const DEVICES: (Omit<Device, "lastSeenAt"> & { reports: boolean })[] = [
  { id: "device-back-1", gardenId: "garden-back", name: "Bed monitor", reports: true },
  { id: "device-back-2", gardenId: "garden-back", name: "Herb pot monitor", reports: false },
  { id: "device-sill-1", gardenId: "garden-sill", name: "Sill monitor", reports: true },
];

const INSIGHTS: Record<string, InsightItem[]> = {
  "garden-back": [
    {
      id: "insight-fern",
      plantId: "plant-fern",
      needsFollowUp: true,
      text: "Soil moisture has fallen all week and is now close to 20%. Water today, then check that it recovers by tomorrow.",
    },
    {
      id: "insight-thyme",
      plantId: "plant-thyme",
      needsFollowUp: true,
      text: "No readings have arrived for this plant. Check that its monitor has power and is in range.",
    },
    {
      id: "insight-mint",
      plantId: "plant-mint",
      text: "Soil moisture has held between 55% and 65% all week. No change needed.",
    },
    {
      id: "insight-back",
      plantId: null,
      text: "Apart from the fern, readings across this garden have been steady for the past seven days.",
    },
  ],
  "garden-sill": [
    {
      id: "insight-sill",
      plantId: null,
      text: "Both plants have been steady all week. Nothing to do.",
    },
  ],
};

/** A repeatable value in 0..1 for a whole-number position. */
function noise(seed: number, n: number) {
  const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function valueAt(profile: Profile, seed: number, at: number, now: number, index: number) {
  const hour = new Date(at).getHours() + new Date(at).getMinutes() / 60;
  // Peaks mid-afternoon.
  const daily = Math.sin(((hour - 9) / 24) * 2 * Math.PI) * profile.swing;
  const trend = ((profile.fall ?? 0) * (now - at)) / WEEK;
  const jitter = (noise(seed + index * 31, Math.floor(at / HOUR)) - 0.5) * profile.swing * 0.5;
  return Math.round((profile.base + daily + trend + jitter) * 10) / 10;
}

function readingAt(plant: FixturePlant, profiles: Profile[], deviceId: string, at: number, now: number): Reading {
  return {
    plantId: plant.id,
    deviceId,
    measuredAt: new Date(at).toISOString(),
    measurements: profiles.map((profile, index) => ({
      metric: profile.metric,
      unit: profile.unit,
      value: valueAt(profile, plant.seed, at, now, index),
    })),
  };
}

function reportingDevice(gardenId: string) {
  return DEVICES.find(device => device.gardenId === gardenId && device.reports);
}

async function respond<T>(build: () => T): Promise<T> {
  await new Promise(resolve => setTimeout(resolve, LATENCY));
  if (!hasFixtureSession()) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to access this endpoint.");
  return build();
}

const meta = () => ({ source: "mock" as const, hydratedAt: new Date().toISOString() });

export const fixtureApi: GroveApi = {
  listGardens: () => respond(() => ({ gardens: GARDENS, meta: meta() })),

  getDashboard: gardenId =>
    respond((): DashboardResponse => {
      const garden = GARDENS.find(item => item.id === gardenId);
      if (!garden) throw new ApiError(404, "NOT_FOUND", "Garden not found.");

      const now = Date.now();
      const latestAt = now - LATEST_AGE;
      const device = reportingDevice(gardenId);
      const plants = PLANTS.filter(plant => plant.gardenId === gardenId);
      const items = INSIGHTS[gardenId];

      return {
        garden,
        plants: plants.map(({ seed, profiles, ...plant }) => plant),
        devices: DEVICES.filter(item => item.gardenId === gardenId).map(({ reports, ...item }) => ({
          ...item,
          lastSeenAt: reports ? new Date(latestAt).toISOString() : null,
        })),
        latestReadings: plants.flatMap(plant =>
          plant.profiles && device ? [readingAt(plant, plant.profiles, device.id, latestAt, now)] : [],
        ),
        insights: items
          ? { gardenId, status: "ready", generatedAt: new Date(now - 2 * HOUR).toISOString(), items }
          : { gardenId, status: "unavailable", generatedAt: null, items: [] },
        meta: meta(),
      };
    }),

  getPlantReadings: (plantId, from, to) =>
    respond(() => {
      const plant = PLANTS.find(item => item.id === plantId);
      if (!plant) throw new ApiError(404, "NOT_FOUND", "Plant not found.");

      const now = Date.now();
      const device = reportingDevice(plant.gardenId);
      const readings: Reading[] = [];
      if (plant.profiles && device) {
        const end = Math.min(to.getTime(), now);
        for (let at = Math.ceil(from.getTime() / HOUR) * HOUR; at <= end; at += HOUR) {
          readings.push(readingAt(plant, plant.profiles, device.id, at, now));
        }
      }
      return { plantId, from: from.toISOString(), to: to.toISOString(), readings, meta: meta() };
    }),
};
