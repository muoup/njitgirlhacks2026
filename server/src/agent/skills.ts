export const skillNames = ["watering", "sensor-quality", "plant-symptoms", "memory"] as const;
export async function readSkill(name: typeof skillNames[number]) {
  if (!skillNames.includes(name)) throw new Error("Unknown skill.");
  return Bun.file(new URL(`../../skills/${name}.md`, import.meta.url)).text();
}
