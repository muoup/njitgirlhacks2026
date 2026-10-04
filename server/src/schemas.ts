import { t, type Static } from "elysia";
import { Generation, PlantOverview } from "./agent/schemas";

export const Id = t.String({ minLength: 1 });
export const Timestamp = t.String({ format: "date-time" });
export const ErrorResponse = t.Object({
  error: t.Object({ code: t.String(), message: t.String() }),
});
export const Garden = t.Object({
  id: Id,
  name: t.String(),
  plantCount: t.Integer({ minimum: 0 }),
  deviceCount: t.Integer({ minimum: 0 }),
});
export const PlantStatus = t.Union([t.Literal("healthy"), t.Literal("needs_care")], {
  description: "Omitted when plant health has not been assessed.",
});
export const Plant = t.Object({
  id: Id, gardenId: Id, name: t.String(), species: t.String(),
  status: t.Optional(PlantStatus),
});
export const Device = t.Object({
  id: Id,
  gardenId: Id,
  name: t.String(),
  lastSeenAt: t.Union([Timestamp, t.Null()]),
});
export const Measurement = t.Object({
  metric: t.String({ description: "Metric identifier; sensor-specific naming is provisional." }),
  value: t.Number(),
  unit: t.String(),
});
export const Reading = t.Object({
  plantId: Id,
  deviceId: Id,
  measuredAt: Timestamp,
  measurements: t.Array(Measurement),
});
export const InsightItem = t.Object({
  id: Id, plantId: t.Union([Id, t.Null()]), text: t.String(),
  needsFollowUp: t.Boolean({ description: "Whether the note calls for follow-up; false for informational notes." }),
});
export const Insights = t.Object({
  gardenId: Id,
  status: t.Union([t.Literal("unavailable"), t.Literal("ready")]),
  generatedAt: t.Union([Timestamp, t.Null()]),
  items: t.Array(InsightItem),
  overviews: t.Optional(t.Array(PlantOverview)),
  generation: t.Optional(Generation),
});
export const Meta = t.Object({
  source: t.Union([t.Literal("mock"), t.Literal("backend")]),
  hydratedAt: Timestamp,
});
export const MeResponse = t.Object({
  user: t.Object({ id: Id, name: t.String(), email: t.String({ format: "email" }) }),
  account: t.Object({ id: Id }),
});
export const GardensResponse = t.Object({ gardens: t.Array(Garden), meta: Meta });
export const DashboardResponse = t.Object({
  garden: Garden,
  plants: t.Array(Plant),
  devices: t.Array(Device),
  latestReadings: t.Array(Reading),
  insights: Insights,
  meta: Meta,
});
export const ReadingsQuery = t.Object({
  from: Timestamp,
  to: Timestamp,
});
export const ReadingsResponse = t.Object({
  plantId: Id,
  from: Timestamp,
  to: Timestamp,
  readings: t.Array(Reading),
  sampling: t.Optional(t.Object({ method: t.Literal("last"), bucketSeconds: t.Integer({ minimum: 1 }) })),
  meta: Meta,
});
export const InsightsResponse = t.Object({ insights: Insights, meta: Meta });

const ResourceName = t.String({ minLength: 1, maxLength: 200, pattern: "\\S" });
export const NewGarden = t.Object({ name: ResourceName });
export const NewPlant = t.Object({ name: ResourceName, species: ResourceName });
export const ApiKey = t.Object({
  key: t.String({ minLength: 1, description: "Firmware credential issued by the backend; treat as a secret." }),
  createdAt: Timestamp,
});
export const GardenResponse = t.Object({ garden: Garden });
export const ApiKeyResponse = t.Object({ apiKey: ApiKey });
export const PlantedResponse = t.Object({ plant: Plant, apiKey: ApiKey });

export type GardenData = Static<typeof Garden>;
export type PlantData = Static<typeof Plant>;
export type PlantStatusData = Static<typeof PlantStatus>;
export type DeviceData = Static<typeof Device>;
export type MeasurementData = Static<typeof Measurement>;
export type InsightItemData = Static<typeof InsightItem>;
export type MetaData = Static<typeof Meta>;
export type ReadingData = Static<typeof Reading>;
export type InsightsData = Static<typeof Insights>;
export type DashboardData = Static<typeof DashboardResponse>;
export type GardensData = Static<typeof GardensResponse>;
export type ReadingsData = Static<typeof ReadingsResponse>;
export type InsightsResult = Static<typeof InsightsResponse>;
export type ReadingRange = Static<typeof ReadingsQuery>;
export type NewPlantData = Static<typeof NewPlant>;
export type ApiKeyData = Static<typeof ApiKey>;
export type GardenResult = Static<typeof GardenResponse>;
export type ApiKeyResult = Static<typeof ApiKeyResponse>;
export type PlantedResult = Static<typeof PlantedResponse>;
