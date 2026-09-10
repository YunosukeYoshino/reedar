import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { startServer } from "./server";

const server = await startServer({
  dataDirectory: resolve(process.env.REEDAR_DATA_DIR || ".data/dev"),
  staticDirectory: fileURLToPath(new URL("../../dist/web", import.meta.url)),
  port: process.env.REEDAR_PORT ? Number(process.env.REEDAR_PORT) : 0,
});
console.log(`Reedar: ${server.url}`);
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void server.close().then(() => process.exit(0)); });
