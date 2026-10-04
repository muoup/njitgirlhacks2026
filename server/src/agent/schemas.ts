import { t, type Static } from "elysia";
import { Block, GeneratedBlock } from "./blocks";

const Id = t.String({ minLength: 1, maxLength: 200 });
const Name = t.String({ minLength: 1, maxLength: 200, pattern: "\\S" });
const Timestamp = t.String({ format: "date-time" });
export const Persona = t.Union([t.Literal("gnome"), t.Literal("wizard")]);
export const MemoryDocument = t.Object({
  markdown: t.String({ maxLength: 16_384 }), revision: t.Integer({ minimum: 0 }),
  updatedAt: t.Union([Timestamp, t.Null()]), source: t.Union([t.Literal("mock"), t.Literal("backend")]),
});
export const MemoryWrite = t.Object({
  markdown: t.String({ maxLength: 16_384 }), expectedRevision: t.Integer({ minimum: 0 }),
});
export const Mutation = t.Union([
  t.Object({ kind: t.Literal("createGarden"), name: Name }, { additionalProperties: false }),
  t.Object({ kind: t.Literal("removeGarden"), gardenId: Id }, { additionalProperties: false }),
  t.Object({ kind: t.Literal("createPlant"), gardenId: Id, name: Name, species: Name }, { additionalProperties: false }),
  t.Object({ kind: t.Literal("removePlant"), plantId: Id }, { additionalProperties: false }),
]);
export const PendingAction = t.Object({
  id: Id, conversationId: Id, description: t.String(), action: Mutation,
  expiresAt: Timestamp,
  status: t.Union([t.Literal("pending"), t.Literal("cancelled"), t.Literal("expired"),
    t.Literal("succeeded"), t.Literal("failed")]),
  result: t.Optional(t.Object({ code: t.String(), message: t.String() })),
});
export const ChatRequest = t.Object({
  message: t.String({ minLength: 1, maxLength: 500, pattern: "\\S" }), persona: Persona,
  conversationId: t.Optional(Id), requestId: Id,
});
export const ChatResponse = t.Object({
  conversationId: Id, reply: t.String(), pendingActions: t.Array(PendingAction),
  contextRevision: t.String(),
  blocks: t.Array(Block, { description: "What to draw under the reply. Each names its plant." }),
  plants: t.Array(t.Object({ id: Id, name: t.String() }), { description: "The plants those blocks are about." }),
});
export const DecisionRequest = t.Object({ decision: t.Union([t.Literal("approve"), t.Literal("cancel")]) }, { additionalProperties: false });
export const DecisionResponse = t.Object({ action: PendingAction });
const overview = {
  plantId: Id,
  urgency: t.Union([t.Literal("ok"), t.Literal("watch"), t.Literal("act"), t.Null()]),
  headline: t.String({ maxLength: 200 }), text: t.String({ maxLength: 2000 }),
  evidence: t.Array(t.Object({ metric: t.String(), unit: t.String(), from: Timestamp, to: Timestamp }), { maxItems: 6 }),
};
export const PlantOverview = t.Object({ ...overview, blocks: t.Array(Block, { maxItems: 3 }) });
/** One stop on the dashboard's trail. Every plant has exactly one place among them. */
export const Stop = t.Union([
  t.Object({ type: t.Literal("plant"), plantId: Id }),
  t.Object({ type: t.Literal("calm-plants"), plantIds: t.Array(Id, { minItems: 1 }) }),
  t.Object({ type: t.Literal("garden-notes") }),
  t.Object({ type: t.Literal("weather") }, { description: "The week's forecast. Only for a garden that has one." }),
]);
export const Generation = t.Object({
  state: t.Union([t.Literal("unavailable"), t.Literal("ready"), t.Literal("refreshing"),
    t.Literal("stale"), t.Literal("failed")]),
  model: t.Literal("gemini-3.8-flash"), contextRevision: t.Union([t.String(), t.Null()]),
  lastAttemptAt: t.Union([Timestamp, t.Null()]),
  error: t.Union([t.Object({ code: t.String(), message: t.String() }), t.Null()]),
});
export const RefreshResponse = t.Object({
  refreshed: t.Boolean(), generatedAt: t.Union([Timestamp, t.Null()]), gardenIds: t.Array(Id),
});
// What the model writes. Blocks and stops are flat here and their lists unbounded (see
// GeneratedBlock); the service publishes only those that can be drawn.
export const ChatOutput = t.Object({ reply: t.String({ minLength: 1, maxLength: 4000 }),
  blocks: t.Optional(t.Array(GeneratedBlock)) });
export const InsightOutput = t.Object({ gardens: t.Array(t.Object({
  gardenId: Id, overviews: t.Array(t.Object({ ...overview, blocks: t.Array(GeneratedBlock) })),
  items: t.Array(t.Object({ plantId: t.Union([Id, t.Null()]), text: t.String({ maxLength: 2000 }),
    needsFollowUp: t.Boolean() }), { maxItems: 30 }),
  blocks: t.Optional(t.Array(GeneratedBlock)),
  layout: t.Optional(t.Array(t.Object({
    type: t.Union([t.Literal("plant"), t.Literal("calm-plants"), t.Literal("garden-notes"), t.Literal("weather")]),
    plantId: t.Optional(Id), plantIds: t.Optional(t.Array(Id)),
  }))),
})) });
export type MemoryData = Static<typeof MemoryDocument>;
export type MemoryWriteData = Static<typeof MemoryWrite>;
export type MutationData = Static<typeof Mutation>;
export type PendingActionData = Static<typeof PendingAction>;
export type ChatRequestData = Static<typeof ChatRequest>;
export type ChatResponseData = Static<typeof ChatResponse>;
export type DecisionData = Static<typeof DecisionResponse>;
export type OverviewData = Static<typeof PlantOverview>;
export type StopData = Static<typeof Stop>;
export type ChatOutputData = Static<typeof ChatOutput>;
export type GenerationData = Static<typeof Generation>;
export type RefreshData = Static<typeof RefreshResponse>;
export type InsightOutputData = Static<typeof InsightOutput>;
