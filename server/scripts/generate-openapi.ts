import { createApp } from "../src/app";
import { loadConfig } from "../src/config";

// Generate the development contract without binding a port or contacting a database.
const { app } = await createApp({ config: loadConfig({ SEED_DEMO_ACCOUNT: "false" }) });
const response = await app.handle(new Request("http://localhost:3001/openapi/json"));
if (!response.ok) throw new Error(`OpenAPI generation failed: ${response.status}`);
const schema = await response.json();
const path = new URL("../openapi.json", import.meta.url);
await Bun.write(path, `${JSON.stringify(schema, null, 2)}\n`);
console.log(`Generated ${path.pathname}`);
