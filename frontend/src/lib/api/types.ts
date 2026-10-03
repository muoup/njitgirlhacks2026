/**
 * Response shapes of the BFF's /api/v1 endpoints, mirroring server/src/schemas.ts.
 * Replace with types generated from the BFF's OpenAPI document once that is wired up.
 *
 * `Plant.status` and `InsightItem.needsFollowUp` are not in the BFF contract yet. Only the
 * local fixtures send them; the dashboard treats both as unknown when they are missing.
 */

export type PlantStatus = "healthy" | "needs_care";

export interface Garden {
  id: string;
  name: string;
  plantCount: number;
  deviceCount: number;
}

export interface Plant {
  id: string;
  gardenId: string;
  name: string;
  species: string;
  status?: PlantStatus;
}

export interface Device {
  id: string;
  gardenId: string;
  name: string;
  lastSeenAt: string | null;
}

export interface Measurement {
  metric: string;
  value: number;
  unit: string;
}

export interface Reading {
  plantId: string;
  deviceId: string;
  measuredAt: string;
  measurements: Measurement[];
}

export interface InsightItem {
  id: string;
  plantId: string | null;
  text: string;
  needsFollowUp?: boolean;
}

export interface Insights {
  gardenId: string;
  status: "unavailable" | "ready";
  generatedAt: string | null;
  items: InsightItem[];
}

export interface Meta {
  source: "mock" | "backend";
  hydratedAt: string;
}

export interface GardensResponse {
  gardens: Garden[];
  meta: Meta;
}

export interface DashboardResponse {
  garden: Garden;
  plants: Plant[];
  devices: Device[];
  latestReadings: Reading[];
  insights: Insights;
  meta: Meta;
}

export interface ReadingsResponse {
  plantId: string;
  from: string;
  to: string;
  readings: Reading[];
  meta: Meta;
}

/** A non-2xx answer, carrying the BFF's `{ error: { code, message } }` body. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface GroveApi {
  listGardens(): Promise<GardensResponse>;
  getDashboard(gardenId: string): Promise<DashboardResponse>;
  /** The BFF accepts an ordered range of at most seven days. */
  getPlantReadings(plantId: string, from: Date, to: Date): Promise<ReadingsResponse>;
}
