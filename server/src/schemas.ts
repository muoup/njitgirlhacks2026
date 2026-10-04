import { t, type Static } from "elysia";
import { Generation, PlantOverview, Stop } from "./agent/schemas";
import { Block } from "./agent/blocks";
import { Forecast, Place } from "./weather";

export const Id = t.String({ minLength: 1 });
export const Timestamp = t.String({ format: "date-time" });
export const ErrorResponse = t.Object({
  error: t.Object({ code: t.String(), message: t.String() }),
});
export const Setting = t.Union([t.Literal("indoors"), t.Literal("outdoors")], {
  description: "Whether the garden's plants stand in the weather or behind a window." });
export const Garden = t.Object({
  id: Id,
  name: t.String(),
  plantCount: t.Integer({ minimum: 0 }),
  deviceCount: t.Integer({ minimum: 0 }),
  setting: Setting,
  location: t.Optional(Place),
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
  word: t.Optional(t.String({ description: "Where the value sits on the metric's scale, in a plain word such as Dry." })),
});
export const MetricInfo = t.Object({
  metric: t.String(),
  label: t.String({ description: "What the grove calls this metric." }),
  unit: t.String({ description: "The unit values are shown in; empty for a plain number." }),
  tier: t.Union([t.Literal("core"), t.Literal("detail")], {
    description: "Core metrics stand for a plant at a glance; detail ones belong with its full history." }),
  glance: t.Union([t.Literal("word"), t.Literal("value")], {
    description: "Whether the word or the number stands for a reading where there is room for only one." }),
  scale: t.Optional(t.Object({
    low: t.Number(), high: t.Number(),
    healthy: t.Object({ from: t.Number(), to: t.Number() }),
    bands: t.Array(t.Object({ from: t.Number(), word: t.String() }), { minItems: 1 }),
  }, { description: "The range a meter spans, the part of it a plant is well in, and the word for each stretch." })),
});
export const Reading = t.Object({
  plantId: Id,
  deviceId: Id,
  measuredAt: Timestamp,
  measurements: t.Array(Measurement),
  color: t.Optional(t.String({ pattern: "^#[0-9a-f]{6}$", description: "The colour the monitor's sensor saw, as a hex value. Absent when it sent none." })),
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
  blocks: t.Optional(t.Array(Block, { description: "What to draw beside the garden's own notes. Each names its plant." })),
  layout: t.Optional(t.Array(Stop, { description: "The order of stops on the dashboard. Absent when the page should decide." })),
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
  metrics: t.Array(MetricInfo, { description: "The metric catalogue, in display order." }),
  forecast: t.Optional(Forecast),
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
export const GardenEdit = t.Object({
  name: t.Optional(ResourceName), setting: t.Optional(Setting),
  location: t.Optional(t.Union([Place, t.Null()], { description: "Where the garden is, for its forecast. Null forgets it." })),
}, { minProperties: 1, description: "The fields to change. One left out keeps its value." });
export const PlacesResponse = t.Object({ places: t.Array(Place) });
export const NewPlant = t.Object({ name: ResourceName, species: ResourceName });
export const PlantEdit = t.Object({ name: t.Optional(ResourceName), species: t.Optional(ResourceName) }, {
  minProperties: 1, description: "The fields to change. One left out keeps its value." });
export const ApiKey = t.Object({
  key: t.String({ minLength: 1, description: "Firmware credential issued by the backend; treat as a secret." }),
  createdAt: Timestamp,
});
export const GardenResponse = t.Object({ garden: Garden });
export const PlantResponse = t.Object({ plant: Plant });
export const ApiKeyResponse = t.Object({ apiKey: ApiKey });
export const PlantedResponse = t.Object({ plant: Plant, apiKey: ApiKey });

export type GardenData = Static<typeof Garden>;
export type PlantData = Static<typeof Plant>;
export type PlantStatusData = Static<typeof PlantStatus>;
export type DeviceData = Static<typeof Device>;
export type MeasurementData = Static<typeof Measurement>;
export type MetricInfoData = Static<typeof MetricInfo>;
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
export type GardenEditData = Static<typeof GardenEdit>;
export type PlantEditData = Static<typeof PlantEdit>;
export type PlantResult = Static<typeof PlantResponse>;
export type ApiKeyData = Static<typeof ApiKey>;
export type GardenResult = Static<typeof GardenResponse>;
export type ApiKeyResult = Static<typeof ApiKeyResponse>;
export type PlantedResult = Static<typeof PlantedResponse>;
