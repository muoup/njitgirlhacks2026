// Type-only imports share the validated BFF contract without bundling server code.
import type {
  GardenData as Garden, PlantData as Plant, PlantStatusData as PlantStatus,
  DeviceData as Device, MeasurementData as Measurement, ReadingData as Reading,
  InsightItemData as InsightItem, InsightsData as Insights, MetaData as Meta,
  GardensData as GardensResponse, DashboardData as DashboardResponse,
  ReadingsData as ReadingsResponse,
} from "../../../../server/src/schemas";

export type {
  Garden, Plant, PlantStatus, Device, Measurement, Reading, InsightItem,
  Insights, Meta, GardensResponse, DashboardResponse, ReadingsResponse,
};

/** A non-2xx answer carrying the BFF error code and message. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export interface GroveApi {
  listGardens(): Promise<GardensResponse>;
  getDashboard(gardenId: string): Promise<DashboardResponse>;
  /** The BFF accepts an ordered range of at most seven days. */
  getPlantReadings(plantId: string, from: Date, to: Date): Promise<ReadingsResponse>;
}
