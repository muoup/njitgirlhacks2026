// Type-only imports share the validated BFF contract without bundling server code.
import type {
  GardenData as Garden, PlantData as Plant, PlantStatusData as PlantStatus,
  DeviceData as Device, MeasurementData as Measurement, MetricInfoData as MetricInfo, ReadingData as Reading,
  InsightItemData as InsightItem, InsightsData as Insights, MetaData as Meta,
  GardensData as GardensResponse, DashboardData as DashboardResponse,
  ReadingsData as ReadingsResponse,
  NewPlantData as NewPlant, ApiKeyData as ApiKey, GardenResult as GardenResponse,
  ApiKeyResult as ApiKeyResponse, PlantedResult as PlantedResponse,
  PlantEditData as PlantEdit, PlantResult as PlantResponse, GardenEditData as GardenEdit,
} from "../../../../server/src/schemas";
import type { AlertData as Alert, ForecastData as Forecast, ForecastDayData as ForecastDay, PlaceData as Place } from "../../../../server/src/weather";
import type { ChatRequestData as ChatRequest, ChatResponseData as ChatResponse,
  PendingActionData as PendingAction, DecisionData as DecisionResponse,
  RefreshData as RefreshResponse, OverviewData as PlantOverview, ActivityData as MentorActivity } from "../../../../server/src/agent/schemas";
export type { ChatRequest, ChatResponse, PendingAction, DecisionResponse, RefreshResponse, PlantOverview, MentorActivity };
export type { Alert, Forecast, ForecastDay, Place, GardenEdit };

export type {
  Garden, Plant, PlantStatus, Device, Measurement, MetricInfo, Reading, InsightItem,
  Insights, Meta, GardensResponse, DashboardResponse, ReadingsResponse,
  NewPlant, ApiKey, GardenResponse, ApiKeyResponse, PlantedResponse, PlantEdit, PlantResponse,
};

/** A non-2xx answer carrying the BFF error code and message. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** The browser could not receive an HTTP response (network, CORS, or a dropped connection). */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("Couldn't reach the server. Check your connection and try again.", { cause });
    this.name = "NetworkError";
  }
}

/**
 * True while a route is reserved or unavailable during a staggered deployment.
 * Keep the 501 handling until the backend implements the potting shed's actions.
 */
export function notBuilt(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 501 || (error.status === 404 && error.message === "Endpoint not found."))
  );
}

export interface GroveApi {
  askMentor(request: ChatRequest): Promise<ChatResponse>;
  /** What the mentor's run is doing now, to show while a reply is on its way. */
  getMentorActivity(): Promise<{ activity: MentorActivity | null }>;
  decideAgentAction(id: string, decision: "approve" | "cancel"): Promise<DecisionResponse>;
  refreshInsights(): Promise<RefreshResponse>;
  listGardens(): Promise<GardensResponse>;
  getDashboard(gardenId: string): Promise<DashboardResponse>;
  /** The metric catalogue, for pages that draw readings without a dashboard. */
  listMetrics(): Promise<{ metrics: MetricInfo[] }>;
  /** The BFF accepts an ordered range of at most seven days. */
  getPlantReadings(plantId: string, from: Date, to: Date): Promise<ReadingsResponse>;

  // Reserved in the BFF; return 501 until the backend implements these actions.
  /** POST /gardens */
  createGarden(name: string): Promise<GardenResponse>;
  /** PATCH /gardens/:id. Its name, whether it is indoors, and where it is; a null location forgets it. */
  updateGarden(gardenId: string, edit: GardenEdit): Promise<GardenResponse>;
  /** GET /places. Up to five towns matching a name or postcode. */
  searchPlaces(query: string): Promise<{ places: Place[] }>;
  /** DELETE /gardens/:id. Takes the garden's plants, readings and keys with it. */
  removeGarden(gardenId: string): Promise<void>;
  /** POST /gardens/:id/plants. A new plant comes with its key. */
  createPlant(gardenId: string, plant: NewPlant): Promise<PlantedResponse>;
  /** PATCH /plants/:id. Its readings and its key stay as they are. */
  updatePlant(plantId: string, edit: PlantEdit): Promise<PlantResponse>;
  /** DELETE /plants/:id */
  removePlant(plantId: string): Promise<void>;
  /** GET /plants/:id/api-keys */
  getPlantApiKey(plantId: string): Promise<ApiKeyResponse>;
  /** POST /plants/:id/api-keys, which the BFF reserves. The old key stops working. */
  replacePlantApiKey(plantId: string): Promise<ApiKeyResponse>;
}
