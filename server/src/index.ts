import { createApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig();
const { app } = await createApp({ config });
app.listen(config.port);

console.log(`Grove BFF: ${config.baseURL}`);
console.log(`OpenAPI: ${config.baseURL}/openapi`);
console.log("Development auth is in memory; dashboard responses are fixtures.");
