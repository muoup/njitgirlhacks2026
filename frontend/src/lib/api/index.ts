import { API_URL } from "@/lib/config";
import { createBffApi } from "./bff";
import type { GroveApi } from "./types";

export const api: GroveApi = createBffApi(API_URL);

export * from "./types";
