/** How long generated dashboard prose may be. The prompt asks for less, since a model counts loosely. */
export const LIMITS = { headline: 60, text: 280 };

const FAULTS: Array<[RegExp, string]> = [
  [/\d{4}-\d{2}-\d{2}|\b\d{1,2}:\d{2}\b/, "has a date or clock time; say when relative to now, such as \"since yesterday\""],
  [/\bADC\b|\d\s*(?:raw|counts?)\b/i, "quotes a raw sensor count; use the reading's word instead"],
  [/[a-z]+_[a-z_]+/, "contains a metric identifier; use plain words"],
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, "contains an ID"],
  [/[*`#\n]|^\s*[-•]\s/, "uses Markdown or line breaks; write plain sentences"],
];

/**
 * What is wrong with one piece of generated dashboard prose, worded so the model can fix it.
 * `ids` are the account's garden, plant and device IDs, none of which belong in prose.
 */
export function proseProblems(where: string, text: string, limit: number, ids: string[]) {
  const problems = FAULTS.filter(([fault]) => fault.test(text)).map(([, problem]) => `${where} ${problem}.`);
  if (text.length > limit) problems.push(`${where} is ${text.length} characters; the limit is ${limit}.`);
  if (ids.some(id => text.includes(id))) problems.push(`${where} contains an ID.`);
  return problems;
}
