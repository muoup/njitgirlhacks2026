import { t, type Static } from "elysia";
import { metricCatalogue } from "../metrics";
import type { summarize } from "./context";
import { proseProblems } from "./writing";

const Id = t.String({ minLength: 1, maxLength: 200 });
const Range = t.Union([t.Literal("24h"), t.Literal("7d")]);
const Metric = t.String({ minLength: 1, maxLength: 100 });
const Day = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
const Mark = t.Object({ at: t.String({ format: "date-time" }), label: t.String({ minLength: 1, maxLength: 200 }) });

/**
 * What a page may be asked to draw about a plant. A block only chooses what to show: every
 * number, scale and healthy range comes from the plant's readings and the metric catalogue.
 * `plantId` is absent on a block inside that plant's own overview.
 */
export const Block = t.Union([
  t.Object({ type: t.Literal("readings"), plantId: t.Optional(Id) }),
  t.Object({ type: t.Literal("chart"), plantId: t.Optional(Id), range: Range, metric: t.Optional(Metric),
    marks: t.Optional(t.Array(Mark, { maxItems: 2, description: "Moments on the chart worth pointing at, each with a few words." })) }),
  t.Object({ type: t.Literal("meter"), plantId: t.Optional(Id), metric: Metric }, {
    description: "Where the latest value sits on the metric's scale." }),
  t.Object({ type: t.Literal("stat"), plantId: t.Optional(Id), metric: Metric, range: Range }, {
    description: "The latest value and how far it moved over the range." }),
  t.Object({ type: t.Literal("steps"), items: t.Array(t.String({ maxLength: 200 }), { minItems: 1, maxItems: 3 }) }, {
    description: "What to do, as short steps." }),
  t.Object({ type: t.Literal("weather"), plantId: t.Optional(Id), date: Day }, {
    description: "One day of the garden's forecast, by its date." }),
]);

/**
 * The same blocks as a model writes them: one flat shape with a `type`, which providers'
 * structured output handles more reliably than a union. Its limits are loose so that one
 * overlong label cannot fail a whole run; `publishable` decides what is kept. Its arrays
 * carry no maxItems: Vertex refuses the insight schema outright when these nested lists are
 * bounded as well, and `publishable` cuts them to size anyway.
 */
export const GeneratedBlock = t.Object({
  type: t.Union([t.Literal("readings"), t.Literal("chart"), t.Literal("meter"), t.Literal("stat"), t.Literal("steps"), t.Literal("weather")]),
  plantId: t.Optional(Id),
  metric: t.Optional(t.String({ minLength: 1, maxLength: 100,
    description: "A catalogue metric identifier the plant has reported. Required for meter and stat, and for a chart with marks." })),
  range: t.Optional(t.Union([t.Literal("24h"), t.Literal("7d")], { description: "Required for chart and stat." })),
  marks: t.Optional(t.Array(Mark, { description: "chart only: at most two." })),
  items: t.Optional(t.Array(t.String({ maxLength: 600 }), { description: "steps only: one to three." })),
  date: t.Optional(t.String({ maxLength: 40, description: "weather only: the date of one day in the garden's forecast." })),
});
export type BlockData = Static<typeof Block>;
export type GeneratedBlockData = Static<typeof GeneratedBlock>;

const SPAN = { "24h": 86_400_000, "7d": 7 * 86_400_000 };
const LIMITS = { mark: 28, step: 90 };

/**
 * The metric whose latest value lies furthest from the middle of its healthy range, counted
 * in widths of that range: what a meter or stat is about when the model names none.
 */
function furthestOut(history: ReturnType<typeof summarize>) {
  let best: { metric: (typeof history)[number]; distance: number } | undefined;
  for (const metric of history) {
    const healthy = metricCatalogue.find(info => info.metric === metric.metric)?.scale?.healthy;
    if (!healthy || metric.unit !== metricCatalogue.find(info => info.metric === metric.metric)!.unit) continue;
    const half = (healthy.to - healthy.from) / 2;
    const distance = Math.abs(metric.last.value - (healthy.from + half)) / half;
    if (!best || distance > best.distance) best = { metric, distance };
  }
  return best?.metric;
}

export interface BlockScope {
  /** The plants a block may be about, each with the summary of its week of history. */
  plants: Map<string, ReturnType<typeof summarize>>;
  /** The plant a block without a `plantId` is about. Its published blocks carry none. */
  own?: string;
  max: number;
  now: number;
  /** The account's IDs, none of which belong in a label or a step. */
  ids: string[];
  /** The dates in the forecast for each plant's garden. A plant without one can show no weather. */
  days?: Map<string, string[]>;
}

/**
 * The blocks that can be drawn, in the order given. One that names an unknown plant or a
 * metric the plant has not reported is dropped on its own rather than failing the run; so is
 * a mark outside the chart, a step that is not plain words, or a day that is not in the
 * garden's forecast. A meter or stat that names no metric is about the reading furthest from healthy.
 */
export function publishable(generated: GeneratedBlockData[], scope: BlockScope): BlockData[] {
  const blocks: BlockData[] = [];
  const seen = new Set<string>();
  const plain = (text: string, limit: number) => text.trim() && !proseProblems("", text, limit, scope.ids).length;
  for (const block of generated) {
    let published: BlockData | undefined;
    if (block.type === "steps") {
      const items = (block.items ?? []).map(item => item.trim()).filter(item => plain(item, LIMITS.step)).slice(0, 3);
      if (items.length) published = { type: "steps", items };
    } else if (block.type === "weather") {
      // About a plant's garden, so it needs the plant but none of its readings.
      const plantId = block.plantId ?? scope.own;
      if (!plantId || !scope.plants.has(plantId) || (scope.own !== undefined && plantId !== scope.own)) continue;
      if (block.date && scope.days?.get(plantId)?.includes(block.date)) {
        published = { type: "weather", ...(scope.own === undefined ? { plantId } : {}), date: block.date };
      }
    } else {
      const plantId = block.plantId ?? scope.own;
      const history = plantId === undefined ? undefined : scope.plants.get(plantId);
      // A plant with no readings has nothing to draw.
      if (!plantId || !history?.length || (scope.own !== undefined && plantId !== scope.own)) continue;
      const about = scope.own === undefined ? { plantId } : {};
      const named = history.find(item => item.metric === block.metric);
      if (block.metric !== undefined && !named) continue;
      const metric = named ?? (block.type === "meter" || block.type === "stat" ? furthestOut(history) : undefined);
      // A range left out means the whole week the plant's history covers.
      const range = block.range ?? "7d";
      if (block.type === "readings") published = { type: "readings", ...about };
      else if (block.type === "meter") {
        if (metric && metricCatalogue.find(info => info.metric === metric.metric)?.scale) published = { type: "meter", ...about, metric: metric.metric };
      } else if (block.type === "stat") {
        if (metric) published = { type: "stat", ...about, metric: metric.metric, range };
      } else if (!metric || metric.samples > 1) {
        const from = scope.now - SPAN[range];
        const marks = metric ? (block.marks ?? []).filter(mark => {
          const at = Date.parse(mark.at);
          return at >= Math.max(from, Date.parse(metric.first.at)) && at <= Math.min(scope.now, Date.parse(metric.last.at)) &&
            plain(mark.label, LIMITS.mark);
        }).slice(0, 2).map(mark => ({ at: mark.at, label: mark.label.trim() })) : [];
        published = { type: "chart", ...about, range, ...(metric ? { metric: metric.metric } : {}),
          ...(marks.length ? { marks } : {}) };
      }
    }
    if (!published) continue;
    // Marks and steps aside, saying the same thing twice draws the same thing twice.
    const key = JSON.stringify({ ...published, marks: undefined });
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push(published);
    if (blocks.length === scope.max) break;
  }
  return blocks;
}

/** A line for the conversation's history, so the mentor knows what it has already shown. */
export function describeBlock(block: BlockData, plantName: (plantId: string) => string) {
  if (block.type === "steps") return `steps: ${block.items.join("; ")}`;
  if (block.type === "weather") return `the forecast for one day at ${block.plantId ? plantName(block.plantId) : "the plant"}'s garden`;
  const metric = "metric" in block && block.metric ? ` of ${metricCatalogue.find(info => info.metric === block.metric)?.label ?? block.metric}` : "";
  return `${block.type}${metric} for ${block.plantId ? plantName(block.plantId) : "the plant"}${"range" in block ? ` over ${block.range}` : ""}`;
}
