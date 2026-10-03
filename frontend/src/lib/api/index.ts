import { API_URL } from "@/lib/config";
import { createBffApi } from "./bff";
import { fixtureApi } from "./fixture";
import type { GroveApi } from "./types";

export const api: GroveApi = API_URL ? createBffApi(API_URL) : fixtureApi;

export * from "./types";
